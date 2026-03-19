/**
 * src/index.js
 * ------------
 * Point d'entrée du serveur Express.
 *
 * Lance l'API REST sur le port défini par la variable
 * d'environnement BACKEND_PORT (défaut : 3001).
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/analyze", analyzeRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀  Backend disponible sur http://localhost:${PORT}`);
  });
}

module.exports = app;
