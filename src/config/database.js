import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gerarHashSenha } from '../utils/senha.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAIZ = path.resolve(__dirname, '../..');
const DB_PATH_PADRAO = path.resolve(RAIZ, 'database/moeda_estudantil.db');
const SCHEMA_PATH = path.resolve(RAIZ, 'database/schema_sqlite.sql');

/** Hash bcrypt de "123456" usado nos seeds antigos (não é mais aceito para login). */
const HASH_LEGADO_SEED = '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';
const SENHA_PADRAO_SEED = '123456';

let dbInstance = null;

/**
 * Caminho do arquivo do banco: variável de ambiente `DB_PATH` (relativo à raiz do projeto
 * ou absoluto) ou `database/moeda_estudantil.db`. Lido a cada abertura, não no import.
 */
function resolverCaminhoBanco() {
  const configurado = process.env.DB_PATH;
  return configurado && configurado.trim() !== ''
    ? path.resolve(RAIZ, configurado.trim())
    : DB_PATH_PADRAO;
}

/**
 * Converte para PBKDF2 as senhas que ainda estão com o hash bcrypt do seed antigo.
 * Idempotente: depois da primeira execução nenhuma linha é encontrada e nada é alterado.
 *
 * @param {DatabaseSync} db conexão já aberta
 * @returns {number} quantidade de usuários migrados
 */
export function migrarSenhasLegadas(db) {
  const tabela = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'")
    .get();
  if (!tabela) return 0;

  const legados = db.prepare('SELECT id FROM usuarios WHERE senha_hash = ?').all(HASH_LEGADO_SEED);
  if (legados.length === 0) return 0;

  const atualizar = db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ? AND senha_hash = ?');
  let migrados = 0;

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    for (const { id } of legados) {
      const resultado = atualizar.run(gerarHashSenha(SENHA_PADRAO_SEED), id, HASH_LEGADO_SEED);
      migrados += Number(resultado.changes);
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return migrados;
}

/**
 * Retorna a instância única (Singleton) de conexão com o banco de dados SQLite.
 * Garante que as chaves estrangeiras (PRAGMA foreign_keys = ON) estejam ativas
 * para manter a integridade referencial e o funcionamento do ON DELETE CASCADE.
 * Na abertura (e após aplicar o schema em banco novo) migra senhas legadas para PBKDF2.
 */
export function getDatabase() {
  if (!dbInstance) {
    const caminho = resolverCaminhoBanco();
    fs.mkdirSync(path.dirname(caminho), { recursive: true });

    const dbExists = fs.existsSync(caminho);
    const db = new DatabaseSync(caminho);
    db.exec('PRAGMA foreign_keys = ON;');

    if (!dbExists && fs.existsSync(SCHEMA_PATH)) {
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schemaSql);
    }

    migrarSenhasLegadas(db);
    dbInstance = db;
  }
  return dbInstance;
}

/**
 * Fecha a conexão singleton (se aberta). A próxima chamada a `getDatabase()` reabre o banco,
 * relendo `DB_PATH`. Usado por testes e por scripts que precisam liberar o arquivo.
 */
export function fecharDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
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

