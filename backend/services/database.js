'use strict';
const BetterSqlite3 = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'results.db');

function getDb(dbPath) {
  return new BetterSqlite3(dbPath || DB_PATH);
}

function initDb(dbPath) {
  const db = getDb(dbPath);
  db.exec(`
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
  `);
  db.close();
}

function saveResult({ source, top5, isAnimalDetected, latitude, longitude, dbPath }) {
  if ((latitude === undefined || latitude === null) !== (longitude === undefined || longitude === null)) {
    throw new Error('latitude et longitude doivent être fournis ensemble ou pas du tout.');
  }

  initDb(dbPath);
  const db = getDb(dbPath);

  // Pad to 5 entries
  const padded = [...top5, ...Array(5).fill(null)].slice(0, 5);
  const values = [];
  for (const entry of padded) {
    if (entry) {
      values.push(entry.label, entry.score);
    } else {
      values.push(null, null);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO identifications (
      timestamp, source, latitude, longitude,
      top1_label, top1_score,
      top2_label, top2_score,
      top3_label, top3_score,
      top4_label, top4_score,
      top5_label, top5_score,
      is_animal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    new Date().toISOString(),
    source,
    latitude !== undefined ? latitude : null,
    longitude !== undefined ? longitude : null,
    ...values,
    isAnimalDetected ? 1 : 0
  );
  db.close();
  return result.lastInsertRowid;
}

function listResults(limit = 20, dbPath) {
  initDb(dbPath);
  const db = getDb(dbPath);
  const rows = db.prepare('SELECT * FROM identifications ORDER BY id DESC LIMIT ?').all(limit);
  db.close();
  return rows;
}

module.exports = { initDb, saveResult, listResults };
