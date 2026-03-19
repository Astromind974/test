'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const analyzeRouter = require('./routes/analyze');

const app = express();
const PORT = process.env.APP_PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve React static build in production
const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
const frontendExists = fs.existsSync(frontendBuild);
const indexPath = path.join(frontendBuild, 'index.html');
// Pre-read index.html at startup to avoid per-request file system access
const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : null;

if (frontendExists) {
  app.use(express.static(frontendBuild));
}

// API routes
app.use('/api', analyzeRouter);

// Catch-all: serve React app for non-API routes (if build exists)
app.get('*', (req, res) => {
  if (indexHtml) {
    res.type('html').send(indexHtml);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run: cd frontend && npm run build' });
  }
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐  Application disponible sur http://localhost:${PORT}`);
  });
}

module.exports = app;
