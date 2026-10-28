import { InstituicaoEnsinoController } from './controllers/InstituicaoEnsinoController.js';
import { AlunoController } from './controllers/AlunoController.js';
import { EmpresaParceiraController } from './controllers/EmpresaParceiraController.js';
import { ProfessorController } from './controllers/ProfessorController.js';
import { AuthController } from './controllers/AuthController.js';
import { VantagemController } from './controllers/VantagemController.js';
import { TransacaoController } from './controllers/TransacaoController.js';

const instituicaoController = new InstituicaoEnsinoController();
const alunoController = new AlunoController();
const empresaController = new EmpresaParceiraController();
const professorController = new ProfessorController();
const authController = new AuthController();
const vantagemController = new VantagemController();
const transacaoController = new TransacaoController();

/**
 * Tabela de rotas da API.
 *
 * - `metodo`: método HTTP.
 * - `padrao`: RegExp aplicada ao pathname; os grupos de captura viram `params` (strings).
 * - `publica: true`: dispensa autenticação. Rotas sem esta marca exigem token (seguro por omissão).
 * - `perfis`: perfis autorizados (ALUNO, PROFESSOR, EMPRESA); sem a lista, qualquer perfil autenticado.
 * - `proprietario`: perfil dono do recurso; o primeiro parâmetro da URL deve ser o id do usuário autenticado.
 * - `handler(req, res, params)`: executa a ação (pode ser assíncrono).
 */
export const rotas = [
  // Autenticação
  { metodo: 'POST', padrao: /^\/api\/auth\/login$/, publica: true, handler: (req, res) => authController.login(req, res) },
  { metodo: 'GET', padrao: /^\/api\/auth\/me$/, handler: (req, res) => authController.me(req, res) },

  // Instituições de Ensino (necessárias ao cadastro público de aluno)
  { metodo: 'GET', padrao: /^\/api\/instituicoes$/, publica: true, handler: (req, res) => instituicaoController.listar(req, res) },

  // Alunos
  { metodo: 'POST', padrao: /^\/api\/alunos$/, publica: true, handler: (req, res) => alunoController.criar(req, res) },
  {
    metodo: 'GET',
    padrao: /^\/api\/alunos\/destinatarios$/,
    perfis: ['PROFESSOR'],
    handler: (req, res) => alunoController.destinatarios(req, res),
  },
  {
    metodo: 'GET',
    padrao: /^\/api\/alunos\/(\d+)$/,
    perfis: ['ALUNO'],
    proprietario: 'ALUNO',
    handler: (req, res, [id]) => alunoController.buscarPorId(req, res, Number(id)),
  },
  {
    metodo: 'PUT',
    padrao: /^\/api\/alunos\/(\d+)$/,
    perfis: ['ALUNO'],
    proprietario: 'ALUNO',
    handler: (req, res, [id]) => alunoController.atualizar(req, res, Number(id)),
  },
  {
    metodo: 'DELETE',
    padrao: /^\/api\/alunos\/(\d+)$/,
    perfis: ['ALUNO'],
    proprietario: 'ALUNO',
    handler: (req, res, [id]) => alunoController.excluir(req, res, Number(id)),
  },

  // Empresas Parceiras
  { metodo: 'POST', padrao: /^\/api\/empresas$/, publica: true, handler: (req, res) => empresaController.criar(req, res) },
  {
    metodo: 'GET',
    padrao: /^\/api\/empresas\/(\d+)$/,
    perfis: ['EMPRESA'],
    proprietario: 'EMPRESA',
    handler: (req, res, [id]) => empresaController.buscarPorId(req, res, Number(id)),
  },
  {
    metodo: 'PUT',
    padrao: /^\/api\/empresas\/(\d+)$/,
    perfis: ['EMPRESA'],
    proprietario: 'EMPRESA',
    handler: (req, res, [id]) => empresaController.atualizar(req, res, Number(id)),
  },
  {
    metodo: 'DELETE',
    padrao: /^\/api\/empresas\/(\d+)$/,
    perfis: ['EMPRESA'],
    proprietario: 'EMPRESA',
    handler: (req, res, [id]) => empresaController.excluir(req, res, Number(id)),
  },

  // Professores (pré-cadastrados)
  {
    metodo: 'GET',
    padrao: /^\/api\/professores\/me$/,
    perfis: ['PROFESSOR'],
    handler: (req, res) => professorController.me(req, res),
  },

  // Vantagens: catálogo do aluno e gestão pela empresa dona (a posse é conferida no service)
  {
    metodo: 'GET',
    padrao: /^\/api\/vantagens$/,
    perfis: ['ALUNO'],
    handler: (req, res) => vantagemController.listar(req, res),
  },
  {
    metodo: 'GET',
    padrao: /^\/api\/vantagens\/minhas$/,
    perfis: ['EMPRESA'],
    handler: (req, res) => vantagemController.minhas(req, res),
  },
  {
    metodo: 'POST',
    padrao: /^\/api\/vantagens$/,
    perfis: ['EMPRESA'],
    handler: (req, res) => vantagemController.criar(req, res),
  },
  {
    metodo: 'PUT',
    padrao: /^\/api\/vantagens\/(\d+)$/,
    perfis: ['EMPRESA'],
    handler: (req, res, [id]) => vantagemController.atualizar(req, res, id),
  },
  {
    metodo: 'PATCH',
    padrao: /^\/api\/vantagens\/(\d+)\/ativa$/,
    perfis: ['EMPRESA'],
    handler: (req, res, [id]) => vantagemController.alterarAtiva(req, res, id),
  },
  {
    metodo: 'DELETE',
    padrao: /^\/api\/vantagens\/(\d+)$/,
    perfis: ['EMPRESA'],
    handler: (req, res, [id]) => vantagemController.excluir(req, res, id),
  },
  {
    metodo: 'POST',
    padrao: /^\/api\/vantagens\/(\d+)\/resgatar$/,
    perfis: ['ALUNO'],
    handler: (req, res, [id]) => transacaoController.resgatar(req, res, id),
  },

  // Transações de moedas
  {
    metodo: 'POST',
    padrao: /^\/api\/transacoes\/enviar-moedas$/,
    perfis: ['PROFESSOR'],
    handler: (req, res) => transacaoController.enviarMoedas(req, res),
  },
  {
    metodo: 'GET',
    padrao: /^\/api\/extrato$/,
    handler: (req, res) => transacaoController.extrato(req, res),
  },
  {
    metodo: 'POST',
    padrao: /^\/api\/creditos-semestrais\/executar$/,
    perfis: ['PROFESSOR'],
    handler: (req, res) => transacaoController.executarCreditoSemestral(req, res),
  },
];
