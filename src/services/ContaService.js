import { getDatabase, withTransaction } from '../config/database.js';
import { ContaDAO } from '../dao/ContaDAO.js';
import { AlunoDAO } from '../dao/AlunoDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { Usuario } from '../models/Usuario.js';
import * as v from '../utils/validation.js';

function alunoFields(dados) {
  return {
    cpf: v.cpf(dados.cpf), rg: v.rg(dados.rg), endereco: v.text(dados.endereco, 'endereço'),
    curso: v.text(dados.curso, 'curso', 100), instituicaoId: v.id(dados.instituicaoId),
  };
}
function empresaFields(dados) {
  return { cnpj: v.cnpj(dados.cnpj), descricao: dados.descricao ? v.text(dados.descricao, 'descrição da empresa', 2000) : '' };
}
async function verificarInstituicao(client, instituicaoId) {
  if (!(await client.query('SELECT 1 FROM instituicoes_ensino WHERE id = $1', [instituicaoId])).rowCount) v.fail(400, 'Instituição de ensino não encontrada.');
}

export class ContaService {
  constructor() { this.dao = new ContaDAO(); }

  async perfil(actor) {
    const result = await this.dao.perfil(actor.id);
    if (!result) v.fail(401, 'Sua sessão expirou. Entre novamente.');
    return result;
  }

  async cadastrar(tipo, dados) {
    const fields = {
      nome: v.text(dados.nome, 'nome'), email: v.email(dados.email), login: v.login(dados.login), senha: v.password(dados.senha),
    };
    let created;
    if (tipo === 'ALUNO') {
      Object.assign(fields, alunoFields(dados));
      await verificarInstituicao(getDatabase(), fields.instituicaoId);
      created = await new AlunoDAO().create(fields);
    } else if (tipo === 'EMPRESA') {
      Object.assign(fields, empresaFields(dados));
      created = await new EmpresaParceiraDAO().create(fields);
    } else v.fail(403, 'Professores são cadastrados pela instituição.');
    return this.dao.perfil(created.id);
  }

  async atualizar(actor, dados) {
    return withTransaction(async (client) => {
      const locked = await client.query('SELECT id, senha_hash FROM usuarios WHERE id = $1 AND ativo FOR UPDATE', [actor.id]);
      if (!locked.rowCount) v.fail(401, 'Sua sessão expirou.');
      const atual = await this.dao.perfil(actor.id, client);
      const merged = { ...atual, ...dados };
      const nome = v.text(merged.nome, 'nome');
      const mail = v.email(merged.email);
      const userLogin = v.login(merged.login);
      let hash = locked.rows[0].senha_hash;
      if (dados.senha !== undefined && dados.senha !== '') {
        v.password(dados.senha);
        if (!await Usuario.verificarSenha(dados.senhaAtual, hash)) v.fail(403, 'Senha atual incorreta.');
        hash = Usuario.gerarHashSenha(dados.senha);
      }
      await client.query('UPDATE usuarios SET nome = $1, email = $2, login = $3, senha_hash = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5', [nome, mail, userLogin, hash, actor.id]);
      if (actor.tipo === 'ALUNO') {
        const fields = alunoFields(merged);
        await verificarInstituicao(client, fields.instituicaoId);
        await client.query('UPDATE alunos SET cpf = $1, rg = $2, endereco = $3, curso = $4, instituicao_id = $5 WHERE usuario_id = $6',
          [fields.cpf, fields.rg, fields.endereco, fields.curso, fields.instituicaoId, actor.id]);
      } else if (actor.tipo === 'EMPRESA') {
        const fields = empresaFields(merged);
        await client.query('UPDATE empresas_parceiras SET cnpj = $1, descricao = $2 WHERE usuario_id = $3', [fields.cnpj, fields.descricao, actor.id]);
      }
      // CPF, departamento e instituição do professor são dados da instituição.
      if (hash !== locked.rows[0].senha_hash) await client.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2', [actor.id, actor.sessionHash]);
      return this.dao.perfil(actor.id, client);
    });
  }

  async desativar(actor, senhaAtual) {
    await withTransaction(async (client) => {
      const user = (await client.query('SELECT senha_hash FROM usuarios WHERE id = $1 AND ativo FOR UPDATE', [actor.id])).rows[0];
      if (!user || !await Usuario.verificarSenha(senhaAtual, user.senha_hash)) v.fail(403, 'Senha atual incorreta.');
      await client.query('UPDATE usuarios SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [actor.id]);
      if (actor.tipo === 'EMPRESA') await client.query('UPDATE vantagens SET ativa = FALSE WHERE empresa_id = $1', [actor.id]);
      await client.query('DELETE FROM sessoes WHERE usuario_id = $1', [actor.id]);
    });
  }

  async alunosDoProfessor(actor) {
    if (actor.tipo !== 'PROFESSOR') v.fail(403, 'Somente professores podem consultar os alunos da instituição.');
    const { rows } = await getDatabase().query(
      'SELECT u.id, u.nome, a.curso FROM alunos a JOIN usuarios u ON u.id = a.usuario_id JOIN professores p ON p.instituicao_id = a.instituicao_id WHERE p.usuario_id = $1 AND u.ativo ORDER BY u.nome',
      [actor.id]
    );
    return rows.map((row) => ({ id: Number(row.id), nome: row.nome, curso: row.curso }));
  }
}
