"""
conftest.py
-----------
Configuration et fixtures partagées pour les tests pytest.

Le modèle TensorFlow (MobileNetV2) est remplacé par un mock pour éviter
le téléchargement (~14 Mo) et le chargement lors des tests.
"""

import io
import sys

import numpy as np
import pytest
from PIL import Image
from unittest.mock import MagicMock, patch

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
# Mock du modèle MobileNetV2 — doit être mis en place AVANT l'import de app
# ---------------------------------------------------------------------------

_mock_model = MagicMock()
_mock_model.predict.return_value = np.zeros((1, 1000))

_mock_decode = MagicMock(return_value=MOCK_TOP5)


def _mock_preprocess(x):
    return np.array(x, dtype=np.float32)

with patch(
    "animal_identifier.load_model",
    return_value=(_mock_model, _mock_preprocess, _mock_decode),
):
    import app as _app_module  # noqa: E402  (import intentionnellement différé)


# ---------------------------------------------------------------------------
# Fixtures Flask
# ---------------------------------------------------------------------------


@pytest.fixture
def flask_app():
    """Instance Flask configurée pour les tests."""
    _app_module.app.config["TESTING"] = True
    return _app_module.app


@pytest.fixture
def client(flask_app):
    """Client HTTP de test Flask."""
    return flask_app.test_client()


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
