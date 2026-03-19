'use strict';
const request = require('supertest');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Mock the animalIdentifier service BEFORE loading the app
jest.mock('../services/animalIdentifier', () => ({
  isAnimal: jest.fn((label) => label.toLowerCase().includes('cat') || label.toLowerCase().includes('dog')),
  classifyImage: jest.fn().mockResolvedValue([
    { label: 'tabby, tabby cat', score: 0.62 },
    { label: 'tiger cat', score: 0.18 },
    { label: 'Egyptian cat', score: 0.09 },
    { label: 'lynx', score: 0.04 },
    { label: 'Pomeranian', score: 0.02 },
  ]),
  loadModel: jest.fn().mockResolvedValue({}),
  setModel: jest.fn(),
  ANIMAL_KEYWORDS: new Set(['cat', 'dog']),
}));

// Use a temp DB to avoid polluting production data
const tmpDbPath = path.join(os.tmpdir(), `test_analyze_${Date.now()}.db`);
process.env.DB_PATH = tmpDbPath;

const app = require('../server');

afterAll(() => {
  try { fs.unlinkSync(tmpDbPath); } catch {}
});

// Minimal valid 1×1 pixel PNG buffer
function makeTestImage() {
  return Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001' +
    '08020000009001' + '2e0000000c4944415408d76360f8cfc0000000020001' +
    '9e221bc60000000049454e44ae426082',
    'hex'
  );
}

describe('GET /', () => {
  test('returns 404 when frontend is not built', async () => {
    const res = await request(app).get('/');
    // 200 if build exists, 404 if not (CI environment)
    expect([200, 404]).toContain(res.status);
  });
});

describe('POST /api/analyze — input validation', () => {
  test('no images returns 400 with error message', async () => {
    const res = await request(app).post('/api/analyze');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('empty form body returns 400', async () => {
    const res = await request(app).post('/api/analyze').send({});
    expect(res.status).toBe(400);
  });

  test('invalid URL scheme (ftp://) returns 400', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .field('urls', 'ftp://example.com/cat.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/http\/https/);
  });

  test('private IP (192.168.x.x) is blocked with 400', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .field('urls', 'http://192.168.1.1/cat.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autorisée/);
  });

  test('loopback IP (127.0.0.1) is blocked with 400', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .field('urls', 'http://127.0.0.1/image.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autorisée/);
  });

  test('link-local IP (169.254.x.x) is blocked with 400', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .field('urls', 'http://169.254.169.254/image.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non autorisée/);
  });
});

describe('POST /api/analyze — success path', () => {
  test('single uploaded image returns 200', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'test.png');
    expect(res.status).toBe(200);
  });

  test('response contains all required top-level keys', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'test.png');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('errors');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('success_count');
    expect(res.body).toHaveProperty('error_count');
  });

  test('result item contains all required fields', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'test.png');
    expect(res.body.results.length).toBeGreaterThan(0);
    const result = res.body.results[0];
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('top5');
    expect(result).toHaveProperty('animal_detected');
    expect(result).toHaveProperty('best_label');
    expect(result).toHaveProperty('best_score');
    expect(result).toHaveProperty('animal_in_top5');
    expect(result).toHaveProperty('db_id');
  });

  test('total equals success_count + error_count', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'test.png');
    expect(res.body.total).toBe(res.body.success_count + res.body.error_count);
  });

  test('animal_detected is true for mocked cat predictions', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'cat.png');
    const result = res.body.results[0];
    expect(result.animal_detected).toBe(true);
  });

  test('top5 array is populated when animal is detected', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'cat.png');
    const result = res.body.results[0];
    expect(Array.isArray(result.top5)).toBe(true);
    expect(result.top5.length).toBeGreaterThan(0);
    expect(result.top5[0]).toHaveProperty('label');
    expect(result.top5[0]).toHaveProperty('score');
  });

  test('db_id is a positive integer', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'test.png');
    expect(typeof res.body.results[0].db_id).toBe('number');
    expect(res.body.results[0].db_id).toBeGreaterThanOrEqual(1);
  });

  test('multiple images return multiple results', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('images', makeTestImage(), 'img1.png')
      .attach('images', makeTestImage(), 'img2.png');
    expect(res.body.total).toBe(2);
    expect(res.body.success_count).toBe(2);
  });
});
