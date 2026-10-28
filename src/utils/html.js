const SUBSTITUICOES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa caracteres especiais de HTML para uso seguro em conteúdo e atributos.
 * @param {unknown} valor
 * @returns {string}
 */
export function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caractere) => SUBSTITUICOES[caractere]);
}
