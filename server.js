import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { default: initSqlJs } = await import('sql.js');

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const dataDir = join(rootDir, 'data');
const dbPath = join(dataDir, 'foude.sqlite');
const distDir = join(rootDir, 'dist');
const port = Number(process.env.PORT || 8787);

mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();
const database = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

database.run('PRAGMA foreign_keys = ON;');
database.run(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    slot TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    owner TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );
`);
database.run(`
  CREATE TABLE IF NOT EXISTS grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    quantity TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );
`);

// Migration: add archived column if it doesn't exist
try {
  database.run('ALTER TABLE meals ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
} catch {}
try {
  database.run('ALTER TABLE grocery_items ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
} catch {}
database.run(`
  CREATE TABLE IF NOT EXISTS participants (
    position INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

const seedMeals = [
  ['Vendredi', 'Dîner', 'Pâtes faciles + salade', 'Entrée en douceur, zéro cerveau.', 'Louis'],
  ['Samedi', 'Petit-déj', 'Petit-déj partagé', 'Pain, fruits, café, confiture.', 'Agathe'],
  ['Samedi', 'Déj', 'Pique-nique', 'Taboulé, quiches, restes utiles.', 'Marie'],
  ['Samedi', 'Dîner', 'BBQ / moules-frites', 'Plan A barbecue, plan B convivial.', 'Groupe'],
  ['Dimanche', 'Petit-déj', 'Brunch anti-gaspi', 'Finir ce qui reste sans effort.', 'Joffrey'],
];

const seedItems = [
  ['Charbon', '1 sac', 'Louis', 0],
  ['Pâtes', '2 paquets', 'Marie', 0],
  ['Tomates', '6', 'Agathe', 1],
  ['Fromage râpé', '1 sachet', 'Joffrey', 0],
];

const seedParticipants = ['Marie', 'Louis', 'Agathe', 'Joffrey', 'Margaux'];

function persist() {
  writeFileSync(dbPath, Buffer.from(database.export()));
}

function tableHasRows(tableName) {
  const stmt = database.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`);
  const hasRow = stmt.step();
  stmt.free();
  return hasRow;
}

if (!tableHasRows('meals')) {
  const stmt = database.prepare('INSERT INTO meals (day, slot, title, note, owner) VALUES (?, ?, ?, ?, ?)');
  seedMeals.forEach((row) => stmt.run(row));
  stmt.free();
}

if (!tableHasRows('grocery_items')) {
  const stmt = database.prepare('INSERT INTO grocery_items (label, quantity, assigned_to, done) VALUES (?, ?, ?, ?)');
  seedItems.forEach((row) => stmt.run(row));
  stmt.free();
}

if (!tableHasRows('participants')) {
  const stmt = database.prepare('INSERT INTO participants (name) VALUES (?)');
  seedParticipants.forEach((name) => stmt.run([name]));
  stmt.free();
}

persist();

function all(sql, params = []) {
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

function one(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

function mealFromRow(row) {
  return {
    id: Number(row.id),
    day: String(row.day),
    slot: String(row.slot),
    title: String(row.title),
    note: String(row.note),
    owner: String(row.owner),
  };
}

function groceryFromRow(row) {
  return {
    id: Number(row.id),
    label: String(row.label),
    quantity: String(row.quantity),
    assignedTo: String(row.assigned_to),
    done: Number(row.done) === 1,
  };
}

function participantsFromDb() {
  return all('SELECT name FROM participants ORDER BY position').map((row) => String(row.name));
}

function currentState() {
  return {
    meals: all('SELECT id, day, slot, title, note, owner FROM meals WHERE archived = 0 ORDER BY id DESC').map(mealFromRow),
    items: all('SELECT id, label, quantity, assigned_to, done FROM grocery_items WHERE archived = 0 ORDER BY id DESC').map(groceryFromRow),
    participants: participantsFromDb(),
  };
}

function replaceParticipants(participants) {
  const names = [];
  const seen = new Set();

  participants.forEach((participant) => {
    const name = String(participant || '').trim();
    if (!name || seen.has(name)) {
      return;
    }

    seen.add(name);
    names.push(name);
  });

  database.run('DELETE FROM participants');
  const stmt = database.prepare('INSERT INTO participants (name) VALUES (?)');
  names.forEach((name) => stmt.run([name]));
  stmt.free();
  persist();
  return names;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Corps JSON invalide.'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  response.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendText(response, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  response.end(text);
}

function validateMeal(body) {
  const { day, slot, title, note, owner } = body;
  if (!day || !slot || !title || !owner) {
    throw new Error('Les champs repas sont incomplets.');
  }

  return {
    day: String(day),
    slot: String(slot),
    title: String(title),
    note: String(note || 'À préciser'),
    owner: String(owner),
  };
}

function validateItem(body) {
  const { label, quantity, assignedTo, done } = body;
  if (!label || !assignedTo) {
    throw new Error('Les champs courses sont incomplets.');
  }

  return {
    label: String(label),
    quantity: String(quantity || '1'),
    assignedTo: String(assignedTo),
    done: Boolean(done),
  };
}

function createMeal(body) {
  const meal = validateMeal(body);
  const stmt = database.prepare('INSERT INTO meals (day, slot, title, note, owner) VALUES (?, ?, ?, ?, ?)');
  stmt.run([meal.day, meal.slot, meal.title, meal.note, meal.owner]);
  stmt.free();
  const createdId = Number(one('SELECT last_insert_rowid() AS id')?.id);
  persist();
  return mealFromRow(one('SELECT id, day, slot, title, note, owner FROM meals WHERE id = ?', [createdId]));
}

function updateMeal(id, body) {
  const meal = validateMeal(body);
  const existing = one('SELECT id FROM meals WHERE id = ?', [id]);
  if (!existing) {
    return null;
  }

  const stmt = database.prepare('UPDATE meals SET day = ?, slot = ?, title = ?, note = ?, owner = ? WHERE id = ?');
  stmt.run([meal.day, meal.slot, meal.title, meal.note, meal.owner, id]);
  stmt.free();
  persist();
  return mealFromRow(one('SELECT id, day, slot, title, note, owner FROM meals WHERE id = ?', [id]));
}

function deleteMeal(id) {
  const existing = one('SELECT id FROM meals WHERE id = ? AND archived = 0', [id]);
  if (!existing) {
    return false;
  }

  const stmt = database.prepare('UPDATE meals SET archived = 1 WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persist();
  return true;
}

function createItem(body) {
  const item = validateItem(body);
  const stmt = database.prepare('INSERT INTO grocery_items (label, quantity, assigned_to, done) VALUES (?, ?, ?, ?)');
  stmt.run([item.label, item.quantity, item.assignedTo, item.done ? 1 : 0]);
  stmt.free();
  const createdId = Number(one('SELECT last_insert_rowid() AS id')?.id);
  persist();
  return groceryFromRow(one('SELECT id, label, quantity, assigned_to, done FROM grocery_items WHERE id = ?', [createdId]));
}

function updateItem(id, body) {
  const item = validateItem(body);
  const existing = one('SELECT id FROM grocery_items WHERE id = ?', [id]);
  if (!existing) {
    return null;
  }

  const stmt = database.prepare('UPDATE grocery_items SET label = ?, quantity = ?, assigned_to = ?, done = ? WHERE id = ?');
  stmt.run([item.label, item.quantity, item.assignedTo, item.done ? 1 : 0, id]);
  stmt.free();
  persist();
  return groceryFromRow(one('SELECT id, label, quantity, assigned_to, done FROM grocery_items WHERE id = ?', [id]));
}

function deleteItem(id) {
  const existing = one('SELECT id FROM grocery_items WHERE id = ? AND archived = 0', [id]);
  if (!existing) {
    return false;
  }

  const stmt = database.prepare('UPDATE grocery_items SET archived = 1 WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persist();
  return true;
}

function contentTypeFor(filePath) {
  const extension = extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
  }[extension] ?? 'application/octet-stream';
}

function serveStatic(request, response, pathname) {
  if (!existsSync(distDir)) {
    sendText(response, 404, 'Frontend build introuvable. Lancez npm run build puis npm run server.');
    return;
  }

  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(distDir, safePath);

  if (existsSync(filePath)) {
    sendText(response, 200, readFileSync(filePath), contentTypeFor(filePath));
    return;
  }

  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    sendText(response, 200, readFileSync(indexPath), contentTypeFor(indexPath));
    return;
  }

  sendText(response, 404, 'index.html introuvable.');
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const { pathname } = url;

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, undefined);
    return;
  }

  if (pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === '/api/state' && request.method === 'GET') {
    sendJson(response, 200, currentState());
    return;
  }

  if (pathname === '/api/participants' && request.method === 'GET') {
    sendJson(response, 200, participantsFromDb());
    return;
  }

  if (pathname === '/api/meals' && request.method === 'GET') {
    sendJson(response, 200, all('SELECT id, day, slot, title, note, owner FROM meals ORDER BY id DESC').map(mealFromRow));
    return;
  }

  if (pathname === '/api/meals' && request.method === 'POST') {
    try {
      const meal = createMeal(await readBody(request));
      sendJson(response, 201, meal);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Erreur inconnue.' });
    }
    return;
  }

  if (pathname.startsWith('/api/meals/') && request.method === 'PUT') {
    const id = Number(pathname.split('/').pop());
    if (!Number.isFinite(id)) {
      sendJson(response, 400, { error: 'Identifiant repas invalide.' });
      return;
    }

    try {
      const meal = updateMeal(id, await readBody(request));
      if (!meal) {
        sendJson(response, 404, { error: 'Repas introuvable.' });
        return;
      }
      sendJson(response, 200, meal);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Erreur inconnue.' });
    }
    return;
  }

  if (pathname.startsWith('/api/meals/') && request.method === 'DELETE') {
    const id = Number(pathname.split('/').pop());
    if (!Number.isFinite(id)) {
      sendJson(response, 400, { error: 'Identifiant repas invalide.' });
      return;
    }

    if (!deleteMeal(id)) {
      sendJson(response, 404, { error: 'Repas introuvable.' });
      return;
    }

    sendJson(response, 204, undefined);
    return;
  }

  if (pathname === '/api/items' && request.method === 'GET') {
    sendJson(response, 200, all('SELECT id, label, quantity, assigned_to, done FROM grocery_items ORDER BY id DESC').map(groceryFromRow));
    return;
  }

  if (pathname === '/api/participants' && request.method === 'PUT') {
    try {
      const body = await readBody(request);
      sendJson(response, 200, replaceParticipants(Array.isArray(body) ? body : []));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Erreur inconnue.' });
    }
    return;
  }

  if (pathname === '/api/items' && request.method === 'POST') {
    try {
      const item = createItem(await readBody(request));
      sendJson(response, 201, item);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Erreur inconnue.' });
    }
    return;
  }

  if (pathname.startsWith('/api/items/') && request.method === 'PUT') {
    const id = Number(pathname.split('/').pop());
    if (!Number.isFinite(id)) {
      sendJson(response, 400, { error: 'Identifiant article invalide.' });
      return;
    }

    try {
      const item = updateItem(id, await readBody(request));
      if (!item) {
        sendJson(response, 404, { error: 'Article introuvable.' });
        return;
      }
      sendJson(response, 200, item);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Erreur inconnue.' });
    }
    return;
  }

  if (pathname.startsWith('/api/items/') && request.method === 'DELETE') {
    const id = Number(pathname.split('/').pop());
    if (!Number.isFinite(id)) {
      sendJson(response, 400, { error: 'Identifiant article invalide.' });
      return;
    }

    if (!deleteItem(id)) {
      sendJson(response, 404, { error: 'Article introuvable.' });
      return;
    }

    sendJson(response, 204, undefined);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Route API introuvable.' });
    return;
  }

  serveStatic(request, response, pathname);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`foude API disponible sur http://0.0.0.0:${port}`);
});