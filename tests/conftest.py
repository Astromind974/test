"""
conftest.py
-----------
Configuration et fixtures partagées pour les tests pytest.

Le modèle TensorFlow (MobileNetV2) est remplacé par un mock pour éviter
le téléchargement (~14 Mo) et le chargement lors des tests.
"""

import io

import numpy as np
import pytest
from PIL import Image

# ---------------------------------------------------------------------------
# Prédictions factices retournées par le modèle mocké
# ---------------------------------------------------------------------------

MOCK_TOP5 = [
    [
        ("n02123045", "tabby", 0.62),
        ("n02123159", "tiger_cat", 0.18),
        ("n02124075", "Egyptian_cat", 0.09),
        ("n02127052", "lynx", 0.04),
        ("n02112018", "Pomeranian", 0.02),
    ]
]


# ---------------------------------------------------------------------------
# Utilitaires partagés
# ---------------------------------------------------------------------------


def make_test_image(size: tuple = (100, 100), color: tuple = (128, 64, 32),
                    fmt: str = "JPEG") -> bytes:
    """Crée une image factice en mémoire (utilisée dans plusieurs modules de test)."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()
