import { AlunoDAO } from '../dao/AlunoDAO.js';
import { UsuarioDAO } from '../dao/UsuarioDAO.js';
import { InstituicaoEnsinoDAO } from '../dao/InstituicaoEnsinoDAO.js';
import { UsuarioCredenciaisService } from './UsuarioCredenciaisService.js';
import { criarErro } from '../utils/erros.js';
import { normalizarCpf, somenteDigitos } from '../utils/documentos.js';
import { textoObrigatorio } from '../utils/validacao.js';

const REGEX_RG = /^[A-Z]{2}-\d{2}\.\d{3}\.\d{3}$/;
const MSG_RG = 'O RG deve seguir o formato XX-99.999.999 (duas letras maiúsculas e oito números).';

export class AlunoService {
  constructor(
    alunoDAO = new AlunoDAO(),
    usuarioDAO = new UsuarioDAO(),
    instituicaoDAO = new InstituicaoEnsinoDAO(),
    credenciaisService = new UsuarioCredenciaisService(usuarioDAO)
  ) {
    this.alunoDAO = alunoDAO;
    this.usuarioDAO = usuarioDAO;
    this.instituicaoDAO = instituicaoDAO;
    this.credenciaisService = credenciaisService;
  }

  /**
   * Lista os alunos como destinatários de moedas (id, nome, curso, instituicaoNome).
   */
  listarDestinatarios() {
    return this.alunoDAO.findAllDestinatarios();
  }

  buscarPorId(id) {
    const aluno = this.alunoDAO.findById(id);
    if (!aluno) {
      throw criarErro(404, 'Aluno não encontrado.');
    }
    return aluno;
  }

  cadastrarAluno(dados = {}) {
    const base = this.credenciaisService.validarParaCadastro(dados, { labelNome: 'Nome' });

    const camposEspecificos = [
      { campo: 'cpf', label: 'CPF' },
      { campo: 'endereco', label: 'Endereço' },
      { campo: 'curso', label: 'Curso' },
    ];

    const limpos = {};
    for (const { campo, label } of camposEspecificos) {
      const texto = textoObrigatorio(dados[campo]);
      if (texto === null) {
        throw criarErro(400, `O campo "${label}" é obrigatório.`);
      }
      limpos[campo] = texto;
    }

    if (dados.instituicaoId === undefined || dados.instituicaoId === null || String(dados.instituicaoId).trim() === '') {
      throw criarErro(400, 'O campo "Instituição de Ensino" é obrigatório.');
    }

    const cpf = normalizarCpf(limpos.cpf);
    if (cpf === null) {
      throw criarErro(400, 'CPF inválido.');
    }

    let rgLimpo = null;
    if (dados.rg !== undefined && dados.rg !== null && dados.rg !== '') {
      if (typeof dados.rg !== 'string') {
        throw criarErro(400, MSG_RG);
      }
      rgLimpo = dados.rg.trim() || null;
      if (rgLimpo && !REGEX_RG.test(rgLimpo)) {
        throw criarErro(400, MSG_RG);
      }
    }

    const instituicao = this.instituicaoDAO.findById(dados.instituicaoId);
    if (!instituicao) {
      throw criarErro(400, 'A Instituição de Ensino selecionada não está cadastrada.');
    }

    this.credenciaisService.garantirUnicidade({ email: base.email, login: base.login });

    if (this.alunoDAO.findByCpf(cpf)) {
      throw criarErro(409, 'Já existe um aluno cadastrado com este CPF.');
    }

    return this.alunoDAO.create({
      nome: base.nome,
      email: base.email,
      login: base.login,
      senha: base.senha,
      cpf,
      rg: rgLimpo,
      endereco: limpos.endereco,
      curso: limpos.curso,
      instituicaoId: instituicao.id,
    });
  }

  atualizarAluno(id, dados = {}) {
    const alunoAtual = this.buscarPorId(id);
    const base = this.credenciaisService.validarParaAtualizacao(alunoAtual, dados, { labelNome: 'Nome' });

    const textos = {};
    for (const [campo, label] of [
      ['endereco', 'Endereço'],
      ['curso', 'Curso'],
    ]) {
      if (dados[campo] !== undefined) {
        const texto = textoObrigatorio(dados[campo]);
        if (texto === null) {
          throw criarErro(400, `O campo "${label}" não pode ficar vazio.`);
        }
        textos[campo] = texto;
      }
    }

    let rg;
    if (dados.rg !== undefined) {
      if (dados.rg !== null && typeof dados.rg !== 'string') {
        throw criarErro(400, MSG_RG);
      }
      const rgLimpo = dados.rg ? dados.rg.trim() : '';
      if (rgLimpo !== '' && !REGEX_RG.test(rgLimpo)) {
        throw criarErro(400, MSG_RG);
      }
      rg = rgLimpo || null;
    }

    let instituicaoId;
    if (dados.instituicaoId !== undefined) {
      const instituicao = this.instituicaoDAO.findById(dados.instituicaoId);
      if (!instituicao) {
        throw criarErro(400, 'A Instituição de Ensino selecionada não está cadastrada.');
      }
      instituicaoId = instituicao.id;
    }

    this.credenciaisService.garantirUnicidade({
      email: base.email !== undefined && base.email !== alunoAtual.email ? base.email : undefined,
      login: base.login !== undefined && base.login !== alunoAtual.login ? base.login : undefined,
      ignorarUsuarioId: alunoAtual.id,
    });

    // CPF só é validado/alterado se mudou (contas seed antigas continuam editáveis).
    let cpf;
    if (dados.cpf !== undefined) {
      if (typeof dados.cpf !== 'string') {
        throw criarErro(400, 'CPF inválido.');
      }
      if (somenteDigitos(dados.cpf) !== somenteDigitos(alunoAtual.cpf)) {
        cpf = normalizarCpf(dados.cpf);
        if (cpf === null) {
          throw criarErro(400, 'CPF inválido.');
        }
        const outroCpf = this.alunoDAO.findByCpf(cpf);
        if (outroCpf && outroCpf.id !== alunoAtual.id) {
          throw criarErro(409, 'Já existe outro aluno cadastrado com este CPF.');
        }
      }
    }

    return this.alunoDAO.update(alunoAtual.id, {
      nome: base.nome,
      email: base.email,
      login: base.login,
      senha: base.senha,
      cpf,
      rg,
      endereco: textos.endereco,
      curso: textos.curso,
      instituicaoId,
    });
  }

  excluirAluno(id) {
    this.buscarPorId(id);
    if (this.alunoDAO.possuiHistorico(id)) {
      throw criarErro(
        409,
        'Não é possível excluir a conta: o aluno possui moedas recebidas ou resgates de vantagens registrados.'
      );
    }
    return this.alunoDAO.delete(id);
  }
}
