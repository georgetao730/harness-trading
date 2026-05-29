# harness-trading — convenience commands for local dev
#
# This Makefile is a thin wrapper around pnpm + uv. Real logic lives in
# package.json scripts and pyproject.toml. CI uses pnpm/uv directly.

.PHONY: help install install-node install-py lint typecheck build test ci clean dev-gateway

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: install-node install-py ## Install all deps (Node workspaces + Python venv)

install-node: ## Install Node workspace deps
	pnpm install

install-py: ## Install Python deps via uv (creates backend/.venv)
	cd backend && uv sync --extra dev

lint: ## Lint Node (biome) + Python (ruff)
	pnpm lint
	cd backend && uv run ruff check .

typecheck: ## TypeScript typecheck across all packages
	pnpm typecheck

build: ## Build all Node packages
	pnpm build

test: ## Run Node + Python test suites
	pnpm test
	cd backend && uv run pytest

ci: lint typecheck build test ## Local replica of GitHub Actions ci pipeline

dev-gateway: ## Start Python Gateway (uvicorn, reload mode)
	cd backend && uv run uvicorn app.gateway.server:app --reload --host 127.0.0.1 --port 8765

clean: ## Remove build outputs and caches
	find packages -type d -name dist -prune -exec rm -rf {} +
	find packages -name '*.tsbuildinfo' -delete
	rm -rf node_modules/.cache backend/.venv backend/.pytest_cache backend/.ruff_cache
