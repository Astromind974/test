"""
animal_identifier.py
--------------------
Programme d'identification d'animaux sur une image.

Utilise MobileNetV2 pré-entraîné sur ImageNet (1 000 classes dont de nombreux animaux).

Utilisation :
    python animal_identifier.py --image chemin/vers/image.jpg
    python animal_identifier.py --url https://...
"""

import argparse
import io
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image

# ---------------------------------------------------------------------------
# Étape 1 : Charger le modèle pré-entraîné
# ---------------------------------------------------------------------------

def load_model():
    """Charge MobileNetV2 pré-entraîné sur ImageNet (téléchargé automatiquement)."""
    # Import ici pour éviter des imports inutiles si la dépendance n'est pas installée
    try:
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input, decode_predictions
    except ImportError:
        print(
            "❌  TensorFlow n'est pas installé. Lance : pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    print("⏳  Chargement du modèle MobileNetV2 (première fois, peut prendre quelques secondes)…")
    model = MobileNetV2(weights="imagenet")
    print("✅  Modèle chargé.\n")
    return model, preprocess_input, decode_predictions


# ---------------------------------------------------------------------------
# Étape 2 : Charger et préparer l'image
# ---------------------------------------------------------------------------

def load_image_from_file(path: str) -> Image.Image:
    """Ouvre une image depuis un chemin local."""
    file_path = Path(path)
    if not file_path.exists():
        print(f"❌  Fichier introuvable : {path}", file=sys.stderr)
        sys.exit(1)
    return Image.open(file_path).convert("RGB")


def load_image_from_url(url: str) -> Image.Image:
    """Télécharge une image depuis une URL."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"❌  Impossible de télécharger l'image : {exc}", file=sys.stderr)
        sys.exit(1)
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def prepare_image(img: Image.Image, preprocess_input) -> np.ndarray:
    """
    Redimensionne l'image en 224×224 px (taille attendue par MobileNetV2)
    et applique le pré-traitement propre au modèle.
    """
    img_resized = img.resize((224, 224))
    img_array = np.array(img_resized)          # shape: (224, 224, 3)
    img_batch = np.expand_dims(img_array, 0)   # shape: (1, 224, 224, 3)
    return preprocess_input(img_batch)


# ---------------------------------------------------------------------------
# Étape 3 : Filtrer les classes « animal »
# ---------------------------------------------------------------------------

# Ensemble des synsets ImageNet correspondant à des animaux (classes 0–397 environ).
# On utilise une liste de mots-clés pour filtrer les prédictions.
ANIMAL_KEYWORDS = {
    "cat", "dog", "bird", "fish", "snake", "lizard", "frog", "turtle",
    "lion", "tiger", "bear", "wolf", "fox", "rabbit", "hamster", "horse",
    "cow", "pig", "sheep", "goat", "deer", "elephant", "giraffe", "zebra",
    "monkey", "gorilla", "chimpanzee", "panda", "koala", "kangaroo",
    "penguin", "eagle", "hawk", "owl", "parrot", "duck", "goose", "swan",
    "crab", "lobster", "shrimp", "octopus", "jellyfish", "shark", "whale",
    "dolphin", "seal", "otter", "beaver", "squirrel", "chipmunk", "mouse",
    "rat", "hedgehog", "bat", "bee", "butterfly", "caterpillar", "beetle",
    "ant", "spider", "scorpion", "snail", "worm", "crayfish", "starfish",
}


def is_animal(label: str) -> bool:
    """Retourne True si le label ImageNet semble être un animal."""
    label_lower = label.lower().replace("_", " ")
    return any(keyword in label_lower for keyword in ANIMAL_KEYWORDS)


# ---------------------------------------------------------------------------
# Étape 4 : Inférence et affichage des résultats
# ---------------------------------------------------------------------------

MEDALS = ["🥇", "🥈", "🥉", "    ", "    "]


def identify_animal(image_source: str, is_url: bool = False) -> None:
    """Pipeline complet : chargement du modèle, de l'image, inférence, affichage."""

    # 1. Modèle
    model, preprocess_input, decode_predictions = load_model()

    # 2. Image
    print(f"📷  Chargement de l'image : {image_source}")
    if is_url:
        img = load_image_from_url(image_source)
    else:
        img = load_image_from_file(image_source)
    print(f"     Taille originale : {img.size[0]}×{img.size[1]} px\n")

    # 3. Préparation
    img_array = prepare_image(img, preprocess_input)

    # 4. Inférence
    print("🔍  Analyse en cours…")
    predictions = model.predict(img_array, verbose=0)

    # 5. Décodage des 5 meilleures prédictions
    top5 = decode_predictions(predictions, top=5)[0]
    # top5 : liste de tuples (class_id, label, score)

    print("\n=== Résultats de l'identification ===")
    for i, (class_id, label, score) in enumerate(top5):
        medal = MEDALS[i]
        print(f"{medal}  {label:<25s} — confiance : {score * 100:6.2f} %")

    # 6. Meilleure prédiction
    best_class_id, best_label, best_score = top5[0]
    print()
    if is_animal(best_label):
        print(
            f"✅  Animal identifié : {best_label.upper().replace('_', ' ')} "
            f"avec {best_score * 100:.2f} % de confiance."
        )
    else:
        # Cherche parmi le top-5 s'il y a un animal
        animal_found = next(
            ((lbl, sc) for _, lbl, sc in top5 if is_animal(lbl)), None
        )
        if animal_found:
            lbl, sc = animal_found
            print(
                f"⚠️   L'image principale n'est peut-être pas un animal, "
                f"mais on a détecté : {lbl.upper().replace('_', ' ')} "
                f"({sc * 100:.2f} % de confiance)."
            )
        else:
            print(
                "❌  Aucun animal clairement identifié dans cette image. "
                f"Meilleur résultat : {best_label} ({best_score * 100:.2f} %)."
            )


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Identifie un animal dans une image grâce à MobileNetV2.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exemples :\n"
            "  python animal_identifier.py --image photo.jpg\n"
            "  python animal_identifier.py --url https://example.com/cat.jpg\n"
        ),
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", metavar="CHEMIN", help="Chemin vers l'image locale")
    group.add_argument("--url", metavar="URL", help="URL de l'image à analyser")

    args = parser.parse_args()

    if args.url:
        identify_animal(args.url, is_url=True)
    else:
        identify_animal(args.image, is_url=False)


if __name__ == "__main__":
    main()
