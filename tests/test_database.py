"""
test_database.py
----------------
Tests unitaires pour le module database.py.

Chaque test utilise une base de données SQLite temporaire afin d'être
totalement isolé des autres tests et de l'environnement de production.
"""

import sqlite3

import pytest

from database import get_connection, init_db, list_results, save_result, result_exists, clear_db


# ---------------------------------------------------------------------------
# Fixture : chemin vers une base temporaire par test
# ---------------------------------------------------------------------------


@pytest.fixture
def db_path(tmp_path):
    """Retourne le chemin d'un fichier SQLite temporaire unique par test."""
    return str(tmp_path / "test_results.db")


# ---------------------------------------------------------------------------
# Données de test réutilisables
# ---------------------------------------------------------------------------


def _make_top5():
    return [
        ("n001", "tabby", 0.62),
        ("n002", "tiger_cat", 0.18),
        ("n003", "Egyptian_cat", 0.09),
        ("n004", "lynx", 0.04),
        ("n005", "Pomeranian", 0.02),
    ]


# ---------------------------------------------------------------------------
# Tests : init_db
# ---------------------------------------------------------------------------


class TestInitDb:
    def test_creates_identifications_table(self, db_path):
        """init_db doit créer la table 'identifications'."""
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='identifications'"
        )
        assert cursor.fetchone() is not None
        conn.close()

    def test_table_has_expected_columns(self, db_path):
        """La table doit posséder toutes les colonnes définies dans le schéma."""
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("PRAGMA table_info(identifications)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        expected = {
            "id", "timestamp", "source", "latitude", "longitude",
            "top1_label", "top1_score", "top2_label", "top2_score",
            "top3_label", "top3_score", "top4_label", "top4_score",
            "top5_label", "top5_score", "is_animal",
        }
        assert expected.issubset(columns)

    def test_idempotent(self, db_path):
        """Appeler init_db deux fois de suite ne doit lever aucune exception."""
        init_db(db_path)
        init_db(db_path)


# ---------------------------------------------------------------------------
# Tests : save_result
# ---------------------------------------------------------------------------


class TestSaveResult:
    def test_returns_integer_id(self, db_path):
        row_id = save_result("test.jpg", _make_top5(), True, db_path=db_path)
        assert isinstance(row_id, int)
        assert row_id >= 1

    def test_ids_are_sequential(self, db_path):
        id1 = save_result("a.jpg", _make_top5(), True, db_path=db_path)
        id2 = save_result("b.jpg", _make_top5(), False, db_path=db_path)
        assert id2 == id1 + 1

    def test_source_is_persisted(self, db_path):
        save_result("my_photo.jpg", _make_top5(), True, db_path=db_path)
        conn = sqlite3.connect(db_path)
        row = conn.execute("SELECT source FROM identifications WHERE id=1").fetchone()
        conn.close()
        assert row[0] == "my_photo.jpg"

    def test_is_animal_true_persisted(self, db_path):
        save_result("test.jpg", _make_top5(), True, db_path=db_path)
        conn = sqlite3.connect(db_path)
        row = conn.execute("SELECT is_animal FROM identifications WHERE id=1").fetchone()
        conn.close()
        assert row[0] == 1

    def test_is_animal_false_persisted(self, db_path):
        save_result("test.jpg", _make_top5(), False, db_path=db_path)
        conn = sqlite3.connect(db_path)
        row = conn.execute("SELECT is_animal FROM identifications WHERE id=1").fetchone()
        conn.close()
        assert row[0] == 0

    def test_saves_gps_coordinates(self, db_path):
        save_result(
            "test.jpg", _make_top5(), True,
            latitude=48.8566, longitude=2.3522, db_path=db_path,
        )
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT latitude, longitude FROM identifications WHERE id=1"
        ).fetchone()
        conn.close()
        assert row[0] == pytest.approx(48.8566)
        assert row[1] == pytest.approx(2.3522)

    def test_null_gps_when_not_provided(self, db_path):
        save_result("test.jpg", _make_top5(), True, db_path=db_path)
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT latitude, longitude FROM identifications WHERE id=1"
        ).fetchone()
        conn.close()
        assert row[0] is None
        assert row[1] is None

    def test_partial_top5_accepted(self, db_path):
        """Moins de 5 prédictions doit être accepté sans erreur."""
        top2 = [("n001", "cat", 0.9), ("n002", "dog", 0.1)]
        row_id = save_result("test.jpg", top2, True, db_path=db_path)
        assert row_id == 1

    def test_top1_label_persisted(self, db_path):
        save_result("test.jpg", _make_top5(), True, db_path=db_path)
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT top1_label, top1_score FROM identifications WHERE id=1"
        ).fetchone()
        conn.close()
        assert row[0] == "tabby"
        assert row[1] == pytest.approx(0.62)

    def test_raises_with_only_latitude(self, db_path):
        with pytest.raises(ValueError):
            save_result(
                "test.jpg", _make_top5(), True,
                latitude=48.8566, db_path=db_path,
            )

    def test_raises_with_only_longitude(self, db_path):
        with pytest.raises(ValueError):
            save_result(
                "test.jpg", _make_top5(), True,
                longitude=2.3522, db_path=db_path,
            )


# ---------------------------------------------------------------------------
# Tests : list_results
# ---------------------------------------------------------------------------


class TestListResults:
    def test_empty_database_returns_empty_list(self, db_path):
        results = list_results(db_path=db_path)
        assert results == []

    def test_returns_list_of_dicts(self, db_path):
        save_result("test.jpg", _make_top5(), True, db_path=db_path)
        results = list_results(db_path=db_path)
        assert isinstance(results, list)
        assert isinstance(results[0], dict)

    def test_result_contains_expected_keys(self, db_path):
        save_result("test.jpg", _make_top5(), True, db_path=db_path)
        row = list_results(db_path=db_path)[0]
        for key in ("id", "timestamp", "source", "is_animal", "top1_label"):
            assert key in row

    def test_ordered_most_recent_first(self, db_path):
        save_result("first.jpg", _make_top5(), True, db_path=db_path)
        save_result("second.jpg", _make_top5(), False, db_path=db_path)
        results = list_results(db_path=db_path)
        assert results[0]["source"] == "second.jpg"
        assert results[1]["source"] == "first.jpg"

    def test_limit_parameter(self, db_path):
        for i in range(5):
            save_result(f"img{i}.jpg", _make_top5(), True, db_path=db_path)
        results = list_results(limit=3, db_path=db_path)
        assert len(results) == 3

    def test_default_limit_is_20(self, db_path):
        for i in range(25):
            save_result(f"img{i}.jpg", _make_top5(), True, db_path=db_path)
        results = list_results(db_path=db_path)
        assert len(results) == 20


# ---------------------------------------------------------------------------
# Tests : result_exists
# ---------------------------------------------------------------------------


class TestResultExists:
    def test_returns_false_on_empty_db(self, db_path):
        assert result_exists("photo.jpg", db_path=db_path) is False

    def test_returns_true_after_save(self, db_path):
        save_result("photo.jpg", _make_top5(), True, db_path=db_path)
        assert result_exists("photo.jpg", db_path=db_path) is True

    def test_returns_false_for_different_source(self, db_path):
        save_result("photo.jpg", _make_top5(), True, db_path=db_path)
        assert result_exists("other.jpg", db_path=db_path) is False

    def test_duplicate_not_inserted(self, db_path):
        """Un deuxième enregistrement avec la même source ne doit pas être ajouté si on vérifie avant."""
        save_result("photo.jpg", _make_top5(), True, db_path=db_path)
        exists = result_exists("photo.jpg", db_path=db_path)
        if not exists:
            save_result("photo.jpg", _make_top5(), True, db_path=db_path)
        results = list_results(db_path=db_path)
        assert len(results) == 1  # seul le premier enregistrement


# ---------------------------------------------------------------------------
# Tests : clear_db
# ---------------------------------------------------------------------------


class TestClearDb:
    def test_empty_db_stays_empty(self, db_path):
        clear_db(db_path=db_path)
        assert list_results(db_path=db_path) == []

    def test_clears_all_records(self, db_path):
        for i in range(5):
            save_result(f"img{i}.jpg", _make_top5(), True, db_path=db_path)
        clear_db(db_path=db_path)
        assert list_results(db_path=db_path) == []

    def test_table_still_usable_after_clear(self, db_path):
        save_result("before.jpg", _make_top5(), True, db_path=db_path)
        clear_db(db_path=db_path)
        row_id = save_result("after.jpg", _make_top5(), True, db_path=db_path)
        assert row_id >= 1
        results = list_results(db_path=db_path)
        assert len(results) == 1
        assert results[0]["source"] == "after.jpg"
