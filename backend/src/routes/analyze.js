/**
 * src/routes/analyze.js
 * ----------------------
 * Route POST /api/analyze
 *
 * Accepte de 1 à 10 images (fichiers ou URLs), les envoie au service
 * Python IA et agrège les résultats.
 */

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { isSafeUrl } = require("../utils/ssrf");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo

// Multer : stockage en mémoire pour transmission au service IA
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
});

/**
 * Envoie des données d'image (Buffer + nom) au service IA Python
 * et retourne le résultat d'analyse.
 *
 * @param {Buffer} buffer    - Contenu binaire de l'image
 * @param {string} filename  - Nom de fichier utilisé comme source
 * @param {string|null} latitude  - Latitude GPS (optionnel)
 * @param {string|null} longitude - Longitude GPS (optionnel)
 * @returns {Promise<object>} Résultat d'analyse
 */
async function analyzeWithAI(buffer, filename, latitude, longitude) {
  const form = new FormData();
  form.append("image", buffer, { filename, contentType: "application/octet-stream" });
  form.append("filename", filename);
  if (latitude != null && latitude !== "") form.append("latitude", String(latitude));
  if (longitude != null && longitude !== "") form.append("longitude", String(longitude));

  const response = await axios.post(`${AI_SERVICE_URL}/analyze`, form, {
    headers: form.getHeaders(),
    maxContentLength: MAX_IMAGE_SIZE * 2,
    timeout: 60000,
  });
  return response.data;
}

/**
 * POST /api/analyze
 *
 * Entrée : multipart/form-data
 *   - images : fichier(s) image (0 à 10)
 *   - urls   : URL(s) d'images (0 à 10) ; http/https uniquement
 *
 * Sortie : JSON
 *   {
 *     results: [...],
 *     errors: [...],
 *     total: number,
 *     success_count: number,
 *     error_count: number
 *   }
 */
// Wrapper pour gérer les erreurs Multer et renvoyer 400
function multerMiddleware(req, res, next) {
  upload.array("images", MAX_IMAGES)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

router.post("/", multerMiddleware, async (req, res) => {
  const files = req.files || [];
  const body = req.body || {};
  const rawUrls = body.urls
    ? (Array.isArray(req.body.urls) ? req.body.urls : [req.body.urls])
    : [];
  const urls = rawUrls.map((u) => u.trim()).filter(Boolean);

  // Coordonnées GPS optionnelles (applicables à toutes les images de la requête)
  const latitude = body.latitude ?? null;
  const longitude = body.longitude ?? null;

  if (files.length + urls.length === 0) {
    return res.status(400).json({ error: "Aucune image fournie." });
  }

  if (files.length + urls.length > MAX_IMAGES) {
    return res
      .status(400)
      .json({ error: "Maximum 10 images autorisées par requête." });
  }

  // Collecte des buffers : fichiers + URLs
  const imageData = files.map((f) => ({ buffer: f.buffer, filename: f.originalname }));

  for (const url of urls) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return res.status(400).json({
        error: `URL invalide (seuls http/https sont autorisés) : ${url}`,
      });
    }

    const safe = await isSafeUrl(url);
    if (!safe) {
      return res.status(400).json({
        error: `URL non autorisée (adresse privée ou invalide) : ${url}`,
      });
    }

    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15000,
        maxContentLength: MAX_IMAGE_SIZE,
      });

      const contentType = response.headers["content-type"] || "";
      if (!contentType.startsWith("image/")) {
        return res.status(400).json({
          error: `L'URL ne pointe pas vers une image (Content-Type: ${contentType}) : ${url}`,
        });
      }

      imageData.push({ buffer: Buffer.from(response.data), filename: url });
    } catch (err) {
      return res
        .status(400)
        .json({ error: `Erreur lors du téléchargement de ${url} : ${err.message}` });
    }
  }

  // Traitement parallèle de toutes les images
  const results = [];
  const errors = [];

  await Promise.all(
    imageData.map(async ({ buffer, filename }) => {
      try {
        const result = await analyzeWithAI(buffer, filename, latitude, longitude);
        results.push(result);
      } catch (err) {
        errors.push({ filename, error: err.message });
      }
    })
  );

  // Tri alphabétique pour un affichage cohérent
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
