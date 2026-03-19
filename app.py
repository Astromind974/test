"""
app.py
------
Application web Flask pour l'identification d'animaux en simultané.

Permet de télécharger de 1 à 10 images en même temps, de les analyser
avec MobileNetV2 et d'afficher les résultats dans le navigateur.

Utilisation :
    python app.py
    # Puis ouvrez http://localhost:5000 dans votre navigateur
"""

import io
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from flask import Flask, jsonify, render_template, request
from PIL import Image

from animal_identifier import is_animal, load_model, prepare_image
from database import save_result

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Chargement du modèle (une seule fois au démarrage de l'application)
# ---------------------------------------------------------------------------

print("⏳  Initialisation de l'application…")
_model, _preprocess_input, _decode_predictions = load_model()
# Verrou pour sérialiser les appels model.predict (sécurité multi-threads)
_model_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Logique d'analyse d'une image
# ---------------------------------------------------------------------------

def _analyze_image(image_bytes: bytes, filename: str) -> dict:
    """
    Analyse une image et retourne les résultats sous forme de dictionnaire.

    Paramètres
    ----------
    image_bytes : contenu brut du fichier image
    filename    : nom du fichier (utilisé comme source dans la base de données)

    Retourne un dictionnaire avec les clés :
        filename, top5, animal_detected, best_label, best_score,
        animal_in_top5, db_id
    """
    # Ouverture et préparation de l'image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = prepare_image(img, _preprocess_input)

    # Inférence — protégée par un verrou pour les accès concurrents
    with _model_lock:
        predictions = _model.predict(img_array, verbose=0)

    # Décodage des 5 meilleures prédictions
    top5 = _decode_predictions(predictions, top=5)[0]
    # top5 : liste de tuples (class_id, label, score)

    _, best_label, best_score = top5[0]
    animal_detected = is_animal(best_label)

    # If top-1 is not an animal, look for one in top-5
    if not animal_detected:
        animal_in_top5 = next(
            (
                {"label": lbl.replace("_", " "), "score": round(float(sc) * 100, 2)}
                for _, lbl, sc in top5
                if is_animal(lbl)
            ),
            None,
        )
    else:
        animal_in_top5 = None

    # Sauvegarde en base de données
    row_id = save_result(
        source=filename,
        top5=top5,
        is_animal_detected=animal_detected,
    )

    return {
        "filename": filename,
        "top5": [
            {"label": lbl.replace("_", " "), "score": round(float(sc) * 100, 2)}
            for _, lbl, sc in top5
        ],
        "animal_detected": animal_detected,
        "best_label": best_label.replace("_", " "),
        "best_score": round(float(best_score) * 100, 2),
        "animal_in_top5": animal_in_top5,
        "db_id": row_id,
    }


# ---------------------------------------------------------------------------
# Routes Flask
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Sert la page principale de l'application."""
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Analyse de 1 à 10 images en simultané.

    Attend un formulaire multipart/form-data avec le champ 'images'
    contenant un ou plusieurs fichiers images (max 10).

    Retourne un JSON :
    {
        "results": [ { filename, top5, animal_detected, best_label,
                        best_score, animal_in_top5, db_id }, … ],
        "errors":  [ { filename, error }, … ],
        "total": int,
        "success_count": int,
        "error_count": int
    }
    """
    files = request.files.getlist("images")
    files = [f for f in files if f.filename != ""]

    if not files:
        return jsonify({"error": "Aucune image fournie."}), 400

    if len(files) > 10:
        return jsonify({"error": "Maximum 10 images autorisées par requête."}), 400

    # Lecture du contenu de chaque fichier dans le contexte de la requête
    image_data = []
    for f in files:
        try:
            image_data.append((f.read(), f.filename))
        except Exception as exc:
            return jsonify(
                {"error": f"Erreur lors de la lecture de {f.filename} : {exc}"}
            ), 400

    # Traitement en parallèle (préparation des images concurrente,
    # inférence sérialisée via _model_lock)
    results = []
    errors = []

    with ThreadPoolExecutor(max_workers=min(len(image_data), 10)) as executor:
        future_to_name = {
            executor.submit(_analyze_image, data, name): name
            for data, name in image_data
        }
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                results.append(future.result())
            except Exception as exc:
                errors.append({"filename": name, "error": str(exc)})

    # Tri alphabétique pour un affichage cohérent
    results.sort(key=lambda r: r["filename"])
    errors.sort(key=lambda e: e["filename"])

    return jsonify(
        {
            "results": results,
            "errors": errors,
            "total": len(results) + len(errors),
            "success_count": len(results),
            "error_count": len(errors),
        }
    )


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("APP_PORT", 5000))
    debug = os.environ.get("APP_ENV", "development") == "development"
    print(f"🌐  Application disponible sur http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
