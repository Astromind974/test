# 🐾 Animal Identifier

<!-- Badges -->
![GitHub last commit](https://img.shields.io/github/last-commit/Astromind974/test)
![GitHub issues](https://img.shields.io/github/issues/Astromind974/test)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Astromind974/test)
![License](https://img.shields.io/github/license/Astromind974/test)

> Identifiez des animaux dans vos photos grâce à MobileNetV2 (ImageNet).  
> Fonctionne en **ligne de commande** ou via une **application web** composée d'un frontend **React/Vite**, d'un backend **Node.js/Express** et d'un microservice IA en **Python**.

---

## 📋 Table des matières

- [À propos](#-à-propos)
- [Architecture](#-architecture)
- [Fonctionnalités](#-fonctionnalités)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Utilisation — CLI](#-utilisation--cli)
- [Utilisation — Application Web](#-utilisation--application-web)
- [API REST](#-api-rest)
- [Tests](#-tests)
- [Structure du projet](#-structure-du-projet)
- [Contribuer](#-contribuer)
- [Licence](#-licence)
- [Contact](#-contact)

---

## 📖 À propos

**Animal Identifier** est un outil d'identification d'animaux dans des images.  
Il utilise le réseau de neurones **MobileNetV2** pré-entraîné sur ImageNet (1 000 classes, dont de nombreux animaux) via TensorFlow/Keras.

Les résultats (top-5 prédictions, position GPS optionnelle) sont automatiquement sauvegardés dans une base de données **SQLite locale** (`results.db`).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│  Navigateur                                          │
│  React / Vite  (port 3000 en dev)                    │
└──────────────────┬───────────────────────────────────┘
                   │ POST /api/analyze
                   ▼
┌──────────────────────────────────────────────────────┐
│  Backend Node.js / Express  (port 3001)              │
│  • Validation et protection SSRF                     │
│  • Téléchargement des images via URL                 │
│  • Traitement parallèle                              │
└──────────────────┬───────────────────────────────────┘
                   │ POST /analyze (par image)
                   ▼
┌──────────────────────────────────────────────────────┐
│  Microservice IA Python / Flask  (port 5001)         │
│  • MobileNetV2 (TensorFlow)                          │
│  • animal_identifier.py                              │
│  • database.py (SQLite)                              │
└──────────────────────────────────────────────────────┘
```

---

## ✨ Fonctionnalités

- 🔍 **Identification d'animaux** — MobileNetV2 + filtrage par mots-clés
- 🗃️ **Sauvegarde automatique** des résultats dans SQLite (upsert : mise à jour si la source existe déjà, avec position GPS optionnelle)
- 💻 **Interface CLI** pour une utilisation rapide en terminal
- 🌐 **Application web** avec :
  - Frontend **React** (Vite) — glisser-déposer ou sélection de 1 à 10 images
  - Backend **Node.js/Express** — validation, protection SSRF, traitement parallèle
  - Microservice **Python** — MobileNetV2, base de données SQLite
  - Prévisualisation des photos avant envoi
  - Affichage des résultats avec barres de confiance par prédiction

---

## ✅ Prérequis

- [Python](https://www.python.org/) ≥ 3.10
- [Node.js](https://nodejs.org/) ≥ 18
- [Git](https://git-scm.com/) ≥ 2.x
- _(Optionnel)_ Un environnement virtuel Python (`venv`, `conda`, etc.)

---

## ⚙️ Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/Astromind974/test.git
cd test

# 2. Créer et activer un environnement virtuel Python (recommandé)
python -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# 3. Installer les dépendances Python
pip install -r requirements.txt

# 4. Installer les dépendances Node.js
make install-backend
make install-frontend

# 5. Copier et adapter les variables d'environnement
cp .env.example .env
```

> **Note** : Le modèle MobileNetV2 (~14 Mo) est téléchargé automatiquement lors du premier lancement.

---

## 🖥️ Utilisation — CLI

```bash
# Analyser une image locale
python animal_identifier.py --image chemin/vers/photo.jpg

# Analyser une image distante (URL)
python animal_identifier.py --url https://example.com/chat.jpg

# Avec position GPS
python animal_identifier.py --image photo.jpg --lat 48.8566 --lon 2.3522

# Télécharger une image d'exemple (un chat) pour tester rapidement
python download_example.py
python animal_identifier.py --image example.jpg
```

Exemple de sortie :

```
✅  Modèle chargé.

📷  Chargement de l'image : example.jpg
     Taille originale : 1200×800 px

🔍  Analyse en cours…

=== Résultats de l'identification ===
🥇  tabby                      — confiance :  62.35 %
🥈  tiger_cat                  — confiance :  18.12 %
🥉  Egyptian_cat               — confiance :   9.88 %
        Persian_cat                — confiance :   4.01 %
        lynx                       — confiance :   1.73 %

✅  Animal identifié : TABBY avec 62.35 % de confiance.
💾  Résultat sauvegardé en base de données (id=1).
```

---

## 🌐 Utilisation — Application Web

Démarrez les trois processus dans trois terminaux distincts :

```bash
# Terminal 1 — Microservice IA Python (port 5001)
make run-ai-service

# Terminal 2 — Backend Node.js (port 3001)
make run-backend

# Terminal 3 — Frontend React (port 3000)
make run-frontend
```

Puis ouvrez **http://localhost:3000** dans votre navigateur.

### Interface

1. **Sélectionnez ou glissez-déposez** de 1 à 10 images (JPG, PNG, GIF, WebP).
2. Visualisez les **aperçus miniatures** — retirez les images indésirables avec le ✕.
3. Cliquez sur **🔍 Analyser les images** — les images sont envoyées au serveur et traitées en simultané.
4. Les **résultats** s'affichent en bas de page : top-5 prédictions avec barres de confiance, badge animal / non-animal, et ID de sauvegarde en base.

Variables d'environnement disponibles (fichier `.env`) :

| Variable          | Défaut                    | Description                                  |
|-------------------|---------------------------|----------------------------------------------|
| `AI_SERVICE_PORT` | `5001`                    | Port du microservice IA Python               |
| `BACKEND_PORT`    | `3001`                    | Port du backend Node.js/Express              |
| `AI_SERVICE_URL`  | `http://localhost:5001`   | URL du microservice IA (utilisée par backend)|
| `APP_ENV`         | `development`             | `development` active le mode debug Flask     |
| `DB_PATH`         | `results.db`              | Chemin du fichier SQLite                     |

---

## 📡 API REST

### `POST /api/analyze`

Analyse de 1 à 10 images en simultané (exposé par le backend Node.js sur le port 3001).

**Requête** : `multipart/form-data`

| Champ    | Type       | Description                              |
|----------|------------|------------------------------------------|
| `images` | `File[]`   | 1 à 10 fichiers images                   |
| `urls`   | `String[]` | 1 à 10 URLs d'images (http/https)        |

> Les deux champs peuvent être combinés ; le total ne doit pas dépasser 10.

**Réponse** (`application/json`) :

```json
{
  "results": [
    {
      "filename": "chat.jpg",
      "top5": [
        { "label": "tabby", "score": 62.35 },
        { "label": "tiger cat", "score": 18.12 }
      ],
      "animal_detected": true,
      "best_label": "tabby",
      "best_score": 62.35,
      "animal_in_top5": null,
      "db_id": 1
    }
  ],
  "errors": [],
  "total": 1,
  "success_count": 1,
  "error_count": 0
}
```

**Codes de retour** :

| Code | Signification                              |
|------|--------------------------------------------|
| 200  | Analyse réussie                            |
| 400  | Aucune image fournie ou plus de 10 fichiers|
| 500  | Erreur serveur interne                     |

---

## 🧪 Tests

### Tests Python (IA)

Ces tests couvrent le module IA (`animal_identifier.py`) et la base de données (`database.py`).
Ils s'exécutent **sans TensorFlow** (le modèle est mocké).

```bash
# Installer les dépendances de test
pip install -r requirements-dev.txt

# Lancer les tests Python
make test-python
# ou directement :
pytest tests/test_animal_identifier.py tests/test_database.py --tb=short

# Avec rapport de couverture
pytest tests/test_animal_identifier.py tests/test_database.py --cov=. --cov-report=term-missing
```

### Tests Node.js (backend)

Ces tests couvrent le backend Express (routes, protection SSRF).
Le microservice IA Python est mocké via `jest.mock('axios')`.

```bash
make test-backend
# ou directement :
cd backend && npm test
```

### Lancer tous les tests

```bash
make test
```

### Vider la base de données

```bash
make db-clear
```

### Organisation des tests

| Emplacement | Module testé | Ce qui est couvert |
|---|---|---|
| `tests/test_animal_identifier.py` | `animal_identifier.py` | `is_animal`, `prepare_image` (19 tests) |
| `tests/test_database.py` | `database.py` | `init_db`, `save_result` (upsert), `list_results` (30 tests) |
| `backend/tests/ssrf.test.js` | `src/utils/ssrf.js` | Détection d'IP privées (8 tests) |
| `backend/tests/routes.test.js` | `src/routes/analyze.js` | Routes Express, validation, erreurs (11 tests) |

---

## 📁 Structure du projet

```
test/
├── ai_service/
│   └── main.py                  # Microservice IA Python (Flask, port 5001)
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js             # Point d'entrée Express (port 3001)
│   │   ├── routes/
│   │   │   └── analyze.js       # Route POST /api/analyze
│   │   └── utils/
│   │       └── ssrf.js          # Protection SSRF
│   └── tests/
│       ├── routes.test.js       # Tests routes Express (Jest)
│       └── ssrf.test.js         # Tests protection SSRF (Jest)
├── frontend/
│   ├── package.json
│   ├── vite.config.js           # Config Vite (proxy → backend)
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Interface React principale
│       └── App.css
├── tests/
│   ├── conftest.py              # Fixtures et mocks partagés (pytest)
│   ├── test_animal_identifier.py # Tests is_animal, prepare_image
│   └── test_database.py         # Tests de la couche SQLite
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   │   └── ci.yml               # Pipelines CI/CD (Python + Node.js)
│   └── PULL_REQUEST_TEMPLATE.md
├── animal_identifier.py         # Modèle MobileNetV2 + CLI
├── database.py                  # Gestion SQLite
├── download_example.py          # Télécharge une image de test
├── requirements.txt             # Dépendances Python (production)
├── requirements-dev.txt         # Dépendances de test Python (pytest)
├── pytest.ini                   # Configuration pytest
├── Makefile                     # Commandes de développement
├── .env.example                 # Exemple de configuration
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
└── README.md
```

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les instructions détaillées.

En bref :
1. Fork le projet
2. Créez votre branche (`git checkout -b feature/ma-fonctionnalite`)
3. Committez vos changements (`git commit -m 'feat: ajouter ma fonctionnalité'`)
4. Poussez la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request

---

## 📄 Licence

Ce projet est sous licence **MIT** — voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 📬 Contact

**Astromind974** — [@Astromind974](https://github.com/Astromind974)

Lien du projet : [https://github.com/Astromind974/test](https://github.com/Astromind974/test)
