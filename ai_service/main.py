"""
ai_service/main.py
------------------
Microservice Flask exposant l'IA d'identification d'animaux via HTTP.

Ce service est interne ; il n'est appelé que par le backend Node.js.

Endpoint :
    POST /analyze
        Reçoit une image en multipart/form-data (champ « image »)
        et retourne les résultats d'analyse au format JSON.

Utilisation :
    python ai_service/main.py
    # Service disponible sur http://localhost:5001
"""

import io
import os
import sys
import threading

# Ajoute la racine du projet au PYTHONPATH pour accéder à animal_identifier et database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request
from PIL import Image

from animal_identifier import extract_gps_from_exif, is_animal, load_model, prepare_image
from database import result_exists, save_result

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Chargement du modèle (une seule fois au démarrage)
# ---------------------------------------------------------------------------

print("⏳  Initialisation du service IA…")
_model, _preprocess_input, _decode_predictions = load_model()
_model_lock = threading.Lock()
print("✅  Service IA prêt.\n")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyse une image et retourne les résultats d'identification.

    Entrée : multipart/form-data
        - image     (File)  : image à analyser
        - filename  (str)   : nom du fichier (optionnel, utilisé comme source en BDD)
        - latitude  (float) : latitude GPS (optionnel)
        - longitude (float) : longitude GPS (optionnel)

    Si latitude/longitude ne sont pas fournis, le service tente de les extraire
    des métadonnées EXIF de l'image.

    Sortie : JSON
        {
            "filename": str,
            "top5": [{"label": str, "score": float}, ...],
            "animal_detected": bool,
            "best_label": str,
            "best_score": float,
            "animal_in_top5": {"label": str, "score": float} | null,
            "db_id": int | null,
            "latitude": float | null,
            "longitude": float | null
        }
    """
    file = request.files.get("image")
    if file is None:
        return jsonify({"error": "Aucune image fournie."}), 400

    filename = request.form.get("filename") or file.filename or "image"

    # Coordonnées GPS fournies par l'utilisateur (optionnel)
    try:
        latitude = float(request.form["latitude"]) if request.form.get("latitude") else None
        longitude = float(request.form["longitude"]) if request.form.get("longitude") else None
    except ValueError:
        return jsonify({"error": "latitude et longitude doivent être des nombres décimaux."}), 400

    try:
        image_bytes = file.read()
        pil_img = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        return jsonify({"error": f"Image invalide : {exc}"}), 400

    # Extraction GPS depuis les EXIF si non fournie
    if latitude is None and longitude is None:
        latitude, longitude = extract_gps_from_exif(pil_img)

    try:
        img = pil_img.convert("RGB")
    except Exception as exc:
        return jsonify({"error": f"Conversion de l'image impossible : {exc}"}), 400

    img_array = prepare_image(img, _preprocess_input)

    with _model_lock:
        predictions = _model.predict(img_array, verbose=0)

    top5 = _decode_predictions(predictions, top=5)[0]

    _, best_label, best_score = top5[0]
    animal_detected = is_animal(best_label)

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

    # Sauvegarde uniquement si un animal est détecté avec certitude et que la source n'est pas dupliquée
    row_id = None
    if animal_detected and not result_exists(filename):
        row_id = save_result(
            source=filename,
            top5=top5,
            is_animal_detected=True,
            latitude=latitude,
            longitude=longitude,
        )

    if animal_detected:
        top5_result = [
            {"label": lbl.replace("_", " "), "score": round(float(sc) * 100, 2)}
            for _, lbl, sc in top5
        ]
    else:
        top5_result = []

    return jsonify(
        {
            "filename": filename,
            "top5": top5_result,
            "animal_detected": animal_detected,
            "best_label": best_label.replace("_", " "),
            "best_score": round(float(best_score) * 100, 2),
            "animal_in_top5": animal_in_top5,
            "db_id": row_id,
            "latitude": latitude,
            "longitude": longitude,
        }
    )


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("AI_SERVICE_PORT", 5001))
    debug = os.environ.get("APP_ENV", "development") == "development"
    print(f"🤖  Service IA disponible sur http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
