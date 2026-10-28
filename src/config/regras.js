/**
 * Constantes de regras de negócio e de segurança do sistema.
 */

/** Moedas creditadas a cada professor por semestre (acumulativas). */
export const CREDITO_SEMESTRAL_MOEDAS = 1000;

/** Validade do token de autenticação (8 horas). */
export const TOKEN_TTL_SEGUNDOS = 8 * 3600;

/** Tamanho máximo do corpo JSON aceito pela API (1 MB). */
export const LIMITE_CORPO_BYTES = 1048576;

/** Quantidade de falhas de login (por login + IP) que dispara o bloqueio. */
export const LOGIN_MAX_FALHAS = 5;

/** Janela de contagem das falhas de login (15 minutos). */
export const LOGIN_JANELA_MS = 900000;

/** Intervalo de verificação do crédito semestral automático (1 hora). */
export const INTERVALO_CREDITO_MS = 3600000;
