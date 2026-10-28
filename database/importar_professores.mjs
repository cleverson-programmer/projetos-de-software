import '../src/config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { ProfessorService } from '../src/services/ProfessorService.js';
import { TransacaoService } from '../src/services/TransacaoService.js';

/**
 * Importa professores pré-cadastrados (enviados pela instituição) a partir de um arquivo JSON.
 *
 * Uso: npm run professores:importar -- <arquivo.json>
 *
 * Cada item: { nome, email, login, cpf, departamento, instituicaoId, senha? }
 * Sem `senha`, o sistema gera uma senha inicial aleatória. Um item inválido não impede os demais;
 * o código de saída é 1 se algum item falhar.
 */
const caminhoArquivo = process.argv[2];

if (!caminhoArquivo) {
  console.error('Informe o arquivo JSON. Uso: npm run professores:importar -- <arquivo.json>');
  process.exit(1);
}

let lista;
try {
  lista = JSON.parse(fs.readFileSync(path.resolve(caminhoArquivo), 'utf8'));
} catch (error) {
  console.error(`Não foi possível ler o arquivo "${caminhoArquivo}": ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(lista)) {
  console.error('O arquivo deve conter uma lista (array JSON) de professores.');
  process.exit(1);
}

const service = new ProfessorService();
const resultados = service.importarProfessores(lista);

console.log('\n=== Importação de professores ===\n');
for (const r of resultados) {
  if (r.ok) {
    console.log(`[OK]   #${r.indice + 1} ${r.professor.nome}`);
    console.log(`       login: ${r.login}   senha inicial: ${r.senhaInicial}`);
  } else {
    console.log(`[ERRO] #${r.indice + 1} ${r.login ?? '(sem login)'}: ${r.erro}`);
  }
}

const criados = resultados.filter((r) => r.ok).length;
const falhas = resultados.length - criados;
console.log(`\nCriados: ${criados}   Falhas: ${falhas}`);
if (criados > 0) {
  console.log('Oriente cada professor a trocar a senha inicial no primeiro acesso.');
}

// Credita as 1.000 moedas do semestre atual aos professores recém-importados.
// É idempotente: quem já recebeu o crédito do semestre não recebe de novo.
if (criados > 0) {
  const credito = new TransacaoService().creditarSemestre();
  console.log(`\n=== Crédito semestral (${credito.semestre}) ===`);
  if (credito.creditados.length === 0) {
    console.log('Nenhum professor pendente de crédito.');
  }
  for (const c of credito.creditados) {
    console.log(`[OK]   ${c.nome}: +${c.quantidade} moedas (saldo: ${c.saldoMoedas})`);
  }
}

process.exitCode = falhas > 0 ? 1 : 0;
