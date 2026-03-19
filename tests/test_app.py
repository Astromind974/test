"""
test_app.py
-----------
Tests unitaires pour app.py : routes Flask et utilitaire de sécurité _is_safe_url.

Le modèle TensorFlow est remplacé par un mock (défini dans conftest.py)
afin que les tests s'exécutent sans charger MobileNetV2.
"""

import io
import json
from unittest.mock import patch

import pytest
from werkzeug.datastructures import MultiDict

# app a été importé avec le modèle mocké dans conftest.py ;
# on récupère ici la référence au module déjà en cache.
import app as _app_module
from tests.conftest import make_test_image


# ---------------------------------------------------------------------------
# Tests : route GET /
# ---------------------------------------------------------------------------


class TestIndexRoute:
    def test_get_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_get_returns_html_content(self, client):
        response = client.get("/")
        assert response.content_type.startswith("text/html")


# ---------------------------------------------------------------------------
# Tests : route POST /api/analyze — validation des entrées
# ---------------------------------------------------------------------------


class TestAnalyzeValidation:
    def test_no_images_returns_400(self, client):
        response = client.post("/api/analyze")
        assert response.status_code == 400

    def test_empty_form_returns_400(self, client):
        response = client.post(
            "/api/analyze",
            data={},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    def test_too_many_images_returns_400(self, client):
        from werkzeug.datastructures import FileStorage
        image_bytes = make_test_image()
        data = MultiDict(
            [("images", FileStorage(io.BytesIO(image_bytes), filename=f"img{i}.jpg"))
             for i in range(11)]
        )
        response = client.post(
            "/api/analyze",
            data=data,
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "10" in data["error"]

    def test_invalid_url_scheme_returns_400(self, client):
        response = client.post(
            "/api/analyze",
            data={"urls": "ftp://example.com/image.jpg"},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    def test_private_url_returns_400(self, client):
        response = client.post(
            "/api/analyze",
            data={"urls": "http://192.168.1.1/image.jpg"},
            content_type="multipart/form-data",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data


# ---------------------------------------------------------------------------
# Tests : route POST /api/analyze — traitement d'une image valide
# ---------------------------------------------------------------------------


class TestAnalyzeSuccess:
    def test_single_image_returns_200(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=1):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "test.jpg")},
                content_type="multipart/form-data",
            )
        assert response.status_code == 200

    def test_response_has_required_keys(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=1):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "cat.jpg")},
                content_type="multipart/form-data",
            )
        data = json.loads(response.data)
        for key in ("results", "errors", "total", "success_count", "error_count"):
            assert key in data, f"Clé manquante dans la réponse : {key}"

    def test_result_item_has_required_fields(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=7):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "photo.jpg")},
                content_type="multipart/form-data",
            )
        data = json.loads(response.data)
        assert data["success_count"] == 1
        result = data["results"][0]
        for field in ("filename", "top5", "animal_detected", "best_label",
                      "best_score", "animal_in_top5", "db_id"):
            assert field in result, f"Champ manquant dans le résultat : {field}"

    def test_db_id_matches_save_result_return(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=42):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "photo.jpg")},
                content_type="multipart/form-data",
            )
        data = json.loads(response.data)
        assert data["results"][0]["db_id"] == 42

    def test_counts_are_consistent(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=1):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "photo.jpg")},
                content_type="multipart/form-data",
            )
        data = json.loads(response.data)
        assert data["total"] == data["success_count"] + data["error_count"]

    def test_response_is_json(self, client):
        image_bytes = make_test_image()
        with patch("app.save_result", return_value=1):
            response = client.post(
                "/api/analyze",
                data={"images": (io.BytesIO(image_bytes), "photo.jpg")},
                content_type="multipart/form-data",
            )
        assert response.content_type == "application/json"


# ---------------------------------------------------------------------------
# Tests : _is_safe_url
# ---------------------------------------------------------------------------


class TestIsSafeUrl:
    def test_private_class_c_ip(self):
        assert _app_module._is_safe_url("http://192.168.1.1/image.jpg") is False

    def test_private_class_a_ip(self):
        assert _app_module._is_safe_url("http://10.0.0.1/image.jpg") is False

    def test_loopback_ip(self):
        assert _app_module._is_safe_url("http://127.0.0.1/image.jpg") is False

    def test_link_local_ip(self):
        # 169.254.x.x — APIPA / métadonnées cloud
        assert _app_module._is_safe_url("http://169.254.169.254/metadata") is False

    def test_empty_string(self):
        assert _app_module._is_safe_url("") is False

    def test_invalid_url_format(self):
        assert _app_module._is_safe_url("not-a-url") is False

    def test_url_without_hostname(self):
        assert _app_module._is_safe_url("http:///path") is False
