"""
download_example.py
-------------------
Télécharge une image d'exemple (un chat) depuis Wikimedia Commons
et la sauvegarde sous le nom 'example.jpg' pour tester le programme.

Utilisation :
    python download_example.py
"""

import sys
import requests

EXAMPLE_URL = (
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/"
    "1200px-Cat03.jpg"
)
OUTPUT_FILE = "example.jpg"


def download_example_image() -> None:
    print(f"⏳  Téléchargement de l'image depuis :\n    {EXAMPLE_URL}")
    try:
        response = requests.get(EXAMPLE_URL, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"❌  Erreur de téléchargement : {exc}", file=sys.stderr)
        sys.exit(1)

    with open(OUTPUT_FILE, "wb") as f:
        f.write(response.content)

    print(f"✅  Image sauvegardée sous : {OUTPUT_FILE}")
    print("\nLance maintenant :")
    print(f"    python animal_identifier.py --image {OUTPUT_FILE}")


if __name__ == "__main__":
    download_example_image()
