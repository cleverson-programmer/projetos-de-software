import assert from 'node:assert/strict';
import { InstituicaoEnsinoDAO } from './InstituicaoEnsinoDAO.js';
import { UsuarioDAO } from './UsuarioDAO.js';
import { AlunoDAO } from './AlunoDAO.js';
import { EmpresaParceiraDAO } from './EmpresaParceiraDAO.js';

const instituicaoDAO = new InstituicaoEnsinoDAO();
const usuarioDAO = new UsuarioDAO();
const alunoDAO = new AlunoDAO();
const empresaDAO = new EmpresaParceiraDAO();

console.log('=== Testando Camada de Persistência (Padrão DAO) ===\n');

// 1. Instituições de Ensino
const instituicoes = instituicaoDAO.findAll();
assert.ok(instituicoes.length >= 4, 'Deve retornar as instituições pré-cadastradas');
console.log(`[OK] InstituicaoEnsinoDAO.findAll(): ${instituicoes.length} instituições carregadas.`);

// 2. Ciclo completo CRUD no AlunoDAO
const novoAluno = alunoDAO.create({
  nome: 'Aluno Teste DAO',
  email: 'teste.dao.aluno@pucminas.br',
  login: 'aluno.teste.dao',
  senha: 'senhaSegura123',
  cpf: '999.888.777-66',
  rg: 'MG-99.888.777',
  endereco: 'Rua Teste DAO, 100',
  curso: 'Engenharia de Software',
  instituicaoId: instituicoes[0].id,
});

assert.ok(novoAluno && novoAluno.id, 'Aluno deve ser criado com ID gerado');
assert.equal(novoAluno.nome, 'Aluno Teste DAO');
assert.equal(novoAluno.instituicao.nome, instituicoes[0].nome);
assert.equal(novoAluno.autenticar('aluno.teste.dao', 'senhaSegura123'), true);
console.log(`[OK] AlunoDAO.create(): Criado Aluno ID=${novoAluno.id} (${novoAluno.nome}).`);

const alunoAtualizado = alunoDAO.update(novoAluno.id, {
  nome: 'Aluno Teste DAO Atualizado',
  curso: 'Ciência da Computação',
});
assert.equal(alunoAtualizado.nome, 'Aluno Teste DAO Atualizado');
assert.equal(alunoAtualizado.curso, 'Ciência da Computação');
console.log(`[OK] AlunoDAO.update(): Atualizado Aluno ID=${novoAluno.id} para curso "${alunoAtualizado.curso}".`);

const alunoRemovido = alunoDAO.delete(novoAluno.id);
assert.equal(alunoRemovido, true);
assert.equal(alunoDAO.findById(novoAluno.id), null);
assert.equal(usuarioDAO.findById(novoAluno.id), null, 'ON DELETE CASCADE deve remover de ambos');
console.log(`[OK] AlunoDAO.delete(): Removido Aluno ID=${novoAluno.id} com integridade referencial.`);

// 3. Ciclo completo CRUD no EmpresaParceiraDAO
const novaEmpresa = empresaDAO.create({
  nome: 'Empresa Teste DAO Ltda',
  email: 'contato@empresatestedao.com.br',
  login: 'empresa.teste.dao',
  senha: 'senhaEmpresa123',
  cnpj: '77.888.999/0001-55',
  descricao: 'Parceira de testes da camada DAO',
});

assert.ok(novaEmpresa && novaEmpresa.id, 'Empresa deve ser criada com ID gerado');
assert.equal(novaEmpresa.cnpj, '77.888.999/0001-55');
console.log(`[OK] EmpresaParceiraDAO.create(): Criada Empresa ID=${novaEmpresa.id} (${novaEmpresa.nome}).`);

const empresaAtualizada = empresaDAO.update(novaEmpresa.id, {
  nome: 'Empresa Teste DAO S.A.',
  descricao: 'Descrição atualizada via DAO',
});
assert.equal(empresaAtualizada.nome, 'Empresa Teste DAO S.A.');
assert.equal(empresaAtualizada.descricao, 'Descrição atualizada via DAO');
console.log(`[OK] EmpresaParceiraDAO.update(): Atualizada Empresa ID=${novaEmpresa.id}.`);

const empresaRemovida = empresaDAO.delete(novaEmpresa.id);
assert.equal(empresaRemovida, true);
assert.equal(empresaDAO.findById(novaEmpresa.id), null);
console.log(`[OK] EmpresaParceiraDAO.delete(): Removida Empresa ID=${novaEmpresa.id} com integridade referencial.`);

console.log('\n=== Todos os testes da camada DAO passaram com sucesso! ===');

