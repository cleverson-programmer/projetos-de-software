// ============================================================================
// Tela deslogada: login e cadastros públicos (Aluno e Empresa Parceira).
// O HTML dos formulários está em index.html; este módulo liga o comportamento.
// ============================================================================
import { apiRequest } from '../api.js';
import * as sessao from '../sessao.js';
import { escapeHtml, mostrarMensagem, mostrarErro } from '../util.js';
import { aplicarMascaraCPF, aplicarMascaraRG, aplicarMascaraCNPJ, ativarMascara } from '../mascaras.js';

/** <option>s do select de instituições (pré-cadastradas). */
export function renderOpcoesInstituicoes(instituicoes = []) {
  const opcoes = instituicoes
    .map((i) => `<option value="${Number(i.id)}">${escapeHtml(i.nome)}</option>`)
    .join('');
  return `<option value="">Selecione a instituição...</option>${opcoes}`;
}

const valor = (id) => document.getElementById(id).value;

async function carregarInstituicoes() {
  const select = document.getElementById('aluno-instituicao');
  try {
    const instituicoes = await apiRequest('/api/instituicoes');
    select.innerHTML = renderOpcoesInstituicoes(instituicoes);
  } catch (erro) {
    select.innerHTML = '<option value="">Não foi possível carregar as instituições</option>';
    mostrarErro(erro);
  }
}

/** Liga login, cadastros e máscaras. `aoAutenticar(usuario)` é chamado após o login. */
export function iniciarLogin({ aoAutenticar }) {
  ativarMascara(document.getElementById('aluno-cpf'), aplicarMascaraCPF);
  ativarMascara(document.getElementById('aluno-rg'), aplicarMascaraRG);
  ativarMascara(document.getElementById('empresa-cnpj'), aplicarMascaraCNPJ);

  carregarInstituicoes();

  const formLogin = document.getElementById('form-login');
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = document.getElementById('btn-entrar');
    botao.disabled = true;
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { login: valor('login-usuario'), senha: valor('login-senha') },
      });
      sessao.salvar(res.token, res.usuario);
      formLogin.reset();
      await aoAutenticar(res.usuario);
    } catch (erro) {
      mostrarErro(erro);
    } finally {
      botao.disabled = false;
    }
  });

  const formAluno = document.getElementById('form-aluno');
  formAluno.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = document.getElementById('btn-cadastrar-aluno');
    botao.disabled = true;
    try {
      const login = valor('aluno-login');
      await apiRequest('/api/alunos', {
        method: 'POST',
        body: {
          nome: valor('aluno-nome'),
          cpf: valor('aluno-cpf'),
          rg: valor('aluno-rg'),
          email: valor('aluno-email'),
          endereco: valor('aluno-endereco'),
          instituicaoId: Number(valor('aluno-instituicao')),
          curso: valor('aluno-curso'),
          login,
          senha: valor('aluno-senha'),
        },
      });
      formAluno.reset();
      document.getElementById('login-usuario').value = login;
      mostrarMensagem('Cadastro de aluno realizado! Entre com seu login e senha.');
    } catch (erro) {
      mostrarErro(erro);
    } finally {
      botao.disabled = false;
    }
  });

  const formEmpresa = document.getElementById('form-empresa');
  formEmpresa.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = document.getElementById('btn-cadastrar-empresa');
    botao.disabled = true;
    try {
      const login = valor('empresa-login');
      await apiRequest('/api/empresas', {
        method: 'POST',
        body: {
          nome: valor('empresa-nome'),
          cnpj: valor('empresa-cnpj'),
          email: valor('empresa-email'),
          descricao: valor('empresa-descricao'),
          login,
          senha: valor('empresa-senha'),
        },
      });
      formEmpresa.reset();
      document.getElementById('login-usuario').value = login;
      mostrarMensagem('Cadastro da empresa parceira realizado! Entre com seu login e senha.');
    } catch (erro) {
      mostrarErro(erro);
    } finally {
      botao.disabled = false;
    }
  });
}
