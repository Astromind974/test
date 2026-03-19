# Makefile for Animal Identifier CLI & Flask Web App

.PHONY: install run-cli run-webapp test clean help

# Target to install dependencies
install:
	pip install -r requirements.txt

# Target to run the animal identifier CLI
run-cli:
	python cli.py

# Target to launch the Flask web app
run-webapp:
	flask run

# Target to run tests
test:
	pytest

# Target to clean up build files
clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name '*.pyc' -delete

# Target to display help
help:
	@echo "Usage: make [target]"
	@echo "Available targets:"
	@echo "  install        Install dependencies"
	@echo "  run-cli       Run the animal identifier CLI"
	@echo "  run-webapp    Launch the Flask web app"
	@echo "  test          Run tests"
	@echo "  clean         Clean up build files"
	@echo "  help          Display this help message"