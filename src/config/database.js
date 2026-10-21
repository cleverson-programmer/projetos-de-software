import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../database/moeda_estudantil.db');
const SCHEMA_PATH = path.resolve(__dirname, '../../database/schema_sqlite.sql');

let dbInstance = null;

/**
 * Retorna a instância única (Singleton) de conexão com o banco de dados SQLite.
 * Garante que as chaves estrangeiras (PRAGMA foreign_keys = ON) estejam ativas
 * para manter a integridade referencial e o funcionamento do ON DELETE CASCADE.
 */
export function getDatabase() {
  if (!dbInstance) {
    const dbExists = fs.existsSync(DB_PATH);
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');

    if (!dbExists && fs.existsSync(SCHEMA_PATH)) {
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
      dbInstance.exec(schemaSql);
    }
  }
  return dbInstance;
}

/**
 * Executa uma operação dentro de uma transação atômica (BEGIN / COMMIT / ROLLBACK).
 * Essencial para a estratégia de herança JOINED (ex.: inserir/atualizar em `usuarios` e `alunos`).
 *
 * @param {(db: DatabaseSync) => any} callback
 */
export function withTransaction(callback) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = callback(db);
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

