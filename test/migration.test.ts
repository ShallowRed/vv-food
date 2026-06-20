import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { default: initSqlJs } = await import('sql.js');
const SQL = await initSqlJs();

const SCRIPT = new URL('../scripts/migrate-to-ingredients.mjs', import.meta.url).pathname;

// Construit une base au schéma ANCIEN (prod) avec les lignes données.
function makeOldDb(path: string, opts: {
  meals?: Array<[string, string, string, string, string, number]>;
  items?: Array<[string, string, string, number, number]>;
} = {}) {
  const db = new SQL.Database();
  db.run(`CREATE TABLE meals (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, slot TEXT, title TEXT, note TEXT, owner TEXT, archived INTEGER NOT NULL DEFAULT 0);`);
  db.run(`CREATE TABLE grocery_items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, quantity TEXT, assigned_to TEXT, done INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0);`);
  db.run(`CREATE TABLE participants (position INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);`);

  const meals = opts.meals ?? [['Samedi', 'Dîner', 'BBQ', 'note', 'Louis', 0]];
  const ms = db.prepare('INSERT INTO meals (day, slot, title, note, owner, archived) VALUES (?, ?, ?, ?, ?, ?)');
  meals.forEach((r) => ms.run(r));
  ms.free();

  const items = opts.items ?? [['Charbon', '1 sac', 'Louis', 0, 0], ['Tomates', '6', 'Marie', 1, 0]];
  const is = db.prepare('INSERT INTO grocery_items (label, quantity, assigned_to, done, archived) VALUES (?, ?, ?, ?, ?)');
  items.forEach((r) => is.run(r));
  is.free();

  writeFileSync(path, Buffer.from(db.export()));
  db.close();
}

function readDb(path: string) {
  const db = new SQL.Database(readFileSync(path));
  const q = (sql: string) => {
    const r = db.exec(sql);
    return r[0] ? r[0].values : [];
  };
  return { q, close: () => db.close() };
}

function runMigration(path: string, ...extra: string[]) {
  return execFileSync('node', [SCRIPT, path, ...extra], { encoding: 'utf8' });
}

function withTmp(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'foude-mig-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('migration crée ingredients/provenances et le repas "Courses diverses"', () => {
  withTmp((dir) => {
    const dbPath = join(dir, 'foude.sqlite');
    makeOldDb(dbPath);
    runMigration(dbPath);

    const { q, close } = readDb(dbPath);
    // provenances seedées
    const provs = q('SELECT name FROM provenances ORDER BY position').map((r) => r[0]);
    assert.deepEqual(provs, ['Grande surface', 'Marché sur place', 'Ramené de Paris']);

    // repas fourre-tout créé sur le séjour
    const catchAll = q("SELECT id FROM meals WHERE title = 'Courses diverses' AND day = 'Séjour'");
    assert.equal(catchAll.length, 1);
    const catchAllId = catchAll[0][0];

    // 2 ingrédients migrés, rattachés au repas fourre-tout
    const ings = q(`SELECT label, quantity, provenance, done FROM ingredients WHERE meal_id = ${catchAllId} ORDER BY id`);
    assert.equal(ings.length, 2);
    assert.deepEqual(ings[0], ['Charbon', '1 sac', 'Grande surface', 0]);
    // le flag done est préservé (Tomates done=1)
    assert.deepEqual(ings[1], ['Tomates', '6', 'Grande surface', 1]);
    close();
  });
});

test('migration ignore les articles archivés', () => {
  withTmp((dir) => {
    const dbPath = join(dir, 'foude.sqlite');
    makeOldDb(dbPath, {
      items: [['Actif', '1', 'Louis', 0, 0], ['Archivé', '1', 'Louis', 0, 1]],
    });
    runMigration(dbPath);

    const { q, close } = readDb(dbPath);
    const labels = q('SELECT label FROM ingredients ORDER BY id').map((r) => r[0]);
    assert.deepEqual(labels, ['Actif']);
    close();
  });
});

test('migration est idempotente (2e passe ne duplique rien)', () => {
  withTmp((dir) => {
    const dbPath = join(dir, 'foude.sqlite');
    makeOldDb(dbPath);
    runMigration(dbPath);
    runMigration(dbPath);

    const { q, close } = readDb(dbPath);
    const catchAll = q("SELECT COUNT(*) FROM meals WHERE title = 'Courses diverses' AND day = 'Séjour'");
    assert.equal(catchAll[0][0], 1, 'un seul repas Courses diverses');
    const ingCount = q('SELECT COUNT(*) FROM ingredients');
    assert.equal(ingCount[0][0], 2, 'pas de doublon d\'ingrédients');
    const provCount = q('SELECT COUNT(*) FROM provenances');
    assert.equal(provCount[0][0], 3, 'pas de doublon de provenances');
    close();
  });
});

test('--dry-run n\'écrit rien', () => {
  withTmp((dir) => {
    const dbPath = join(dir, 'foude.sqlite');
    makeOldDb(dbPath);
    const before = readFileSync(dbPath);
    runMigration(dbPath, '--dry-run');
    const after = readFileSync(dbPath);
    assert.ok(before.equals(after), 'la base est inchangée après dry-run');

    const { q, close } = readDb(dbPath);
    const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ingredients','provenances')");
    assert.equal(tables.length, 0, 'aucune table créée en dry-run');
    close();
  });
});

test('migration sans articles actifs ne crée pas de repas fourre-tout', () => {
  withTmp((dir) => {
    const dbPath = join(dir, 'foude.sqlite');
    makeOldDb(dbPath, { items: [] });
    runMigration(dbPath);

    const { q, close } = readDb(dbPath);
    const catchAll = q("SELECT COUNT(*) FROM meals WHERE title = 'Courses diverses'");
    assert.equal(catchAll[0][0], 0);
    // mais les provenances sont quand même seedées
    const provCount = q('SELECT COUNT(*) FROM provenances');
    assert.equal(provCount[0][0], 3);
    close();
  });
});
