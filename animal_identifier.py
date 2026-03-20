"""
animal_identifier.py
--------------------
Programme d'identification d'animaux sur une image.

Utilise MobileNetV2 pré-entraîné sur ImageNet (1 000 classes dont de nombreux animaux).
Les résultats sont sauvegardés dans une base de données SQLite (results.db)
avec la position géographique optionnelle.

Utilisation :
    python animal_identifier.py --image chemin/vers/image.jpg
    python animal_identifier.py --url https://...
    python animal_identifier.py --image photo.jpg --lat 48.8566 --lon 2.3522
"""

import argparse
import io
import sys
from pathlib import Path

from database import result_exists, save_result

import numpy as np
import requests
from PIL import Image

# ---------------------------------------------------------------------------
# Étape 0 : Extraction GPS depuis les métadonnées EXIF
# ---------------------------------------------------------------------------


def _dms_to_decimal(dms, ref: str) -> float:
    """Convertit des coordonnées DMS (degrés, minutes, secondes) en degrés décimaux."""
    if not dms or len(dms) < 3:
        raise ValueError(f"Format DMS invalide : {dms!r}")
    degrees = float(dms[0])
    minutes = float(dms[1])
    seconds = float(dms[2])
    decimal = degrees + minutes / 60 + seconds / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def extract_gps_from_exif(img: Image.Image) -> tuple:
    """
    Extrait les coordonnées GPS depuis les métadonnées EXIF de l'image.

    Retourne (latitude, longitude) en degrés décimaux,
    ou (None, None) si les données sont absentes ou illisibles.
    """
    # Tag EXIF pour GPSInfo (IFD ID 34853 / 0x8825)
    GPS_INFO_TAG = 34853

    try:
        exif = img.getexif()
        if not exif:
            return None, None

        gps_data = exif.get_ifd(GPS_INFO_TAG)
        if not gps_data:
            return None, None

        lat_dms = gps_data.get(2)   # GPSLatitude
        lat_ref = gps_data.get(1)   # GPSLatitudeRef
        lon_dms = gps_data.get(4)   # GPSLongitude
        lon_ref = gps_data.get(3)   # GPSLongitudeRef

        if not (lat_dms and lat_ref and lon_dms and lon_ref):
            return None, None

        lat = _dms_to_decimal(lat_dms, lat_ref)
        lon = _dms_to_decimal(lon_dms, lon_ref)
        return lat, lon
    except Exception:
        return None, None


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
    """Ouvre une image depuis un chemin local (préserve les EXIF pour extraction GPS)."""
    file_path = Path(path)
    if not file_path.exists():
        print(f"❌  Fichier introuvable : {path}", file=sys.stderr)
        sys.exit(1)
    return Image.open(file_path)


def load_image_from_url(url: str) -> Image.Image:
    """Télécharge une image depuis une URL (préserve les EXIF pour extraction GPS)."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"❌  Impossible de télécharger l'image : {exc}", file=sys.stderr)
        sys.exit(1)
    return Image.open(io.BytesIO(response.content))


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


def identify_animal(
    image_source: str,
    is_url: bool = False,
    latitude: float | None = None,
    longitude: float | None = None,
) -> None:
    """Pipeline complet : chargement du modèle, de l'image, inférence, affichage et sauvegarde."""

    # 1. Modèle
    model, preprocess_input, decode_predictions = load_model()

    # 2. Image (on ouvre sans conversion pour accéder aux EXIF avant le convert)
    print(f"📷  Chargement de l'image : {image_source}")
    if is_url:
        img_raw = load_image_from_url(image_source)
    else:
        img_raw = load_image_from_file(image_source)
    print(f"     Taille originale : {img_raw.size[0]}×{img_raw.size[1]} px\n")

    # 2b. Extraction GPS depuis les EXIF si les coordonnées ne sont pas fournies
    if latitude is None and longitude is None:
        latitude, longitude = extract_gps_from_exif(img_raw)
        if latitude is not None:
            print(f"📍  Position GPS extraite des EXIF : lat={latitude:.6f}, lon={longitude:.6f}")

    img = img_raw.convert("RGB")

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
    animal_detected = is_animal(best_label)
    if animal_detected:
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

    # 7. Sauvegarde dans la base de données (uniquement si animal détecté)
    has_location = latitude is not None and longitude is not None
    if animal_detected:
        already_exists = result_exists(image_source)
        row_id = save_result(
            source=image_source,
            top5=top5,
            is_animal_detected=True,
            latitude=latitude if has_location else None,
            longitude=longitude if has_location else None,
        )
        loc_info = f" | position : lat={latitude}, lon={longitude}" if has_location else ""
        if already_exists:
            print(f"\n🔄  Résultat mis à jour en base de données (id={row_id}{loc_info}).")
        else:
            print(f"\n💾  Résultat sauvegardé en base de données (id={row_id}{loc_info}).")
    else:
        print("\n⚠️  Aucun animal détecté avec certitude — résultat non sauvegardé.")


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
            "  python animal_identifier.py --image photo.jpg --lat 48.8566 --lon 2.3522\n"
        ),
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", metavar="CHEMIN", help="Chemin vers l'image locale")
    group.add_argument("--url", metavar="URL", help="URL de l'image à analyser")
    parser.add_argument(
        "--lat", metavar="LATITUDE", type=float, default=None,
        help="Latitude GPS du lieu de prise de vue (optionnel)"
    )
    parser.add_argument(
        "--lon", metavar="LONGITUDE", type=float, default=None,
        help="Longitude GPS du lieu de prise de vue (optionnel)"
    )

    args = parser.parse_args()

    if args.url:
        identify_animal(args.url, is_url=True, latitude=args.lat, longitude=args.lon)
    else:
        identify_animal(args.image, is_url=False, latitude=args.lat, longitude=args.lon)


if __name__ == "__main__":
    main()
