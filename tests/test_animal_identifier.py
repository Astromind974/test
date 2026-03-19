"""
test_animal_identifier.py
--------------------------
Tests unitaires pour les fonctions utilitaires de animal_identifier.py.

Ces tests ne nécessitent pas TensorFlow : ils couvrent uniquement les
fonctions pures (is_animal, prepare_image) qui peuvent être testées
sans charger le modèle.
"""

import numpy as np
import pytest
from PIL import Image

from animal_identifier import ANIMAL_KEYWORDS, is_animal, prepare_image


# ---------------------------------------------------------------------------
# Tests : is_animal
# ---------------------------------------------------------------------------


class TestIsAnimal:
    # --- Labels reconnus comme animaux ---

    def test_tiger_cat_is_animal(self):
        assert is_animal("tiger_cat") is True

    def test_egyptian_cat_is_animal(self):
        assert is_animal("Egyptian_cat") is True

    def test_dog_in_label_is_animal(self):
        assert is_animal("German_shepherd_dog") is True

    def test_bird_in_label_is_animal(self):
        assert is_animal("robin_bird") is True

    def test_whale_shark_is_animal(self):
        assert is_animal("whale_shark") is True

    def test_butterfly_is_animal(self):
        assert is_animal("butterfly") is True

    # --- Labels non reconnus comme animaux ---

    def test_sports_car_not_animal(self):
        assert is_animal("sports_car") is False

    def test_folding_chair_not_animal(self):
        assert is_animal("folding_chair") is False

    def test_tabby_not_animal(self):
        # "tabby" ne contient aucun mot-clé de ANIMAL_KEYWORDS
        assert is_animal("tabby") is False

    def test_labrador_not_animal(self):
        # "Labrador_retriever" → "labrador retriever" : ne contient aucun mot-clé de ANIMAL_KEYWORDS
        assert is_animal("Labrador_retriever") is False

    # --- Sensibilité à la casse ---

    def test_uppercase_label(self):
        assert is_animal("TIGER_CAT") is True

    def test_mixed_case_label(self):
        assert is_animal("Tiger_Cat") is True

    # --- Underscore remplacé par espace ---

    def test_underscore_is_treated_as_space(self):
        # "sea_snake" → "sea snake" → contient "snake"
        assert is_animal("sea_snake") is True

    # --- Mots-clés présents dans les labels ---

    def test_each_keyword_recognized(self):
        """Tout mot-clé contenu dans un label doit être reconnu."""
        for keyword in list(ANIMAL_KEYWORDS)[:10]:
            assert is_animal(f"some_{keyword}_label") is True


# ---------------------------------------------------------------------------
# Tests : prepare_image
# ---------------------------------------------------------------------------


def _identity_preprocess(x):
    """Fonction de prétraitement identité (retourne le tableau inchangé)."""
    return x


class TestPrepareImage:
    def test_output_shape_is_batch_of_one(self):
        img = Image.new("RGB", (100, 100), color=(128, 64, 32))
        result = prepare_image(img, _identity_preprocess)
        assert result.shape == (1, 224, 224, 3)

    def test_output_is_numpy_array(self):
        img = Image.new("RGB", (50, 200), color=(255, 0, 0))
        result = prepare_image(img, _identity_preprocess)
        assert isinstance(result, np.ndarray)

    def test_various_input_sizes_all_resize_to_224(self):
        for size in [(10, 10), (500, 300), (224, 224), (1000, 1000)]:
            img = Image.new("RGB", size, color=(0, 0, 0))
            result = prepare_image(img, _identity_preprocess)
            assert result.shape == (1, 224, 224, 3), f"Taille source {size} non gérée"

    def test_preprocess_function_is_called(self):
        """La fonction de prétraitement fournie doit être appliquée."""
        calls: list = []

        def recording_preprocess(x):
            calls.append(x.shape)
            return x

        img = Image.new("RGB", (100, 100))
        prepare_image(img, recording_preprocess)
        assert len(calls) == 1
        assert calls[0] == (1, 224, 224, 3)

    def test_preprocess_result_is_returned(self):
        """La valeur retournée par preprocess doit être la sortie de prepare_image."""
        sentinel = np.zeros((1, 224, 224, 3), dtype=np.float32) + 42.0

        def mock_preprocess(_):
            return sentinel

        img = Image.new("RGB", (100, 100))
        result = prepare_image(img, mock_preprocess)
        assert result is sentinel
