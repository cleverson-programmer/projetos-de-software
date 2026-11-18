export function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export function text(value, label, max = 255) {
  if (typeof value !== 'string' || !value.trim()) fail(400, 'Informe ' + label + '.');
  const clean = value.trim();
  if (clean.length > max) fail(400, label + ' deve ter até ' + max + ' caracteres.');
  return clean;
}

export function email(value) {
  const clean = text(value, 'email', 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /[\r\n]/.test(clean)) fail(400, 'Informe um email válido.');
  return clean;
}

export function login(value) {
  const clean = text(value, 'login', 100).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._@-]{2,99}$/.test(clean)) fail(400, 'Login deve ter de 3 a 100 caracteres: letras, números, ponto, hífen, @ ou sublinhado.');
  return clean;
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
  return value;
}

export function integer(value, label, max = 2147483647) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > max) fail(400, label + ' deve ser um número inteiro positivo.');
  return value;
}

export function id(value) {
  if (!/^\d+$/.test(String(value))) fail(400, 'Identificador inválido.');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) fail(400, 'Identificador inválido.');
  return result;
}

export function cpf(value) {
  const raw = text(value, 'CPF', 20).replace(/[.\-\s]/g, '');
  if (!/^\d{11}$/.test(raw) || /^(\d)\1+$/.test(raw)) fail(400, 'CPF deve conter 11 dígitos.');
  return raw.slice(0, 3) + '.' + raw.slice(3, 6) + '.' + raw.slice(6, 9) + '-' + raw.slice(9);
}

export function cnpj(value) {
  const raw = text(value, 'CNPJ', 22).replace(/[./\-\s]/g, '');
  if (!/^\d{14}$/.test(raw) || /^(\d)\1+$/.test(raw)) fail(400, 'CNPJ deve conter 14 dígitos.');
  return raw.slice(0, 2) + '.' + raw.slice(2, 5) + '.' + raw.slice(5, 8) + '/' + raw.slice(8, 12) + '-' + raw.slice(12);
}

export function rg(value) {
  const clean = text(value, 'RG', 20);
  if (clean.length < 4) fail(400, 'Informe um RG válido.');
  return clean;
}

export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail(400, 'Identificador de operação inválido. Atualize a página e tente novamente.');
  return value;
}
