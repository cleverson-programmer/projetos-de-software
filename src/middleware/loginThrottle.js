import { LOGIN_JANELA_MS, LOGIN_MAX_FALHAS } from '../config/regras.js';
import { criarErro } from '../utils/erros.js';

const MAX_CHAVES = 10000;
const INTERVALO_LIMPEZA_MS = 60000;

/**
 * Cria um controle de tentativas de login por chave `login|ip`.
 * Após `maxFalhas` falhas dentro de `janelaMs`, novas tentativas recebem 429 (com Retry-After).
 */
export function criarLoginThrottle({ maxFalhas = LOGIN_MAX_FALHAS, janelaMs = LOGIN_JANELA_MS, maxChaves = MAX_CHAVES } = {}) {
  /** @type {Map<string, number[]>} */
  const falhas = new Map();
  let timerLimpeza = null;

  const chave = (login, ip) => `${String(login ?? '').trim().toLowerCase()}|${ip ?? 'desconhecido'}`;

  function recentes(chaveAtual, agora) {
    const lista = (falhas.get(chaveAtual) ?? []).filter((t) => agora - t < janelaMs);
    if (lista.length === 0) falhas.delete(chaveAtual);
    else falhas.set(chaveAtual, lista);
    return lista;
  }

  function limpar(agora = Date.now()) {
    for (const k of [...falhas.keys()]) recentes(k, agora);
  }

  function garantirLimpezaPeriodica() {
    if (timerLimpeza) return;
    timerLimpeza = setInterval(() => {
      limpar();
      if (falhas.size === 0) {
        clearInterval(timerLimpeza);
        timerLimpeza = null;
      }
    }, INTERVALO_LIMPEZA_MS);
    timerLimpeza.unref();
  }

  return {
    /** Lança 429 se a chave já atingiu o limite de falhas na janela. */
    verificarBloqueio(login, ip, agora = Date.now()) {
      const lista = recentes(chave(login, ip), agora);
      if (lista.length >= maxFalhas) {
        const segundos = Math.max(1, Math.ceil((lista[0] + janelaMs - agora) / 1000));
        throw criarErro(
          429,
          'Muitas tentativas de login malsucedidas. Aguarde alguns minutos e tente novamente.',
          { 'Retry-After': String(segundos) }
        );
      }
    },

    registrarFalha(login, ip, agora = Date.now()) {
      const k = chave(login, ip);
      if (!falhas.has(k) && falhas.size >= maxChaves) {
        limpar(agora);
        if (falhas.size >= maxChaves) {
          falhas.delete(falhas.keys().next().value);
        }
      }
      const lista = recentes(k, agora);
      lista.push(agora);
      falhas.set(k, lista);
      garantirLimpezaPeriodica();
    },

    registrarSucesso(login, ip) {
      falhas.delete(chave(login, ip));
    },

    reiniciar() {
      falhas.clear();
    },

    get tamanho() {
      return falhas.size;
    },
  };
}

/** Instância usada pelo AuthController. */
export const loginThrottle = criarLoginThrottle();
