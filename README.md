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

## Déploiement VPS simple

La version la plus sobre consiste à lancer un seul conteneur Node sur un VPS, avec la base SQLite persistée dans `./data`.

```bash
docker compose up -d --build
```

Par défaut l'app écoute sur `http://localhost:3000`. Sur le VPS, place un reverse proxy HTTPS devant ce port si tu veux exposer le site proprement.
