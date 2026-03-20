/**
 * src/routes/locations.js
 * -----------------------
 * Route GET /api/locations
 *
 * Retourne les identifications ayant une position géographique,
 * en les récupérant depuis le service IA Python.
 */

const express = require("express");
const axios = require("axios");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

/**
 * GET /api/locations
 *
 * Sortie : JSON
 *   {
 *     "locations": [
 *       {
 *         "id": number,
 *         "source": string,
 *         "latitude": number,
 *         "longitude": number,
 *         "top1_label": string,
 *         "top1_score": number,
 *         "timestamp": string,
 *         "is_animal": number
 *       },
 *       ...
 *     ]
 *   }
 */
router.get("/", async (_req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/locations`, {
      timeout: 10000,
    });
    return res.json(response.data);
  } catch (err) {
    return res
      .status(502)
      .json({ error: `Impossible de récupérer les positions : ${err.message}` });
  }
});

module.exports = router;
