# Déploiement & infrastructure de Foude

Toutes les coordonnées et commandes pour opérer la prod. **Rien à chercher ailleurs.**

## Coordonnées prod

| Élément              | Valeur                                              |
| -------------------- | --------------------------------------------------- |
| Hôte SSH             | `vps.lucaspoulain.com` (alias SSH, pas de user requis) |
| URL publique         | https://foude.lucaspoulain.com                      |
| Répertoire du projet | `/root/foude` (clone de `github.com/ShallowRed/foude`) |
| Conteneur Docker     | `foude` (image `foude-foude`, port hôte `3000`)     |
| Base SQLite (hôte)   | `/root/foude/data/foude.sqlite`                     |
| Base SQLite (conteneur) | `/app/data/foude.sqlite` (volume `./data:/app/data`) |
| Backups              | `/root/foude/backups/db/`                           |

### Reverse proxy

Le HTTPS est géré par le **Caddy de l'infra `shallowred-garden`** (repo séparé, sur le
même VPS), via :

```
foude.lucaspoulain.com {
    reverse_proxy host.docker.internal:3000
}
```

Foude n'a donc **pas** besoin de gérer TLS : il expose juste le port `3000` sur l'hôte,
et Caddy (conteneur voisin) route le domaine vers lui. Si tu changes le port, mets à jour
le Caddyfile de `shallowred-garden` (`vps/Caddyfile`).

## CI

`.github/workflows/ci.yml` lance **build + tests** sur chaque push/PR vers `main`
(Node 24, `npm ci && npm run build && npm test`). À garder vert avant de déployer.

## Déploiement standard (sans changement de schéma)

L'historique git local, GitHub et prod sont alignés → simple fast-forward.

```bash
# En local
make test && git push origin main

# Sur la prod
make deploy        # = pull --ff-only + docker compose up -d --build, à distance
```

Ou manuellement :

```bash
ssh vps.lucaspoulain.com 'cd /root/foude && git pull --ff-only origin main && docker compose up -d --build'
```

Vérifier :

```bash
make prod-health   # curl /api/health
make prod-logs     # logs du conteneur
```

## Déploiement avec migration de schéma

Voir le runbook complet dans [README.md](README.md#runbook--déployer-une-mise-à-jour-avec-migration-de-schéma).
Résumé : valider la migration en local sur une copie de la prod, sauvegarder la base prod,
exécuter `scripts/migrate-to-ingredients.mjs` via `docker exec`, puis déployer le code.

## Backup manuel de la base prod

```bash
make prod-backup   # cp horodaté dans /root/foude/backups/db/ côté VPS
```

## Récupérer la base prod en local (pour debug / test de migration)

```bash
make prod-pull-db  # scp prod -> prod-snapshot/foude.sqlite (gitignored)
```

## Rollback rapide

```bash
# Revenir au commit précédent et reconstruire
ssh vps.lucaspoulain.com 'cd /root/foude && git reset --hard HEAD~1 && docker compose up -d --build'

# Restaurer une base depuis un backup
ssh vps.lucaspoulain.com 'cd /root/foude && cp backups/db/<fichier>.sqlite data/foude.sqlite && docker compose restart'
```
