# Makefile — Animal Identifier
# Architecture : Python AI service + Node.js/Express backend + React/Vite frontend

.PHONY: install install-dev install-backend install-frontend \
        run-cli run-ai-service run-backend run-frontend \
        test test-python test-backend \
        build-frontend db-clear clean help

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------

## Installe les dépendances Python (production)
install:
	pip install -r requirements.txt

## Installe toutes les dépendances Python (production + développement/test)
install-dev:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

## Installe les dépendances Node.js du backend
install-backend:
	cd backend && npm install

## Installe les dépendances Node.js du frontend
install-frontend:
	cd frontend && npm install

# ---------------------------------------------------------------------------
# Exécution
# ---------------------------------------------------------------------------

## Lance l'identifieur en ligne de commande
run-cli:
	python animal_identifier.py

## Démarre le microservice IA Python (port 5001)
run-ai-service: install
	python ai_service/main.py

## Démarre le backend Node.js/Express (port 3001)
run-backend: install-backend
	cd backend && npm start

## Démarre le serveur de développement React/Vite (port 3000)
run-frontend: install-frontend
	cd frontend && npm run dev

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

## Lance tous les tests (Python + Node.js)
test: test-python test-backend

## Lance les tests Python (animal_identifier, database)
test-python: install-dev
	pytest tests/test_animal_identifier.py tests/test_database.py --tb=short

## Lance les tests Node.js du backend
test-backend: install-backend
	cd backend && npm test

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

## Compile le frontend React pour la production
build-frontend: install-frontend
	cd frontend && npm run build

# ---------------------------------------------------------------------------
# Base de données
# ---------------------------------------------------------------------------

## Vide la base de données (supprime tous les enregistrements)
db-clear:
	python -c "from database import clear_db; clear_db(); print('✅  Base de données vidée.')"

# ---------------------------------------------------------------------------
# Nettoyage
# ---------------------------------------------------------------------------

## Supprime les fichiers de build et caches
clean:
	find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true
	find . -type f -name '*.pyc' -delete 2>/dev/null || true
	rm -rf frontend/dist
	rm -rf backend/node_modules/.cache

# ---------------------------------------------------------------------------
# Aide
# ---------------------------------------------------------------------------

## Affiche cette aide
help:
	@echo "Usage: make [cible]"
	@echo ""
	@echo "Cibles disponibles :"
	@echo "  install           Installer les dépendances Python (requirements.txt)"
	@echo "  install-dev       Installer toutes les dépendances Python (+ requirements-dev.txt)"
	@echo "  install-backend   Installer les dépendances Node.js du backend"
	@echo "  install-frontend  Installer les dépendances Node.js du frontend"
	@echo "  run-cli           Lancer l'identifieur en ligne de commande"
	@echo "  run-ai-service    Démarrer le microservice IA Python (port 5001)"
	@echo "  run-backend       Démarrer le backend Node.js/Express (port 3001)"
	@echo "  run-frontend      Démarrer le serveur de développement React (port 3000)"
	@echo "  test              Lancer tous les tests (Python + Node.js)"
	@echo "  test-python       Lancer uniquement les tests Python"
	@echo "  test-backend      Lancer uniquement les tests Node.js"
	@echo "  build-frontend    Compiler le frontend React pour la production"
	@echo "  db-clear          Vider la base de données (supprimer tous les enregistrements)"
	@echo "  clean             Supprimer les fichiers de build et caches"
	@echo "  help              Afficher cette aide"
