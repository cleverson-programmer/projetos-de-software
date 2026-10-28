// ============================================================================
// Máscaras de CPF, RG e CNPJ (funções puras) e ligação a campos de formulário.
// ============================================================================

export function aplicarMascaraCPF(valor) {
  return String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function aplicarMascaraRG(valor) {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  let letras = '';
  let numeros = '';

  for (const ch of limpo) {
    if (letras.length < 2) {
      if (/[A-Z]/.test(ch)) letras += ch;
    } else if (numeros.length < 8) {
      if (/[0-9]/.test(ch)) numeros += ch;
    }
  }

  if (!numeros) return letras;

  let formatado = `${letras}-${numeros.slice(0, 2)}`;
  if (numeros.length > 2) formatado += `.${numeros.slice(2, 5)}`;
  if (numeros.length > 5) formatado += `.${numeros.slice(5, 8)}`;
  return formatado;
}

export function aplicarMascaraCNPJ(valor) {
  return String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Aplica a máscara enquanto o usuário digita no campo. */
export function ativarMascara(campo, mascara) {
  if (!campo) return;
  campo.addEventListener('input', () => {
    campo.value = mascara(campo.value);
  });
}
