# Makefile for Animal Identifier (React + Node.js)

.PHONY: install install-dev run-backend run-frontend run test clean help

# Install all dependencies
install:
	cd backend && npm install
	cd frontend && npm install

# Same as install (no separate dev deps needed)
install-dev: install

# Run the Node.js backend
run-backend:
	cd backend && npm start

# Run the React frontend development server
run-frontend:
	cd frontend && npm run dev

# Run both backend (default entry point)
run: run-backend

# Run backend tests
test:
	cd backend && npm test

# Clean build artifacts and node_modules
clean:
	rm -rf frontend/build
	rm -rf backend/node_modules frontend/node_modules

# Help
help:
	@echo "Usage: make [target]"
	@echo "Available targets:"
	@echo "  install       Install all dependencies"
	@echo "  run-backend   Start the Node.js backend (http://localhost:5000)"
	@echo "  run-frontend  Start the React development server (http://localhost:3000)"
	@echo "  test          Run backend tests (Jest)"
	@echo "  clean         Remove build artifacts and node_modules"
	@echo "  help          Display this help message"