'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { initDb, saveResult, listResults } = require('../services/database');

function tmpDb() {
  return path.join(os.tmpdir(), `test_db_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
}

const sampleTop5 = [
  { label: 'tabby, tabby cat', score: 0.62 },
  { label: 'tiger cat', score: 0.18 },
  { label: 'Egyptian cat', score: 0.09 },
  { label: 'lynx', score: 0.04 },
  { label: 'Pomeranian', score: 0.02 },
];

describe('initDb', () => {
  test('creates identifications table', () => {
    const dbPath = tmpDb();
    initDb(dbPath);
    const BetterSqlite3 = require('better-sqlite3');
    const db = new BetterSqlite3(dbPath);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='identifications'").get();
    expect(table).toBeDefined();
    db.close();
    fs.unlinkSync(dbPath);
  });

  test('table has all 16 expected columns', () => {
    const dbPath = tmpDb();
    initDb(dbPath);
    const BetterSqlite3 = require('better-sqlite3');
    const db = new BetterSqlite3(dbPath);
    const cols = db.prepare('PRAGMA table_info(identifications)').all();
    const colNames = cols.map(c => c.name);
    db.close();
    fs.unlinkSync(dbPath);

    expect(colNames).toContain('id');
    expect(colNames).toContain('timestamp');
    expect(colNames).toContain('source');
    expect(colNames).toContain('latitude');
    expect(colNames).toContain('longitude');
    expect(colNames).toContain('top1_label');
    expect(colNames).toContain('top1_score');
    expect(colNames).toContain('top5_label');
    expect(colNames).toContain('top5_score');
    expect(colNames).toContain('is_animal');
    expect(cols.length).toBe(16);
  });

  test('is idempotent — calling twice does not throw', () => {
    const dbPath = tmpDb();
    expect(() => { initDb(dbPath); initDb(dbPath); }).not.toThrow();
    fs.unlinkSync(dbPath);
  });
});

describe('saveResult', () => {
  test('returns an integer id >= 1', () => {
    const dbPath = tmpDb();
    const id = saveResult({ source: 'test.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThanOrEqual(1);
    fs.unlinkSync(dbPath);
  });

  test('ids are sequential', () => {
    const dbPath = tmpDb();
    const id1 = saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    const id2 = saveResult({ source: 'b.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    expect(id2).toBe(id1 + 1);
    fs.unlinkSync(dbPath);
  });

  test('source is persisted correctly', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'myfile.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    const rows = listResults(1, dbPath);
    expect(rows[0].source).toBe('myfile.jpg');
    fs.unlinkSync(dbPath);
  });

  test('is_animal flag is persisted correctly for both values', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    saveResult({ source: 'b.jpg', top5: sampleTop5, isAnimalDetected: false, dbPath });
    const rows = listResults(2, dbPath);
    // Most recent (b.jpg) is first
    expect(rows[0].is_animal).toBe(0);
    expect(rows[1].is_animal).toBe(1);
    fs.unlinkSync(dbPath);
  });

  test('GPS coordinates are saved', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, latitude: 48.8566, longitude: 2.3522, dbPath });
    const rows = listResults(1, dbPath);
    expect(rows[0].latitude).toBeCloseTo(48.8566);
    expect(rows[0].longitude).toBeCloseTo(2.3522);
    fs.unlinkSync(dbPath);
  });

  test('latitude and longitude are null when not provided', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    const rows = listResults(1, dbPath);
    expect(rows[0].latitude).toBeNull();
    expect(rows[0].longitude).toBeNull();
    fs.unlinkSync(dbPath);
  });

  test('throws when only latitude is provided', () => {
    const dbPath = tmpDb();
    expect(() =>
      saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, latitude: 48.8, dbPath })
    ).toThrow();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  test('throws when only longitude is provided', () => {
    const dbPath = tmpDb();
    expect(() =>
      saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, longitude: 2.35, dbPath })
    ).toThrow();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  test('top1 label and score are persisted correctly', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'a.jpg', top5: sampleTop5, isAnimalDetected: true, dbPath });
    const rows = listResults(1, dbPath);
    expect(rows[0].top1_label).toBe('tabby, tabby cat');
    expect(rows[0].top1_score).toBeCloseTo(0.62);
    fs.unlinkSync(dbPath);
  });

  test('handles fewer than 5 predictions gracefully', () => {
    const dbPath = tmpDb();
    const shortTop5 = [{ label: 'cat', score: 0.9 }];
    expect(() => saveResult({ source: 'a.jpg', top5: shortTop5, isAnimalDetected: true, dbPath })).not.toThrow();
    const rows = listResults(1, dbPath);
    expect(rows[0].top2_label).toBeNull();
    fs.unlinkSync(dbPath);
  });
});

describe('listResults', () => {
  test('empty database returns empty array', () => {
    const dbPath = tmpDb();
    const results = listResults(20, dbPath);
    expect(results).toEqual([]);
    fs.unlinkSync(dbPath);
  });

  test('returns array of objects', () => {
    const dbPath = tmpDb();
    saveResult({ source: 'a.jpg', top5: [{ label: 'cat', score: 0.9 }], isAnimalDetected: true, dbPath });
    const results = listResults(20, dbPath);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    fs.unlinkSync(dbPath);
  });

  test('ordered most recent first', () => {
    const dbPath = tmpDb();
    const top5 = [{ label: 'cat', score: 0.9 }];
    saveResult({ source: 'first.jpg', top5, isAnimalDetected: true, dbPath });
    saveResult({ source: 'second.jpg', top5, isAnimalDetected: true, dbPath });
    const results = listResults(20, dbPath);
    expect(results[0].source).toBe('second.jpg');
    expect(results[1].source).toBe('first.jpg');
    fs.unlinkSync(dbPath);
  });

  test('limit parameter is respected', () => {
    const dbPath = tmpDb();
    const top5 = [{ label: 'cat', score: 0.9 }];
    for (let i = 0; i < 5; i++) {
      saveResult({ source: `img${i}.jpg`, top5, isAnimalDetected: true, dbPath });
    }
    const results = listResults(3, dbPath);
    expect(results.length).toBe(3);
    fs.unlinkSync(dbPath);
  });
});
