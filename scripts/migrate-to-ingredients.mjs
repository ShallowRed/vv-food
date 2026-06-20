// Migration "smooth" de l'ancien schéma (meals + grocery_items) vers le nouveau
// (meals + ingredients + provenances).
//
// - Idempotente : relançable sans dégât (ne re-migre pas deux fois).
// - Non destructive : grocery_items est conservé tel quel (rollback possible).
//   Les articles non archivés sont COPIÉS en ingrédients rattachés à un repas
//   fourre-tout "Courses diverses" (day = Séjour).
//
// Usage:
//   node scripts/migrate-to-ingredients.mjs <chemin.sqlite>
//   node scripts/migrate-to-ingredients.mjs <chemin.sqlite> --dry-run
//
// Toujours faire une copie de sauvegarde avant (le script en crée une .bak-<ts>).

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { default: initSqlJs } = await import('sql.js');

const STAY_DAY = 'Séjour';
const CATCH_ALL_TITLE = 'Courses diverses';
const DEFAULT_PROVENANCE = 'Grande surface';
const DEFAULT_PROVENANCES = ['Grande surface', 'Marché sur place', 'Ramené de Paris'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbPath = resolve(args.find((arg) => !arg.startsWith('--')) ?? '');

if (!dbPath || !existsSync(dbPath)) {
  console.error('Usage: node scripts/migrate-to-ingredients.mjs <chemin.sqlite> [--dry-run]');
  console.error(`Base introuvable: ${dbPath}`);
  process.exit(1);
}

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(dbPath));

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

function tableExists(name) {
  return Boolean(one("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [name]));
}

const log = (...a) => console.log(...a);

log(`\nMigration de: ${dbPath}${dryRun ? '  [DRY-RUN]' : ''}`);

// 1) Créer les tables cibles si absentes ------------------------------------
db.run(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    quantity TEXT NOT NULL,
    provenance TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (meal_id) REFERENCES meals(id)
  );
`);
db.run(`
  CREATE TABLE IF NOT EXISTS provenances (
    position INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

// 2) Seeder les provenances par défaut si la table est vide -----------------
const provenanceCount = Number(one('SELECT COUNT(*) AS c FROM provenances')?.c ?? 0);
if (provenanceCount === 0) {
  log(`  + provenances par défaut: ${DEFAULT_PROVENANCES.join(', ')}`);
  const stmt = db.prepare('INSERT INTO provenances (name) VALUES (?)');
  DEFAULT_PROVENANCES.forEach((name) => stmt.run([name]));
  stmt.free();
} else {
  log(`  = provenances déjà présentes (${provenanceCount}), inchangé`);
}

// 3) Migrer grocery_items -> ingrédients (idempotent) -----------------------
let migratedCount = 0;
let catchAllMealId = null;

if (!tableExists('grocery_items')) {
  log('  = pas de table grocery_items, rien à migrer');
} else {
  // Garde-fou idempotence : si un repas fourre-tout existe déjà, on considère
  // la migration des courses comme déjà faite.
  const existing = one('SELECT id FROM meals WHERE title = ? AND day = ?', [CATCH_ALL_TITLE, STAY_DAY]);

  if (existing) {
    log(`  = repas "${CATCH_ALL_TITLE}" déjà présent (id ${existing.id}), migration des courses déjà effectuée`);
  } else {
    const items = all(
      'SELECT label, quantity, assigned_to, done FROM grocery_items WHERE archived = 0 ORDER BY id ASC',
    );

    if (items.length === 0) {
      log('  = aucun article de courses actif à migrer');
    } else {
      // Créer le repas fourre-tout
      if (!dryRun) {
        const mealStmt = db.prepare('INSERT INTO meals (day, slot, title, note, owner) VALUES (?, ?, ?, ?, ?)');
        mealStmt.run([STAY_DAY, 'Déj', CATCH_ALL_TITLE, 'Articles repris de l’ancienne liste de courses.', 'Groupe']);
        mealStmt.free();
        catchAllMealId = Number(one('SELECT last_insert_rowid() AS id')?.id);

        const ingStmt = db.prepare(
          'INSERT INTO ingredients (meal_id, label, quantity, provenance, done) VALUES (?, ?, ?, ?, ?)',
        );
        items.forEach((item) => {
          ingStmt.run([
            catchAllMealId,
            String(item.label),
            String(item.quantity || '1'),
            DEFAULT_PROVENANCE,
            Number(item.done) === 1 ? 1 : 0,
          ]);
        });
        ingStmt.free();
      }
      migratedCount = items.length;
      log(`  + repas "${CATCH_ALL_TITLE}" + ${migratedCount} ingrédient(s) migré(s) (provenance: ${DEFAULT_PROVENANCE})`);
      items.forEach((item) => log(`      · ${item.label} (${item.quantity || '1'})${Number(item.done) === 1 ? ' ✓' : ''}`));
    }
  }
}

// 4) Persister --------------------------------------------------------------
if (dryRun) {
  log('\n[DRY-RUN] Aucune écriture effectuée.');
} else {
  const backup = `${dbPath}.bak-${Date.now()}`;
  copyFileSync(dbPath, backup);
  writeFileSync(dbPath, Buffer.from(db.export()));
  log(`\nSauvegarde créée: ${backup}`);
  log(`Base migrée: ${dbPath}`);
  log(`Résumé: ${migratedCount} article(s) -> ingrédient(s).`);
}

db.close();
