/**
 * Cria um erro de negócio com código HTTP (padrão do projeto: `error.statusCode`).
 * @param {number} statusCode
 * @param {string} mensagem
 * @param {Record<string, string>} [headers] cabeçalhos extras da resposta (ex.: Retry-After)
 */
export function criarErro(statusCode, mensagem, headers) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  if (headers) erro.headers = headers;
  return erro;
}

/**
 * Converte erros de constraint do SQLite (node:sqlite) em erros HTTP 409.
 * Retorna `null` quando o erro não é de banco de dados / constraint.
 *
 * Códigos estendidos: 275 = CHECK, 787 = FOREIGN KEY, 1811 = ON DELETE RESTRICT em cascata,
 * 2067/1555 = UNIQUE/PRIMARY KEY.
 */
export function traduzirErroBanco(erro) {
  if (!erro || erro.code !== 'ERR_SQLITE_ERROR') return null;

  const codigo = erro.errcode;
  if (codigo === 2067 || codigo === 1555) {
    return criarErro(409, 'Já existe um registro com estes dados.');
  }
  if (codigo === 787 || codigo === 1811) {
    return criarErro(409, 'Operação violaria uma regra de integridade: existem registros vinculados.');
  }
  if (codigo === 275) {
    return criarErro(409, 'Operação violaria uma regra de integridade.');
  }
  if (typeof codigo === 'number' && (codigo & 0xff) === 19) {
    return criarErro(409, 'Operação violaria uma regra de integridade.');
  }
  return null;
}
