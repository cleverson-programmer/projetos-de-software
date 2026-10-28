import { INTERVALO_CREDITO_MS } from '../config/regras.js';
import { TransacaoService } from '../services/TransacaoService.js';

/**
 * Executa uma rodada do crédito semestral e registra o resultado no console.
 * Nunca lança: uma falha não derruba o servidor.
 */
export function executarCreditoSemestral(service = new TransacaoService()) {
  try {
    const { semestre, creditados, jaCreditados } = service.creditarSemestre();
    if (creditados.length > 0) {
      for (const c of creditados) {
        console.log(
          `[Crédito semestral] ${semestre}: +${c.quantidade} moedas para ${c.nome} (novo saldo: ${c.saldoMoedas}).`
        );
      }
    } else {
      console.log(`[Crédito semestral] ${semestre}: nenhum crédito pendente (${jaCreditados} já creditado(s)).`);
    }
    return { semestre, creditados, jaCreditados };
  } catch (erro) {
    console.error('[Crédito semestral] falha ao executar o crédito automático:', erro.message);
    return null;
  }
}

/**
 * Inicia o crédito semestral automático: executa uma vez na hora e depois a cada
 * `INTERVALO_CREDITO_MS` (1 h), o que também cobre a virada do semestre com o servidor ligado.
 * Deve ser chamado somente no bloco de inicialização do servidor, nunca no import dos módulos.
 *
 * @returns {NodeJS.Timeout} o temporizador (não impede o processo de encerrar: `unref`)
 */
export function iniciarCreditoSemestral(service = new TransacaoService()) {
  executarCreditoSemestral(service);
  const temporizador = setInterval(() => executarCreditoSemestral(service), INTERVALO_CREDITO_MS);
  temporizador.unref();
  return temporizador;
}
