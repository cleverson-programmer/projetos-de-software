// ============================================================================
// Cabeçalho do usuário e navegação por abas (role="tablist").
// ============================================================================
import { escapeHtml, formatarMoedas, mostrarErro, renderCarregando, renderErroPainel, ROTULOS_PERFIL } from './util.js';

/** HTML dos botões das abas. Cada aba: { id, rotulo, montar(painel, { vigente }) }. */
export function renderAbas(abas, ativaId) {
  return abas
    .map((aba) => {
      const ativa = aba.id === ativaId;
      return `<button type="button" role="tab" class="tab-btn${ativa ? ' active' : ''}" id="aba-${escapeHtml(aba.id)}" data-aba="${escapeHtml(aba.id)}" aria-selected="${ativa}" aria-controls="painel" tabindex="${ativa ? '0' : '-1'}">${escapeHtml(aba.rotulo)}</button>`;
    })
    .join('');
}

/** Mostra/oculta o bloco de usuário do cabeçalho (nome, badge do perfil, saldo e Sair). */
export function atualizarCabecalho(usuario) {
  const bloco = document.getElementById('topbar-usuario');
  if (!usuario) {
    bloco.classList.add('hidden');
    return;
  }
  document.getElementById('usuario-nome').textContent = usuario.nome;
  document.getElementById('usuario-badge').textContent = ROTULOS_PERFIL[usuario.tipo] || usuario.tipo;

  const saldoEl = document.getElementById('usuario-saldo');
  if (usuario.tipo === 'EMPRESA' || usuario.saldoMoedas === undefined || usuario.saldoMoedas === null) {
    saldoEl.classList.add('hidden');
    saldoEl.textContent = '';
  } else {
    saldoEl.textContent = `Saldo: ${formatarMoedas(usuario.saldoMoedas)}`;
    saldoEl.classList.remove('hidden');
  }
  bloco.classList.remove('hidden');
}

let controlador = null;
let selecaoAtual = 0;

/** Descarta as escutas das abas e invalida carregamentos em andamento (logout/sessão expirada). */
export function encerrarAbas() {
  if (controlador) controlador.abort();
  controlador = null;
  selecaoAtual += 1;
}

/**
 * Monta a barra de abas em `navEl` e carrega o conteúdo da aba escolhida em `painelEl`.
 * Chamar de novo (novo login) descarta as escutas anteriores.
 */
export function iniciarAbas({ navEl, painelEl, abas, inicial = abas[0]?.id }) {
  if (controlador) controlador.abort();
  controlador = new AbortController();
  const { signal } = controlador;

  async function selecionar(id, { focar = false } = {}) {
    const aba = abas.find((a) => a.id === id);
    if (!aba) return;

    selecaoAtual += 1;
    const minhaSelecao = selecaoAtual;
    const vigente = () => minhaSelecao === selecaoAtual && !signal.aborted;

    navEl.innerHTML = renderAbas(abas, id);
    if (focar) navEl.querySelector(`[data-aba="${CSS.escape(id)}"]`).focus();
    painelEl.setAttribute('aria-labelledby', `aba-${id}`);
    painelEl.innerHTML = renderCarregando();

    try {
      await aba.montar(painelEl, { vigente });
    } catch (erro) {
      // Sessão expirada: o app já voltou ao login; não escreve nada no painel.
      if (!vigente() || erro.sessaoExpirada) return;
      painelEl.innerHTML = renderErroPainel(erro.message);
      mostrarErro(erro);
    }
  }

  navEl.addEventListener(
    'click',
    (evento) => {
      const botao = evento.target.closest('[data-aba]');
      if (botao) selecionar(botao.dataset.aba);
    },
    { signal }
  );

  navEl.addEventListener(
    'keydown',
    (evento) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(evento.key)) return;
      const atual = abas.findIndex((a) => a.id === navEl.querySelector('[aria-selected="true"]')?.dataset.aba);
      let proximo = atual;
      if (evento.key === 'ArrowRight') proximo = (atual + 1) % abas.length;
      if (evento.key === 'ArrowLeft') proximo = (atual - 1 + abas.length) % abas.length;
      if (evento.key === 'Home') proximo = 0;
      if (evento.key === 'End') proximo = abas.length - 1;
      evento.preventDefault();
      selecionar(abas[proximo].id, { focar: true });
    },
    { signal }
  );

  return selecionar(inicial);
}
