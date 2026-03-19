# 🐾 Animal Identifier

<!-- Badges -->
![GitHub last commit](https://img.shields.io/github/last-commit/Astromind974/test)
![GitHub issues](https://img.shields.io/github/issues/Astromind974/test)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Astromind974/test)
![License](https://img.shields.io/github/license/Astromind974/test)

> Identifiez des animaux dans vos photos grâce à MobileNetV2 (ImageNet).  
> Fonctionne en **ligne de commande** ou via une **application web** permettant l'envoi de 1 à 10 images en simultané.

---

## 📋 Table des matières

- [À propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Utilisation — CLI](#-utilisation--cli)
- [Utilisation — Application Web](#-utilisation--application-web)
- [API REST](#-api-rest)
- [Structure du projet](#-structure-du-projet)
- [Contribuer](#-contribuer)
- [Licence](#-licence)
- [Contact](#-contact)

---

## 📖 À propos

**Animal Identifier** est un outil Python d'identification d'animaux dans des images.  
Il utilise le réseau de neurones **MobileNetV2** pré-entraîné sur ImageNet (1 000 classes, dont de nombreux animaux) via TensorFlow/Keras.

Les résultats (top-5 prédictions, position GPS optionnelle) sont automatiquement sauvegardés dans une base de données **SQLite locale** (`results.db`).

---

## ✨ Fonctionnalités

- 🔍 **Identification d'animaux** — MobileNetV2 + filtrage par mots-clés
- 🗃️ **Sauvegarde automatique** des résultats dans SQLite (avec position GPS optionnelle)
- 💻 **Interface CLI** pour une utilisation rapide en terminal
- 🌐 **Application web** avec :
  - Glisser-déposer ou sélection de **1 à 10 images simultanées**
  - Prévisualisation des photos avant envoi
  - Traitement **en parallèle** côté serveur
  - Affichage des résultats avec barres de confiance par prédiction

---

## ✅ Prérequis

- [Python](https://www.python.org/) ≥ 3.10
- [Git](https://git-scm.com/) ≥ 2.x
- _(Optionnel)_ Un environnement virtuel Python (`venv`, `conda`, etc.)

---

## ⚙️ Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/Astromind974/test.git
cd test

# 2. Créer et activer un environnement virtuel (recommandé)
python -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Copier et adapter les variables d'environnement
cp .env.example .env
# Éditez .env si vous souhaitez changer le port ou le chemin de la base
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

```bash
# Lancer le serveur Flask
python app.py
```

Puis ouvrez **http://localhost:5000** dans votre navigateur.

### Interface

1. **Sélectionnez ou glissez-déposez** de 1 à 10 images (JPG, PNG, GIF, WebP).
2. Visualisez les **aperçus miniatures** — retirez les images indésirables avec le ✕.
3. Cliquez sur **🔍 Analyser les images** — les images sont envoyées au serveur et traitées en simultané.
4. Les **résultats** s'affichent en bas de page : top-5 prédictions avec barres de confiance, badge animal / non-animal, et ID de sauvegarde en base.

Variables d'environnement disponibles (fichier `.env`) :

| Variable  | Défaut        | Description                            |
|-----------|---------------|----------------------------------------|
| `APP_PORT`| `5000`        | Port d'écoute du serveur Flask         |
| `APP_ENV` | `development` | `development` active le mode debug     |
| `DB_PATH` | `results.db`  | Chemin du fichier SQLite               |

---

## 📡 API REST

### `POST /api/analyze`

Analyse de 1 à 10 images en simultané.

**Requête** : `multipart/form-data`

| Champ    | Type       | Description                              |
|----------|------------|------------------------------------------|
| `images` | `File[]`   | 1 à 10 fichiers images                   |

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

## 📁 Structure du projet

```
test/
├── templates/
│   └── index.html           # Interface web (HTML/CSS/JS)
├── .github/
│   ├── ISSUE_TEMPLATE/      # Modèles d'issues
│   ├── workflows/           # Pipelines CI/CD
│   └── PULL_REQUEST_TEMPLATE.md
├── animal_identifier.py     # Modèle MobileNetV2 + CLI
├── app.py                   # Serveur Flask (application web)
├── database.py              # Gestion SQLite
├── download_example.py      # Télécharge une image de test
├── requirements.txt         # Dépendances Python
├── .env.example             # Exemple de configuration
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

