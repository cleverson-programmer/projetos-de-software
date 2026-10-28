const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida o formato de um e-mail (texto, até 254 caracteres, sem espaços).
 */
export function emailValido(valor) {
  return typeof valor === 'string' && valor.length <= 254 && REGEX_EMAIL.test(valor.trim());
}

/**
 * Valida uma URL absoluta http(s) com até 500 caracteres.
 */
export function urlHttpValida(valor) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto === '' || texto.length > 500) return false;
  try {
    const url = new URL(texto);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Converte para inteiro seguro maior que zero.
 * Aceita número ou string só de dígitos. Retorna `null` se inválido.
 * @returns {number | null}
 */
export function inteiroPositivo(valor) {
  let numero;
  if (typeof valor === 'number') {
    numero = valor;
  } else if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) {
    numero = Number(valor.trim());
  } else {
    return null;
  }
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Retorna o texto aparado ou `null` se não for string ou ficar vazio.
 * @returns {string | null}
 */
export function textoObrigatorio(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto === '' ? null : texto;
}
