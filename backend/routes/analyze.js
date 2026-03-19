'use strict';
const express = require('express');
const multer = require('multer');
const dns = require('dns').promises;
const https = require('https');
const http = require('http');

const { isAnimal, classifyImage } = require('../services/animalIdentifier');
const { saveResult } = require('../services/database');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

async function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname) return false;

    const { address } = await dns.lookup(hostname, { family: 4 });
    const parts = address.split('.').map(Number);
    if (parts.length !== 4) return false;
    // 10.0.0.0/8
    if (parts[0] === 10) return false;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return false;
    // 127.0.0.0/8 loopback
    if (parts[0] === 127) return false;
    // 169.254.0.0/16 link-local
    if (parts[0] === 169 && parts[1] === 254) return false;
    // 0.0.0.0/8
    if (parts[0] === 0) return false;
    // 100.64.0.0/10 shared address space
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;
    // 192.0.0.0/24 IETF protocol
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return false;
    // 240.0.0.0/4 reserved
    if (parts[0] >= 240) return false;
    // 224.0.0.0/4 multicast
    if (parts[0] >= 224 && parts[0] <= 239) return false;
    return true;
  } catch {
    return false;
  }
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http;
    const req = protocol.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        reject(new Error(`L'URL ne pointe pas vers une image (Content-Type: ${contentType})`));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_IMAGE_SIZE) {
          req.destroy();
          reject(new Error("L'image dépasse la taille maximale autorisée (10 Mo)"));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function analyzeImage(imageBuffer, filename) {
  const predictions = await classifyImage(imageBuffer);

  const top5 = predictions.slice(0, 5);
  const bestPrediction = top5[0];
  const animalDetected = isAnimal(bestPrediction.label);

  let animalInTop5 = null;
  if (!animalDetected) {
    const found = top5.find(p => isAnimal(p.label));
    if (found) {
      animalInTop5 = { label: found.label, score: Math.round(found.score * 10000) / 100 };
    }
  }

  const dbId = saveResult({
    source: filename,
    top5: top5.map(p => ({ label: p.label, score: p.score })),
    isAnimalDetected: animalDetected,
  });

  const top5Result = animalDetected
    ? top5.map(p => ({ label: p.label, score: Math.round(p.score * 10000) / 100 }))
    : [];

  return {
    filename,
    top5: top5Result,
    animal_detected: animalDetected,
    best_label: bestPrediction.label,
    best_score: Math.round(bestPrediction.score * 10000) / 100,
    animal_in_top5: animalInTop5,
    db_id: dbId,
  };
}

router.post('/analyze', upload.array('images', 10), async (req, res) => {
  const files = req.files || [];
  const urlsRaw = req.body.urls || '';
  const urls = (Array.isArray(urlsRaw) ? urlsRaw : [urlsRaw])
    .flatMap(u => u.split(/[\n\s]+/))
    .map(u => u.trim())
    .filter(Boolean);

  if (files.length === 0 && urls.length === 0) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }
  if (files.length + urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 images autorisées par requête.' });
  }

  const imageItems = files.map(f => ({ buffer: f.buffer, name: f.originalname }));

  for (const url of urls) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: `URL invalide (seuls http/https sont autorisés) : ${url}` });
    }
    const safe = await isSafeUrl(url);
    if (!safe) {
      return res.status(400).json({ error: `URL non autorisée (adresse privée ou invalide) : ${url}` });
    }
    try {
      const buffer = await downloadImage(url);
      imageItems.push({ buffer, name: url });
    } catch (err) {
      return res.status(400).json({ error: `Erreur lors du téléchargement de ${url} : ${err.message}` });
    }
  }

  const results = [];
  const errors = [];

  await Promise.all(imageItems.map(async ({ buffer, name }) => {
    try {
      const result = await analyzeImage(buffer, name);
      results.push(result);
    } catch (err) {
      errors.push({ filename: name, error: err.message });
    }
  }));

  results.sort((a, b) => a.filename.localeCompare(b.filename));
  errors.sort((a, b) => a.filename.localeCompare(b.filename));

  return res.json({
    results,
    errors,
    total: results.length + errors.length,
    success_count: results.length,
    error_count: errors.length,
  });
});

module.exports = router;
