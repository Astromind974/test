"""
database.py
-----------
Gestion de la base de données SQLite pour stocker les résultats
d'identification d'animaux avec leur position géographique.

La base de données est créée automatiquement dans le fichier
défini par DB_PATH (par défaut : results.db).

Fonctions publiques :
    init_db       – crée les tables si elles n'existent pas encore
    save_result   – enregistre un résultat (animaux uniquement) si non dupliqué
    result_exists – vérifie si une source est déjà enregistrée
    clear_db      – supprime tous les enregistrements
    list_results  – liste les derniers résultats
"""

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", "results.db")


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Retourne une connexion SQLite à la base de données."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    """Crée les tables si elles n'existent pas encore."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS identifications (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT    NOT NULL,
                source      TEXT    NOT NULL,
                latitude    REAL,
                longitude   REAL,
                top1_label  TEXT    NOT NULL,
                top1_score  REAL    NOT NULL,
                top2_label  TEXT,
                top2_score  REAL,
                top3_label  TEXT,
                top3_score  REAL,
                top4_label  TEXT,
                top4_score  REAL,
                top5_label  TEXT,
                top5_score  REAL,
                is_animal   INTEGER NOT NULL
            )
        """)
    conn.close()


def save_result(
    source: str,
    top5: list,
    is_animal_detected: bool,
    latitude: float | None = None,
    longitude: float | None = None,
    db_path: str = DB_PATH,
) -> int:
    """
    Enregistre un résultat d'identification dans la base de données.

    Paramètres
    ----------
    source            : chemin ou URL de l'image analysée
    top5              : liste de tuples (class_id, label, score) – jusqu'à 5 éléments
    is_animal_detected: True si un animal a été reconnu dans le top-1
    latitude          : latitude GPS (optionnel, doit être fourni avec longitude)
    longitude         : longitude GPS (optionnel, doit être fourni avec latitude)
    db_path           : chemin du fichier SQLite

    Retourne l'identifiant (rowid) de la ligne insérée.
    """
    if (latitude is None) != (longitude is None):
        raise ValueError("latitude et longitude doivent être fournis ensemble ou pas du tout.")

    init_db(db_path)

    # Prépare les colonnes top-N (remplit avec None si < 5 prédictions)
    padded = list(top5) + [(None, None, None)] * (5 - len(top5))
    values = []
    for _, label, score in padded:
        values.extend([
            label if label is not None else None,
            float(score) if score is not None else None,
        ])

    conn = get_connection(db_path)
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO identifications (
                timestamp, source, latitude, longitude,
                top1_label, top1_score,
                top2_label, top2_score,
                top3_label, top3_score,
                top4_label, top4_score,
                top5_label, top5_score,
                is_animal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                datetime.now(timezone.utc).isoformat(),
                source,
                latitude,
                longitude,
                *values,
                int(is_animal_detected),
            ],
        )
        row_id = cursor.lastrowid
    conn.close()
    return row_id


def result_exists(source: str, db_path: str = DB_PATH) -> bool:
    """Retourne True si un résultat avec la même source est déjà enregistré."""
    init_db(db_path)
    conn = get_connection(db_path)
    row = conn.execute(
        "SELECT id FROM identifications WHERE source = ? LIMIT 1", (source,)
    ).fetchone()
    conn.close()
    return row is not None


def clear_db(db_path: str = DB_PATH) -> None:
    """Supprime tous les enregistrements de la table identifications."""
    init_db(db_path)
    conn = get_connection(db_path)
    with conn:
        conn.execute("DELETE FROM identifications")
    conn.close()


def list_results(limit: int = 20, db_path: str = DB_PATH) -> list:
    """Retourne les derniers résultats enregistrés (du plus récent au plus ancien)."""
    init_db(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM identifications ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
