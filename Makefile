# Makefile for Animal Identifier CLI & Flask Web App

.PHONY: install install-dev run-cli run-webapp test clean help

# Target to install production dependencies
install:
	pip install -r requirements.txt

# Target to install all dependencies (production + development/test)
install-dev:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

# Target to run the animal identifier CLI
run-cli:
	python animal_identifier.py

# Target to launch the Flask web app
run-webapp:
	python app.py

# Target to run tests (installs dev dependencies first)
test: install-dev
	pytest

# Target to clean up build files
clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name '*.pyc' -delete

# Target to display help
help:
	@echo "Usage: make [target]"
	@echo "Available targets:"
	@echo "  install        Install production dependencies (requirements.txt)"
	@echo "  install-dev    Install all dependencies (requirements.txt + requirements-dev.txt)"
	@echo "  run-cli        Run the animal identifier CLI (animal_identifier.py)"
	@echo "  run-webapp     Launch the Flask web app (app.py)"
	@echo "  test           Install dev dependencies then run tests with pytest"
	@echo "  clean          Clean up build files (__pycache__, *.pyc)"
	@echo "  help           Display this help message"