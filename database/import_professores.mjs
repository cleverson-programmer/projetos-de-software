import fs from 'node:fs/promises';
import { withTransaction } from '../src/config/database.js';
import { Usuario } from '../src/models/Usuario.js';
import * as v from '../src/utils/validation.js';
import { calendario, creditarNoCliente } from '../src/services/CreditoService.js';
import { migrateDatabase } from './migrate.mjs';
import { isMain, runCommand } from './cli.mjs';

export async function importarProfessores(lista) {
  if (!Array.isArray(lista) || !lista.length) throw new Error('O arquivo deve conter uma lista JSON de professores.');
  return withTransaction(async (client) => {
    let criados = 0;
    for (const item of lista) {
      const data = {
        nome: v.text(item.nome, 'nome'), email: v.email(item.email), login: v.login(item.login),
        senha: v.password(item.senha), cpf: v.cpf(item.cpf), departamento: v.text(item.departamento, 'departamento', 100),
        instituicaoId: v.id(item.instituicaoId),
      };
      if (!(await client.query('SELECT 1 FROM instituicoes_ensino WHERE id = $1', [data.instituicaoId])).rowCount) throw new Error('Instituição não encontrada para ' + data.login);
      const existing = (await client.query('SELECT u.id, u.tipo, p.cpf FROM usuarios u LEFT JOIN professores p ON p.usuario_id = u.id WHERE lower(u.login) = $1', [data.login])).rows[0];
      if (existing) {
        if (existing.tipo !== 'PROFESSOR' || existing.cpf !== data.cpf) throw new Error('Login já pertence a outro cadastro: ' + data.login);
        continue;
      }
      const user = (await client.query("INSERT INTO usuarios (nome, email, login, senha_hash, tipo) VALUES ($1, $2, $3, $4, 'PROFESSOR') RETURNING id",
        [data.nome, data.email, data.login, Usuario.gerarHashSenha(data.senha)])).rows[0];
      await client.query('INSERT INTO professores (usuario_id, cpf, departamento, instituicao_id, inicio_creditos) VALUES ($1, $2, $3, $4, $5)',
        [user.id, data.cpf, data.departamento, data.instituicaoId, calendario().data]);
      criados++;
    }
    await creditarNoCliente(client);
    return criados;
  });
}

if (isMain(import.meta.url)) await runCommand(async () => {
  if (!process.argv[2]) throw new Error('Informe o caminho do arquivo JSON de professores.');
  const lista = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  await migrateDatabase();
  console.log('Professores cadastrados:', await importarProfessores(lista));
});
