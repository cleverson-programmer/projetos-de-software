import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { migrarSenhasLegadas } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB_PATH (relativo à raiz do projeto ou absoluto) permite recriar o banco em outro arquivo.
const dbPath = process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
  ? path.resolve(__dirname, '..', process.env.DB_PATH.trim())
  : path.join(__dirname, 'moeda_estudantil.db');
const sqlPath = path.join(__dirname, 'schema_sqlite.sql');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

db.exec(sql);

// O seed traz o hash bcrypt legado; converte para PBKDF2 para que os logins de teste funcionem.
const migrados = migrarSenhasLegadas(db);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log('Banco SQLite criado com sucesso em:', dbPath);
console.log('Tabelas criadas (' + tables.length + '):', tables.map((t) => t.name).join(', '));
console.log('Senhas do seed convertidas para PBKDF2:', migrados);

db.close();
