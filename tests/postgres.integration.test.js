import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { getDatabase, closeDatabase } from '../src/config/database.js';
import { migrateDatabase } from '../database/migrate.mjs';
import { seedDemoData } from '../database/seed.mjs';
import { importSQLite } from '../database/import_sqlite.mjs';
import { TABLES } from '../database/tables.mjs';
import { AlunoDAO } from '../src/dao/AlunoDAO.js';
import { UsuarioDAO } from '../src/dao/UsuarioDAO.js';
import { createAppServer } from '../src/server.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Configure TEST_DATABASE_URL; testes não usam DATABASE_URL de desenvolvimento/produção.');
}

test('Integração com PostgreSQL real em schemas temporários', async (t) => {
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const importSchema = schema + '_import';
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const oldUrl = process.env.DATABASE_URL;
  const oldSchema = process.env.DATABASE_SCHEMA;
  let server, fixtureFolder;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SCHEMA = schema;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    await admin.query('CREATE SCHEMA ' + importSchema);
    await t.test('migrações concorrentes e repetidas preservam dados', async () => {
      await Promise.all([migrateDatabase(), migrateDatabase()]);
      assert.equal((await getDatabase().query('SELECT COUNT(*) FROM schema_migrations')).rows[0].count, '1');
      assert.equal(await seedDemoData(), true);
      assert.equal(await seedDemoData(), false);
      await migrateDatabase();
      assert.equal((await getDatabase().query('SELECT COUNT(*) FROM usuarios')).rows[0].count, '6');
    });

    await t.test('importação SQLite preserva todas as tabelas, booleanos e sequências; não sobrescreve', async () => {
      const { DatabaseSync } = await import('node:sqlite');
      fixtureFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'moeda-import-'));
      const fixture = path.join(fixtureFolder, 'source.db');
      const sqlite = new DatabaseSync(fixture);
      sqlite.exec(await fs.readFile(new URL('../database/schema_sqlite.sql', import.meta.url), 'utf8'));
      const expected = Object.fromEntries(TABLES.map((table) => [table, sqlite.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n]));
      sqlite.close();
      const before = await fs.readFile(fixture);
      await closeDatabase();
      process.env.DATABASE_SCHEMA = importSchema;
      try {
        await migrateDatabase();
        assert.deepEqual(await importSQLite(fixture), expected);
        assert.equal((await getDatabase().query('SELECT ativa FROM vantagens LIMIT 1')).rows[0].ativa, true);
        await assert.rejects(importSQLite(fixture), /não está vazio/);
        assert.deepEqual(await fs.readFile(fixture), before);
        const aluno = await new AlunoDAO().create({
          nome: 'Após importação', email: 'import@example.test', login: 'import',
          senha: 'segredo123', cpf: '900.111.222-33', rg: 'MG-11.222.333',
          endereco: 'Rua Teste', curso: 'Computação', instituicaoId: 1,
        });
        assert.ok(aluno.id > 6);
        for (const table of TABLES) {
          const count = Number((await getDatabase().query('SELECT COUNT(*) FROM ' + table)).rows[0].count);
          assert.equal(count, expected[table] + (['usuarios', 'alunos'].includes(table) ? 1 : 0));
        }
      } finally {
        await closeDatabase();
        process.env.DATABASE_SCHEMA = schema;
      }
    });

    server = createAppServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    async function request(url, method = 'GET', body) {
      const response = await fetch(base + url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }
    const aluno = {
      nome: 'Teste API', email: 'api@example.test', login: 'teste.api', senha: 'segredo123',
      cpf: '999.888.777-66', rg: 'MG-99.888.777', endereco: 'Rua Teste',
      curso: 'Engenharia', instituicaoId: 1,
    };
    let alunoId, empresaId;

    await t.test('frontend, health e instituições continuam disponíveis', async () => {
      assert.equal((await fetch(base + '/')).status, 200);
      assert.equal((await fetch(base + '/app.js')).status, 200);
      assert.deepEqual(await request('/health'), { status: 200, body: { status: 'ok' } });
      const result = await request('/api/instituicoes');
      assert.equal(result.status, 200);
      assert.equal(result.body.length, 4);
      assert.equal(typeof result.body[0].id, 'number');
    });
    await t.test('CRUD aluno e autenticação funcionam pela API assíncrona', async () => {
      const created = await request('/api/alunos', 'POST', aluno);
      assert.equal(created.status, 201);
      alunoId = created.body.id;
      assert.equal(typeof alunoId, 'number');
      assert.ok(alunoId > 6);
      assert.equal(created.body.senhaHash, undefined);
      const login = await request('/api/auth/login', 'POST', { login: aluno.login, senha: aluno.senha });
      assert.equal(login.status, 200);
      assert.equal(login.body.usuario.tipo, 'ALUNO');
      assert.equal((await request('/api/auth/login', 'POST', { login: aluno.login, senha: 'errada' })).status, 401);
      const updated = await request('/api/alunos/' + alunoId, 'PUT', { curso: 'Computação', senha: 'novaSenha123' });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.curso, 'Computação');
      assert.equal((await request('/api/auth/login', 'POST', { login: aluno.login, senha: 'novaSenha123' })).status, 200);
      assert.equal((await request('/api/alunos/' + alunoId)).body.id, alunoId);
      assert.ok((await request('/api/alunos')).body.some((row) => row.id === alunoId));
      assert.equal((await request('/api/alunos/999999')).status, 404);
      assert.equal((await request('/api/alunos', 'POST', aluno)).status, 409);
    });
    await t.test('validações assíncronas, conflitos concorrentes e rollback JOINED', async () => {
      assert.equal((await request('/api/alunos', 'POST', { ...aluno, login: 'invalid', email: 'invalid@example.test', instituicaoId: 999999 })).status, 400);
      const dao = new AlunoDAO();
      await assert.rejects(dao.create({ ...aluno, email: 'rollback@example.test', login: 'rollback', cpf: '123', instituicaoId: 999999 }), { code: '23503' });
      assert.equal(await new UsuarioDAO().findByLogin('rollback'), null);
      const update = await request('/api/alunos/' + alunoId, 'PUT', { email: 'kaio.silva@sga.pucminas.br' });
      assert.equal(update.status, 409);
      const body = { ...aluno, login: 'race', email: 'race@example.test', cpf: '555.666.777-88' };
      const raced = await Promise.all([request('/api/alunos', 'POST', body), request('/api/alunos', 'POST', body)]);
      assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
      await request('/api/alunos/' + raced.find((r) => r.status === 201).body.id, 'DELETE');
    });
    await t.test('CRUD empresa, login e exclusões com cascata', async () => {
      const empresa = { nome: 'Empresa API', email: 'empresa@example.test', login: 'empresa.api', senha: 'segredo123', cnpj: '77.888.999/0001-55', descricao: 'Teste' };
      const created = await request('/api/empresas', 'POST', empresa);
      assert.equal(created.status, 201);
      empresaId = created.body.id;
      assert.equal((await request('/api/auth/login', 'POST', { login: empresa.login, senha: empresa.senha })).body.usuario.tipo, 'EMPRESA');
      assert.equal((await request('/api/empresas/' + empresaId)).body.cnpj, empresa.cnpj);
      assert.ok((await request('/api/empresas')).body.some((row) => row.id === empresaId));
      assert.equal((await request('/api/empresas/' + empresaId, 'PUT', { descricao: 'Atualizada' })).body.descricao, 'Atualizada');
      assert.equal((await request('/api/empresas', 'POST', empresa)).status, 409);
      assert.equal((await request('/api/empresas/' + empresaId, 'DELETE')).status, 200);
      assert.equal((await request('/api/empresas/' + empresaId)).status, 404);
      assert.equal(await new UsuarioDAO().findById(empresaId), null);
      assert.equal((await request('/api/alunos/' + alunoId, 'DELETE')).status, 200);
      assert.equal(await new AlunoDAO().findById(alunoId), null);
      assert.equal(await new UsuarioDAO().findById(alunoId), null);
      assert.equal((await request('/api/auth/login', 'POST', { login: 'milena.adao', senha: '123456' })).body.usuario.tipo, 'PROFESSOR');
    });
    await t.test('erros JSON, rotas ausentes e falhas inesperadas não vazam SQL', async () => {
      const invalid = await fetch(base + '/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
      assert.equal(invalid.status, 400);
      assert.equal((await request('/api/inexistente')).status, 404);
      assert.equal((await request('/api/alunos', 'POST', { ...aluno, email: {}, login: 'invalid.type' })).status, 500);
    });
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
    await closeDatabase();
    // Nomes gerados internamente por UUID; somente schemas criados por esta execução.
    try {
      await admin.query('DROP SCHEMA IF EXISTS ' + importSchema + ' CASCADE');
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    } finally {
      await admin.end();
    }
    if (fixtureFolder) {
      await fs.unlink(path.join(fixtureFolder, 'source.db')).catch(() => {});
      await fs.rmdir(fixtureFolder).catch(() => {});
    }
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldSchema === undefined) delete process.env.DATABASE_SCHEMA; else process.env.DATABASE_SCHEMA = oldSchema;
  }
});
