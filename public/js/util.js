// ============================================================================
// Utilitários compartilhados do front-end.
// Nenhum acesso a `document` em tempo de import: o DOM só é tocado dentro das funções.
// ============================================================================

export const ROTULOS_PERFIL = {
  ALUNO: 'Aluno',
  PROFESSOR: 'Professor',
  EMPRESA: 'Empresa parceira',
};

/** Escapa um valor para uso seguro em innerHTML (texto e atributos entre aspas). */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converte 'YYYY-MM-DD HH:MM:SS' (UTC, como vem da API) para data/hora local em pt-BR. */
export function formatarData(dataHora) {
  if (!dataHora) return '';
  const texto = String(dataHora).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(texto) ? `${texto.replace(' ', 'T')}Z` : texto;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return texto;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Ex.: 1 -> "1 moeda"; 1500 -> "1.500 moedas". */
export function formatarMoedas(quantidade) {
  const n = Number(quantidade) || 0;
  return `${n.toLocaleString('pt-BR')} ${Math.abs(n) === 1 ? 'moeda' : 'moedas'}`;
}

/** Devolve a URL normalizada somente se for http(s); caso contrário, null. */
export function urlFotoSegura(url) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * HTML da foto de uma vantagem (16:9). URL não-http(s) ou ausente mostra direto o fallback;
 * se a imagem falhar ao carregar, `ativarFallbackDeFotos` troca pelo fallback.
 */
export function renderFoto(url, nome) {
  const segura = urlFotoSegura(url);
  const img = segura
    ? `<img class="vantagem-foto" data-foto src="${escapeHtml(segura)}" alt="${escapeHtml(nome)}" loading="lazy" referrerpolicy="no-referrer" />`
    : '';
  const fallback = `<div class="foto-fallback${segura ? ' hidden' : ''}" role="img" aria-label="Imagem indisponível">Sem imagem</div>`;
  return `<div class="vantagem-media">${img}${fallback}</div>`;
}

/** Valor com sinal e cor (entrada = +, saída = −) para tabelas de extrato. */
export function renderValor(quantidade, entrada) {
  const classe = entrada ? 'valor-entrada' : 'valor-saida';
  const sinal = entrada ? '+' : '−';
  return `<span class="valor ${classe}">${sinal}${Number(quantidade).toLocaleString('pt-BR')}</span>`;
}

export function renderEstadoVazio(texto) {
  return `<div class="estado-vazio">${escapeHtml(texto)}</div>`;
}

export function renderCarregando(texto = 'Carregando...') {
  return `<div class="estado-carregando" role="status">${escapeHtml(texto)}</div>`;
}

export function renderErroPainel(texto) {
  return `<div class="estado-vazio estado-erro" role="alert">${escapeHtml(texto)}</div>`;
}

let temporizadorToast = null;

export function mostrarMensagem(texto, tipo = 'success') {
  const toastEl = document.getElementById('toast-feedback');
  if (!toastEl) return;
  toastEl.textContent = texto;
  toastEl.className = `toast ${tipo}`;
  if (temporizadorToast) clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(
    () => {
      toastEl.classList.add('hidden');
    },
    tipo === 'success' ? 4500 : 8000
  );
}

/** Mostra o erro no toast, exceto quando é a expiração de sessão (o app já avisou). */
export function mostrarErro(erro) {
  if (erro && erro.sessaoExpirada) return;
  mostrarMensagem(erro && erro.message ? erro.message : 'Erro inesperado.', 'error');
}

/**
 * Troca imagens que falharam por um aviso "Sem imagem". O evento `error` não borbulha,
 * então a escuta é feita na fase de captura (sem `onerror` inline, por causa da CSP).
 */
export function ativarFallbackDeFotos(raiz) {
  raiz.addEventListener(
    'error',
    (evento) => {
      const img = evento.target;
      if (!img || typeof img.matches !== 'function' || !img.matches('img[data-foto]')) return;
      img.classList.add('hidden');
      const fallback = img.parentElement && img.parentElement.querySelector('.foto-fallback');
      if (fallback) fallback.classList.remove('hidden');
    },
    true
  );
}
