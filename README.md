# Foude

Mini webapp pour organiser les repas et les courses d'un séjour en groupe avec un vrai backend partagé et une base SQLite.

## Démarrage

```bash
npm install
npm run dev
```

`npm run dev` démarre l'API Node sur `8787` et le front Vite sur `5173` avec proxy vers `/api`.

## Données

Les données sont persistées dans `data/foude.sqlite`.

## Backups SQLite

Créer un backup immédiat :

```bash
make backup-db
```

Installer un backup automatique toutes les 5 minutes avec rétention des 10 derniers fichiers :

```bash
make backup-install-cron
```

Voir les backups disponibles :

```bash
make backup-list
```

## Build

```bash
npm run build
```

## Modèle de données

Un **repas** appartient à un jour (`Vendredi`, `Samedi`, `Dimanche`) ou au **séjour entier**
(`Séjour`, utile pour un petit-déj commun). Chaque repas porte une liste d'**ingrédients**,
et chaque ingrédient a une **provenance** (ex: grande surface, marché sur place, ramené de Paris).
La liste de courses est une vue agrégée de tous les ingrédients, regroupés par provenance.

Les provenances sont modifiables dans l'app, comme les participants.

## Migration de la base

Le script `scripts/migrate-to-ingredients.mjs` fait passer une base de l'ancien modèle
(`grocery_items`) au nouveau (`ingredients` + `provenances`). Il est **idempotent**
(relançable sans dégât) et **non destructif** (l'ancienne table est conservée, une sauvegarde
`.bak-<timestamp>` est créée avant écriture). Les anciens articles de courses actifs sont repris
dans un repas « Courses diverses » rattaché au séjour.

```bash
# Aperçu sans écriture
make migrate-db-dry                              # sur data/foude.sqlite
make migrate-db-dry DB=prod-snapshot/foude.sqlite

# Migration réelle
make migrate-db DB=prod-snapshot/foude.sqlite
```

## Backups SQLite

(voir plus haut — `make backup-db`, `make backup-list`, `make backup-install-cron`.)

## Déploiement VPS simple

La version la plus sobre consiste à lancer un seul conteneur Node sur un VPS, avec la base SQLite persistée dans `./data`.

```bash
docker compose up -d --build
```

Par défaut l'app écoute sur `http://localhost:3000`. Sur le VPS, place un reverse proxy HTTPS devant ce port si tu veux exposer le site proprement.

### Runbook : déployer une mise à jour avec migration de schéma

Procédure suivie pour la migration vers le modèle ingrédients (le code crée déjà les nouvelles
tables au démarrage ; le script ne sert qu'à **récupérer les anciennes données**).

```bash
# 1. Rapatrier et valider la base de prod EN LOCAL d'abord (rien n'est touché côté prod)
mkdir -p prod-snapshot
scp <vps>:/chemin/foude/data/foude.sqlite prod-snapshot/foude.sqlite
make migrate-db-dry DB=prod-snapshot/foude.sqlite   # aperçu
make migrate-db DB=prod-snapshot/foude.sqlite       # migre la copie locale
# (copier prod-snapshot/foude.sqlite -> data/ et `npm run dev` pour vérifier visuellement)

# 2. Pousser le code
git push origin main

# 3. Sur le VPS : backup, migration, déploiement du code, redémarrage
ssh <vps>
cd <chemin>/foude
cp data/foude.sqlite backups/db/foude-premigration-$(date +%Y%m%d-%H%M%S).sqlite
docker cp scripts/migrate-to-ingredients.mjs foude:/app/migrate.mjs   # le conteneur ne contient pas scripts/
docker exec foude node migrate.mjs /app/data/foude.sqlite --dry-run   # aperçu
docker exec foude node migrate.mjs /app/data/foude.sqlite             # migration réelle
docker exec foude rm -f migrate.mjs
git fetch origin && git reset --hard origin/main                      # aligner le code
docker compose up -d --build                                          # rebuild + relire la base

# 4. Vérifier
curl -s https://<domaine>/api/health
curl -s https://<domaine>/api/state | head
```
