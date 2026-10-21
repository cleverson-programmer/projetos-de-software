import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'moeda_estudantil.db');
const sqlPath = path.join(__dirname, 'schema_sqlite.sql');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

db.exec(sql);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log('Banco SQLite criado com sucesso em:', dbPath);
console.log('Tabelas criadas (' + tables.length + '):', tables.map((t) => t.name).join(', '));

db.close();

