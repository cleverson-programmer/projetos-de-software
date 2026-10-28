/**
 * Validação e normalização de CPF e CNPJ.
 * A forma canônica é a mascarada: 000.000.000-00 e 00.000.000/0000-00.
 */

/** Remove tudo que não for dígito. */
export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function todosIguais(digitos) {
  return /^(\d)\1+$/.test(digitos);
}

function digitoVerificador(digitos, pesos) {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += Number(digitos[i]) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(digitos) {
  if (digitos.length !== 11 || todosIguais(digitos)) return false;
  const d1 = digitoVerificador(digitos, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(digitos, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digitos[9]) && d2 === Number(digitos[10]);
}

function cnpjValido(digitos) {
  if (digitos.length !== 14 || todosIguais(digitos)) return false;
  const d1 = digitoVerificador(digitos, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(digitos, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digitos[12]) && d2 === Number(digitos[13]);
}

/**
 * Valida o CPF (com ou sem máscara) e devolve a forma canônica `000.000.000-00`.
 * Retorna `null` se o valor for inválido.
 * @param {unknown} valor
 * @returns {string | null}
 */
export function normalizarCpf(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (!/^[\d.\-]+$/.test(texto)) return null;
  const d = somenteDigitos(texto);
  if (!cpfValido(d)) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida o CNPJ (com ou sem máscara) e devolve a forma canônica `00.000.000/0000-00`.
 * Retorna `null` se o valor for inválido.
 * @param {unknown} valor
 * @returns {string | null}
 */
export function normalizarCnpj(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (!/^[\d.\-/]+$/.test(texto)) return null;
  const d = somenteDigitos(texto);
  if (!cnpjValido(d)) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
