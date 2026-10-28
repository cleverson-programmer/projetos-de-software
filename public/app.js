// ============================================================================
// Front-end MVC Client - Sistema de Moeda Estudantil (Sprint 3)
// Bootstrap: lê a sessão e escolhe entre a tela de login e a área do perfil.
// ============================================================================
import { apiRequest, definirAoSessaoExpirada, MENSAGEM_SESSAO_EXPIRADA } from './js/api.js';
import * as sessao from './js/sessao.js';
import { ativarFallbackDeFotos, mostrarErro, mostrarMensagem } from './js/util.js';
import { atualizarCabecalho, encerrarAbas, iniciarAbas } from './js/nav.js';
import { iniciarLogin } from './js/views/login.js';
import { abasAluno } from './js/views/aluno.js';
import { abasProfessor } from './js/views/professor.js';
import { abasEmpresa } from './js/views/empresa.js';

const ABAS_POR_PERFIL = {
  ALUNO: abasAluno,
  PROFESSOR: abasProfessor,
  EMPRESA: abasEmpresa,
};

const el = (id) => document.getElementById(id);

function mostrarLogin() {
  encerrarAbas();
  atualizarCabecalho(null);
  el('view-app').classList.add('hidden');
  el('view-login').classList.remove('hidden');
  el('abas').innerHTML = '';
  el('painel').innerHTML = '';
}

function sair() {
  sessao.limpar();
  mostrarLogin();
}

async function mostrarApp(usuario) {
  const montarAbas = ABAS_POR_PERFIL[usuario.tipo];
  if (!montarAbas) {
    sessao.limpar();
    mostrarLogin();
    throw new Error('Perfil de usuário desconhecido.');
  }

  el('view-login').classList.add('hidden');
  el('view-app').classList.remove('hidden');
  atualizarCabecalho(usuario);

  const ctx = {
    usuario,
    sair,
    atualizarSaldo(saldoMoedas) {
      atualizarCabecalho(sessao.atualizarSaldo(saldoMoedas));
    },
    atualizarUsuario(parcial) {
      atualizarCabecalho(sessao.atualizarUsuario(parcial));
    },
  };

  await iniciarAbas({ navEl: el('abas'), painelEl: el('painel'), abas: montarAbas(ctx) });
}

async function iniciar() {
  definirAoSessaoExpirada(() => {
    mostrarLogin();
    mostrarMensagem(MENSAGEM_SESSAO_EXPIRADA, 'error');
  });

  ativarFallbackDeFotos(el('painel'));
  el('btn-sair').addEventListener('click', () => {
    sair();
    mostrarMensagem('Você saiu do sistema.');
  });
  iniciarLogin({ aoAutenticar: mostrarApp });

  if (!sessao.obterToken()) {
    mostrarLogin();
    return;
  }

  // Restaura a sessão: confirma o token no servidor e atualiza os dados (inclusive o saldo).
  try {
    const { usuario } = await apiRequest('/api/auth/me');
    await mostrarApp(sessao.atualizarUsuario(usuario));
  } catch (erro) {
    if (!erro.sessaoExpirada) {
      sessao.limpar();
      mostrarLogin();
      mostrarErro(erro);
    }
  }
}

if (typeof document !== 'undefined') {
  iniciar();
}
