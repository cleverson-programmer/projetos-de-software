/**
 * Retorna o semestre letivo no formato `YYYY/S` (S = 1 de janeiro a junho; S = 2 de julho a dezembro).
 * Usa a data local do servidor.
 * @param {Date} [data]
 * @returns {string}
 */
export function semestreAtual(data = new Date()) {
  const ano = data.getFullYear();
  const semestre = data.getMonth() <= 5 ? 1 : 2;
  return `${ano}/${semestre}`;
}
