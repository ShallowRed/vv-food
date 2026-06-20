SHELL := /bin/bash

BACKUP_KEEP ?= 10

.PHONY: help install dev build start preview clean docker-build docker-up docker-down docker-logs reset-db test
.PHONY: backup-db backup-list backup-install-cron backup-uninstall-cron migrate-db migrate-db-dry

help:
	@printf "Foude commands\n"
	@printf "  make install      Install dependencies\n"
	@printf "  make dev          Start frontend + API in dev\n"
	@printf "  make build        Build production assets\n"
	@printf "  make test         Run the test suite\n"
	@printf "  make start        Start the production server\n"
	@printf "  make preview      Preview the built frontend\n"
	@printf "  make docker-up    Start the Docker stack\n"
	@printf "  make docker-down  Stop the Docker stack\n"
	@printf "  make docker-logs  Follow container logs\n"
	@printf "  make reset-db     Remove the local SQLite file\n"
	@printf "  make backup-db    Create a SQLite backup now\n"
	@printf "  make backup-list  List available backups\n"
	@printf "  make backup-install-cron  Install a backup every 5 minutes (keep $(BACKUP_KEEP))\n"
	@printf "  make backup-uninstall-cron Remove the installed backup cron\n"
	@printf "  make migrate-db [DB=path]      Migrate a SQLite base to the ingredients model\n"
	@printf "  make migrate-db-dry [DB=path]  Dry-run the migration (no write)\n"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

start:
	npm run start

preview:
	npm run preview

clean:
	rm -rf dist

docker-build:
	docker compose build

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

reset-db:
	rm -f data/foude.sqlite

backup-db:
	BACKUP_KEEP=$(BACKUP_KEEP) ./scripts/backup-db.sh

backup-list:
	@ls -1t backups/db/*.sqlite 2>/dev/null || echo "Aucun backup disponible"

backup-install-cron:
	@mkdir -p backups/db
	@CRON_LINE="*/5 * * * * cd $(PWD) && BACKUP_KEEP=$(BACKUP_KEEP) ./scripts/backup-db.sh >> $(PWD)/backups/db/backup.log 2>&1"; \
	(TMPFILE=$$(mktemp) && crontab -l 2>/dev/null | grep -Fv "./scripts/backup-db.sh" > $$TMPFILE && echo "$$CRON_LINE" >> $$TMPFILE && crontab $$TMPFILE && rm -f $$TMPFILE); \
	echo "Cron installé: backup toutes les 5 minutes, rétention $(BACKUP_KEEP)"

backup-uninstall-cron:
	@(TMPFILE=$$(mktemp) && crontab -l 2>/dev/null | grep -Fv "./scripts/backup-db.sh" > $$TMPFILE && crontab $$TMPFILE && rm -f $$TMPFILE)
	@echo "Cron backup supprimé"

# Migration vers le modèle ingrédients/provenances.
# DB par défaut: la base locale. Override: make migrate-db DB=prod-snapshot/foude.sqlite
DB ?= data/foude.sqlite

migrate-db:
	node scripts/migrate-to-ingredients.mjs $(DB)

migrate-db-dry:
	node scripts/migrate-to-ingredients.mjs $(DB) --dry-run