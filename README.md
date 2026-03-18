# Identification d'animaux sur une image 🐾

Ce projet montre **étape par étape** comment créer un programme Python qui identifie automatiquement un animal présent dans une image, en utilisant un modèle de deep learning pré-entraîné.

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Installation](#2-installation)
3. [Structure du projet](#3-structure-du-projet)
4. [Comment ça marche ?](#4-comment-ça-marche-)
5. [Utilisation](#5-utilisation)
6. [Exemple de résultat](#6-exemple-de-résultat)
7. [Aller plus loin](#7-aller-plus-loin)

---

## 1. Prérequis

- Python 3.8 ou supérieur
- `pip` (gestionnaire de paquets Python)
- Une connexion Internet pour télécharger le modèle la première fois

---

## 2. Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/Astromind974/test.git
cd test

# 2. (Optionnel) Créer un environnement virtuel
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows

# 3. Installer les dépendances
pip install -r requirements.txt
```

---

## 3. Structure du projet

```
test/
├── README.md                 ← ce fichier
├── requirements.txt          ← dépendances Python
├── animal_identifier.py      ← programme principal
└── download_example.py       ← télécharge une image de test
```

---

## 4. Comment ça marche ?

Le programme utilise **MobileNetV2**, un réseau de neurones convolutif léger pré-entraîné sur **ImageNet** (1 000 classes dont des dizaines d'animaux : chien, chat, lion, éléphant, etc.).

Voici les grandes étapes internes :

```
Image (fichier ou URL)
        │
        ▼
  Chargement & Redimensionnement (224×224 px)
        │
        ▼
  Prétraitement (normalisation des pixels)
        │
        ▼
  Passage dans MobileNetV2 (inférence)
        │
        ▼
  Décodage des 5 meilleures prédictions
        │
        ▼
  Affichage du résultat avec le score de confiance
```

---

## 5. Utilisation

### Identifier un animal à partir d'un fichier local

```bash
python animal_identifier.py --image chemin/vers/image.jpg
```

### Identifier un animal à partir d'une URL

```bash
python animal_identifier.py --url https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg
```

### Télécharger une image d'exemple et la tester

```bash
python download_example.py
python animal_identifier.py --image example.jpg
```

---

## 6. Exemple de résultat

```
=== Résultats de l'identification ===
🥇  tabby_cat           — confiance : 72.34 %
🥈  Egyptian_cat        — confiance : 14.12 %
🥉  tiger_cat           — confiance :  8.56 %
     Persian_cat        — confiance :  2.14 %
     lynx               — confiance :  0.87 %

✅  Animal identifié : CHAT (tabby_cat) avec 72.34 % de confiance.
```

---

## 7. Aller plus loin

| Amélioration | Piste |
|---|---|
| Meilleure précision | Utiliser EfficientNetV2 ou un modèle fine-tuné sur des images d'animaux |
| Interface web | Ajouter Flask ou FastAPI pour exposer une API REST |
| Interface graphique | Utiliser Gradio ou Streamlit pour une UI web simple |
| Détection multiple | Utiliser YOLOv8 pour détecter plusieurs animaux dans la même image |
| Déploiement cloud | Containeriser avec Docker et déployer sur AWS / GCP / Azure |

---

> **Note** : Le modèle MobileNetV2 reconnaît les classes ImageNet. Il est très performant pour les animaux courants (chiens, chats, oiseaux, etc.) mais ne couvrira pas toutes les espèces exotiques.
