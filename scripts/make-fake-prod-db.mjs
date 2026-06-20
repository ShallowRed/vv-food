// Génère une réplique de la base de PROD au schéma "ancien" (avant ingrédients),
// pour tester la migration sans toucher à la vraie prod.
//
// Usage: node scripts/make-fake-prod-db.mjs [chemin/sortie.sqlite]
// Défaut: prod-snapshot/foude.sqlite

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { default: initSqlJs } = await import('sql.js');

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outPath = resolve(rootDir, process.argv[2] ?? 'prod-snapshot/foude.sqlite');

const SQL = await initSqlJs();
const db = new SQL.Database();

// --- Schéma ANCIEN (tel qu'en prod aujourd'hui) ---
db.run(`
  CREATE TABLE meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    slot TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    owner TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );
`);
db.run(`
  CREATE TABLE grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    quantity TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );
`);
db.run(`
  CREATE TABLE participants (
    position INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

// --- Données plausibles de prod ---
const meals = [
  ['Vendredi', 'Dîner', 'Pâtes faciles + salade', 'Entrée en douceur.', 'Louis', 0],
  ['Samedi', 'Petit-déj', 'Petit-déj partagé', 'Pain, fruits, café.', 'Agathe', 0],
  ['Samedi', 'Déj', 'Pique-nique', 'Taboulé, quiches.', 'Marie', 0],
  ['Samedi', 'Dîner', 'BBQ', 'Plan barbecue.', 'Groupe', 0],
  ['Dimanche', 'Petit-déj', 'Brunch anti-gaspi', 'Finir les restes.', 'Joffrey', 0],
  ['Samedi', 'Déj', 'Repas archivé', 'Ancien repas supprimé.', 'Louis', 1],
];
const mealStmt = db.prepare('INSERT INTO meals (day, slot, title, note, owner, archived) VALUES (?, ?, ?, ?, ?, ?)');
meals.forEach((row) => mealStmt.run(row));
mealStmt.free();

const items = [
  ['Charbon', '1 sac', 'Louis', 0, 0],
  ['Pâtes', '2 paquets', 'Marie', 0, 0],
  ['Tomates', '6', 'Agathe', 1, 0],
  ['Fromage râpé', '1 sachet', 'Joffrey', 0, 0],
  ['Pain', '4 baguettes', 'Margaux', 0, 0],
  ['Article archivé', '1', 'Louis', 0, 1],
];
const itemStmt = db.prepare(
  'INSERT INTO grocery_items (label, quantity, assigned_to, done, archived) VALUES (?, ?, ?, ?, ?)',
);
items.forEach((row) => itemStmt.run(row));
itemStmt.free();

const participants = ['Marie', 'Louis', 'Agathe', 'Joffrey', 'Margaux'];
const partStmt = db.prepare('INSERT INTO participants (name) VALUES (?)');
participants.forEach((name) => partStmt.run([name]));
partStmt.free();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(db.export()));
db.close();

console.log(`Réplique prod (schéma ancien) écrite: ${outPath}`);
console.log(`  ${meals.length} repas (dont 1 archivé), ${items.length} courses (dont 1 archivée), ${participants.length} participants`);
