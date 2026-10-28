import '../testes/prepararBancoTemporario.js';
import assert from 'node:assert/strict';
import { getDatabase, migrarSenhasLegadas } from '../config/database.js';
import { InstituicaoEnsinoDAO } from './InstituicaoEnsinoDAO.js';
import { UsuarioDAO } from './UsuarioDAO.js';
import { AlunoDAO } from './AlunoDAO.js';
import { EmpresaParceiraDAO } from './EmpresaParceiraDAO.js';
import { ProfessorDAO } from './ProfessorDAO.js';
import { VantagemDAO } from './VantagemDAO.js';
import { TransacaoDAO } from './TransacaoDAO.js';

const instituicaoDAO = new InstituicaoEnsinoDAO();
const usuarioDAO = new UsuarioDAO();
const alunoDAO = new AlunoDAO();
const empresaDAO = new EmpresaParceiraDAO();
const professorDAO = new ProfessorDAO();

console.log('=== Testando Camada de Persistência (Padrão DAO) ===\n');

// 1. Instituições de Ensino
const instituicoes = instituicaoDAO.findAll();
assert.ok(instituicoes.length >= 4, 'Deve retornar as instituições pré-cadastradas');
console.log(`[OK] InstituicaoEnsinoDAO.findAll(): ${instituicoes.length} instituições carregadas.`);

// 2. Ciclo completo CRUD no AlunoDAO
const novoAluno = alunoDAO.create({
  nome: 'Aluno Teste DAO',
  email: 'teste.dao.aluno@pucminas.br',
  login: 'aluno.teste.dao',
  senha: 'senhaSegura123',
  cpf: '999.888.777-66',
  rg: 'MG-99.888.777',
  endereco: 'Rua Teste DAO, 100',
  curso: 'Engenharia de Software',
  instituicaoId: instituicoes[0].id,
});

assert.ok(novoAluno && novoAluno.id, 'Aluno deve ser criado com ID gerado');
assert.equal(novoAluno.nome, 'Aluno Teste DAO');
assert.equal(novoAluno.instituicao.nome, instituicoes[0].nome);
assert.equal(novoAluno.autenticar('aluno.teste.dao', 'senhaSegura123'), true);
console.log(`[OK] AlunoDAO.create(): Criado Aluno ID=${novoAluno.id} (${novoAluno.nome}).`);

const alunoAtualizado = alunoDAO.update(novoAluno.id, {
  nome: 'Aluno Teste DAO Atualizado',
  curso: 'Ciência da Computação',
});
assert.equal(alunoAtualizado.nome, 'Aluno Teste DAO Atualizado');
assert.equal(alunoAtualizado.curso, 'Ciência da Computação');
console.log(`[OK] AlunoDAO.update(): Atualizado Aluno ID=${novoAluno.id} para curso "${alunoAtualizado.curso}".`);

const alunoRemovido = alunoDAO.delete(novoAluno.id);
assert.equal(alunoRemovido, true);
assert.equal(alunoDAO.findById(novoAluno.id), null);
assert.equal(usuarioDAO.findById(novoAluno.id), null, 'ON DELETE CASCADE deve remover de ambos');
console.log(`[OK] AlunoDAO.delete(): Removido Aluno ID=${novoAluno.id} com integridade referencial.`);

// 3. Ciclo completo CRUD no EmpresaParceiraDAO
const novaEmpresa = empresaDAO.create({
  nome: 'Empresa Teste DAO Ltda',
  email: 'contato@empresatestedao.com.br',
  login: 'empresa.teste.dao',
  senha: 'senhaEmpresa123',
  cnpj: '77.888.999/0001-55',
  descricao: 'Parceira de testes da camada DAO',
});

assert.ok(novaEmpresa && novaEmpresa.id, 'Empresa deve ser criada com ID gerado');
assert.equal(novaEmpresa.cnpj, '77.888.999/0001-55');
console.log(`[OK] EmpresaParceiraDAO.create(): Criada Empresa ID=${novaEmpresa.id} (${novaEmpresa.nome}).`);

const empresaAtualizada = empresaDAO.update(novaEmpresa.id, {
  nome: 'Empresa Teste DAO S.A.',
  descricao: 'Descrição atualizada via DAO',
});
assert.equal(empresaAtualizada.nome, 'Empresa Teste DAO S.A.');
assert.equal(empresaAtualizada.descricao, 'Descrição atualizada via DAO');
console.log(`[OK] EmpresaParceiraDAO.update(): Atualizada Empresa ID=${novaEmpresa.id}.`);

const empresaRemovida = empresaDAO.delete(novaEmpresa.id);
assert.equal(empresaRemovida, true);
assert.equal(empresaDAO.findById(novaEmpresa.id), null);
console.log(`[OK] EmpresaParceiraDAO.delete(): Removida Empresa ID=${novaEmpresa.id} com integridade referencial.`);

// 4. ProfessorDAO (pré-cadastrados; sem exclusão pelo DAO)
const professoresSeed = professorDAO.findAll();
assert.ok(professoresSeed.length >= 2, 'Deve retornar os professores pré-cadastrados');
const milena = professorDAO.findById(1);
assert.equal(milena.tipo, 'PROFESSOR');
assert.ok(milena.departamento && milena.cpf, 'Professor deve ter departamento e CPF');
assert.ok(milena.instituicao && milena.instituicao.nome, 'Professor deve estar explicitamente vinculado a uma instituição');
assert.equal(milena.toJSON().senhaHash, undefined, 'toJSON não pode expor senhaHash');
console.log(`[OK] ProfessorDAO.findAll()/findById(): ${professoresSeed.length} professores com instituição.`);

const novoProfessor = professorDAO.create({
  nome: 'Professor Teste DAO',
  email: 'teste.dao.professor@pucminas.br',
  login: 'professor.teste.dao',
  senha: 'senhaProfessor123',
  cpf: '000.000.001-91',
  departamento: 'Departamento de Testes',
  instituicaoId: instituicoes[0].id,
});
try {
  assert.ok(novoProfessor && novoProfessor.id, 'Professor deve ser criado com ID gerado');
  assert.equal(novoProfessor.saldoMoedas, 0);
  assert.equal(novoProfessor.autenticar('professor.teste.dao', 'senhaProfessor123'), true);
  assert.equal(professorDAO.findByCpf('000.000.001-91').id, novoProfessor.id);
  assert.match(usuarioDAO.findById(novoProfessor.id).senhaHash, /^pbkdf2\$600000\$/);

  getDatabase().prepare('UPDATE professores SET saldo_moedas = 300 WHERE usuario_id = ?').run(novoProfessor.id);
  const professorAtualizado = professorDAO.update(novoProfessor.id, {
    nome: 'Professor Teste DAO Atualizado',
    departamento: 'Outro Departamento',
  });
  assert.equal(professorAtualizado.nome, 'Professor Teste DAO Atualizado');
  assert.equal(professorAtualizado.departamento, 'Outro Departamento');
  assert.equal(professorAtualizado.saldoMoedas, 300, 'update não pode alterar o saldo');
  console.log(`[OK] ProfessorDAO.create()/update(): Professor ID=${novoProfessor.id} criado e atualizado sem tocar no saldo.`);
} finally {
  getDatabase().prepare('DELETE FROM usuarios WHERE id = ?').run(novoProfessor.id);
}
assert.equal(professorDAO.findById(novoProfessor.id), null);

// 5. AlunoDAO: destinatários e exclusão protegida por histórico
const destinatarios = alunoDAO.findAllDestinatarios();
assert.ok(destinatarios.length >= 2);
for (const d of destinatarios) {
  assert.deepEqual(Object.keys(d).sort(), ['curso', 'id', 'instituicaoNome', 'nome']);
}
console.log(`[OK] AlunoDAO.findAllDestinatarios(): ${destinatarios.length} destinatários (id, nome, curso, instituicaoNome).`);

const alunoComHistorico = alunoDAO.create({
  nome: 'Aluno Com Historico DAO',
  email: 'historico.dao.aluno@pucminas.br',
  login: 'aluno.historico.dao',
  senha: 'senhaSegura123',
  cpf: '000.000.002-72',
  endereco: 'Rua Histórico, 1',
  curso: 'Engenharia de Software',
  instituicaoId: instituicoes[0].id,
});
assert.equal(alunoDAO.possuiHistorico(alunoComHistorico.id), false);
const db = getDatabase();
const transacaoId = Number(
  db.prepare("INSERT INTO transacoes (quantidade, tipo) VALUES (5, 'TRANSFERENCIA')").run().lastInsertRowid
);
db.prepare(
  'INSERT INTO transferencias_moedas (transacao_id, professor_id, aluno_id, motivo) VALUES (?, 1, ?, ?)'
).run(transacaoId, alunoComHistorico.id, 'Teste de histórico');
try {
  assert.equal(alunoDAO.possuiHistorico(alunoComHistorico.id), true);
  assert.throws(() => alunoDAO.delete(alunoComHistorico.id), (e) => e.code === 'ERR_SQLITE_ERROR' && (e.errcode & 0xff) === 19);
  assert.ok(alunoDAO.findById(alunoComHistorico.id), 'Aluno com histórico não pode ser removido');
  assert.ok(db.prepare('SELECT 1 FROM transacoes WHERE id = ?').get(transacaoId), 'Transação deve ser preservada');
  console.log('[OK] AlunoDAO.delete(): aluno com histórico não é removido e a transação é preservada.');
} finally {
  db.prepare('DELETE FROM transacoes WHERE id = ?').run(transacaoId);
}
assert.equal(alunoDAO.possuiHistorico(alunoComHistorico.id), false);
assert.equal(alunoDAO.delete(alunoComHistorico.id), true);

// 6. EmpresaParceiraDAO: exclusão protegida por resgates
const empresaComResgate = empresaDAO.create({
  nome: 'Empresa Com Resgate DAO',
  email: 'resgate.dao@empresa.com.br',
  login: 'empresa.resgate.dao',
  senha: 'senhaEmpresa123',
  cnpj: '00.000.000/0001-91',
});
assert.equal(empresaDAO.possuiVantagemComResgate(empresaComResgate.id), false);
const vantagemId = Number(
  db
    .prepare(
      "INSERT INTO vantagens (empresa_id, nome, descricao, foto_url, custo_moedas) VALUES (?, 'V', 'D', 'https://exemplo.com/f.png', 5)"
    )
    .run(empresaComResgate.id).lastInsertRowid
);
const transacaoResgateId = Number(
  db.prepare("INSERT INTO transacoes (quantidade, tipo) VALUES (5, 'RESGATE')").run().lastInsertRowid
);
db.prepare('INSERT INTO resgates_vantagens (transacao_id, aluno_id, vantagem_id, codigo_cupom) VALUES (?, 3, ?, ?)').run(
  transacaoResgateId,
  vantagemId,
  'CUPOM-TESTE-DAO'
);
try {
  assert.equal(empresaDAO.possuiVantagemComResgate(empresaComResgate.id), true);
  assert.throws(() => empresaDAO.delete(empresaComResgate.id), (e) => e.code === 'ERR_SQLITE_ERROR' && (e.errcode & 0xff) === 19);
  assert.ok(empresaDAO.findById(empresaComResgate.id), 'Empresa com resgate não pode ser removida');
  assert.ok(db.prepare('SELECT 1 FROM transacoes WHERE id = ?').get(transacaoResgateId), 'Transação deve ser preservada');
  console.log('[OK] EmpresaParceiraDAO.delete(): empresa com vantagem resgatada não é removida e a transação é preservada.');
} finally {
  db.prepare('DELETE FROM transacoes WHERE id = ?').run(transacaoResgateId);
}
assert.equal(empresaDAO.possuiVantagemComResgate(empresaComResgate.id), false);
assert.equal(empresaDAO.delete(empresaComResgate.id), true);
assert.equal(db.prepare('SELECT 1 FROM vantagens WHERE id = ?').get(vantagemId), undefined, 'Vantagens saem em cascata');
console.log('[OK] EmpresaParceiraDAO.delete(): empresa sem resgates é removida junto com suas vantagens.');

// 7. Migração de senhas legadas (bcrypt do seed antigo -> PBKDF2), idempotente
const HASH_LEGADO = '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';
const alunoLegado = alunoDAO.create({
  nome: 'Aluno Legado DAO',
  email: 'legado.dao@pucminas.br',
  login: 'aluno.legado.dao',
  senha: 'qualquer',
  cpf: '000.000.003-53',
  endereco: 'Rua Legado, 1',
  curso: 'Engenharia de Software',
  instituicaoId: instituicoes[0].id,
});
try {
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(HASH_LEGADO, alunoLegado.id);
  assert.equal(usuarioDAO.findById(alunoLegado.id).autenticar('aluno.legado.dao', '123456'), false, 'bcrypt não autentica');

  assert.ok(migrarSenhasLegadas(db) >= 1);
  const migrado = usuarioDAO.findById(alunoLegado.id);
  assert.match(migrado.senhaHash, /^pbkdf2\$600000\$/);
  assert.equal(migrado.autenticar('aluno.legado.dao', '123456'), true);

  const antes = db.prepare('SELECT id, senha_hash FROM usuarios ORDER BY id').all();
  assert.equal(migrarSenhasLegadas(db), 0, 'segunda execução não migra nada');
  assert.deepEqual(db.prepare('SELECT id, senha_hash FROM usuarios ORDER BY id').all(), antes);
  console.log('[OK] migrarSenhasLegadas(): converte bcrypt do seed para PBKDF2 e é idempotente.');
} finally {
  alunoDAO.delete(alunoLegado.id);
}

// 8. VantagemDAO e TransacaoDAO (operações atômicas de moedas)
{
  const vantagemDAO = new VantagemDAO();
  const transacaoDAO = new TransacaoDAO();
  const semestreTeste = '2099/1';

  const profTeste = professorDAO.create({
    nome: 'Professor Transacao DAO',
    email: 'transacao.dao.prof@pucminas.br',
    login: 'transacao.dao.prof',
    senha: 'senhaProfessor123',
    cpf: '000.000.004-34',
    departamento: 'Testes',
    instituicaoId: instituicoes[0].id,
    saldoMoedas: 500,
  });
  const alunoTeste = alunoDAO.create({
    nome: 'Aluno Transacao DAO',
    email: 'transacao.dao.aluno@pucminas.br',
    login: 'transacao.dao.aluno',
    senha: 'senhaSegura123',
    cpf: '000.000.005-15',
    endereco: 'Rua Transação, 1',
    curso: 'Engenharia de Software',
    instituicaoId: instituicoes[0].id,
  });
  const empresaTeste = empresaDAO.create({
    nome: 'Empresa Transacao DAO',
    email: 'transacao.dao@empresa.com.br',
    login: 'empresa.transacao.dao',
    senha: 'senhaEmpresa123',
    cnpj: '00.000.000/0002-72',
  });
  const saldoDe = (tabela, id) =>
    Number(db.prepare(`SELECT saldo_moedas AS s FROM ${tabela} WHERE usuario_id = ?`).get(id).s);

  try {
    // Vantagens: CRUD
    const vantagem = vantagemDAO.create({
      empresaId: empresaTeste.id,
      nome: 'Vantagem DAO',
      descricao: 'Descrição da vantagem',
      fotoUrl: 'https://exemplo.com/foto.png',
      custoMoedas: 40,
    });
    assert.ok(vantagem.id);
    assert.equal(vantagem.empresaNome, 'Empresa Transacao DAO');
    assert.equal(vantagem.ativa, true);
    assert.equal(vantagem.custoMoedas, 40);
    assert.equal(vantagemDAO.findById(vantagem.id).nome, 'Vantagem DAO');
    assert.equal(vantagemDAO.findById(999999), null);
    const editada = vantagemDAO.update(vantagem.id, {
      nome: 'Vantagem DAO 2',
      descricao: 'Nova',
      fotoUrl: 'https://exemplo.com/foto2.png',
      custoMoedas: 50,
    });
    assert.equal(editada.nome, 'Vantagem DAO 2');
    assert.equal(editada.custoMoedas, 50);
    assert.equal(vantagemDAO.update(999999, { nome: 'x', descricao: 'x', fotoUrl: 'https://x.com/a', custoMoedas: 1 }), null);
    assert.equal(vantagemDAO.findByEmpresa(empresaTeste.id).length, 1);
    assert.ok(vantagemDAO.findAtivas().some((v) => v.id === vantagem.id));
    assert.equal(vantagemDAO.findAtivas({ empresaId: empresaTeste.id }).length, 1);
    assert.equal(vantagemDAO.setAtiva(vantagem.id, false).ativa, false);
    assert.equal(vantagemDAO.findAtivas({ empresaId: empresaTeste.id }).length, 0, 'inativa some do catálogo');
    assert.equal(vantagemDAO.findByEmpresa(empresaTeste.id).length, 1, 'inativa continua nas vantagens da empresa');
    assert.equal(vantagemDAO.setAtiva(vantagem.id, true).ativa, true);
    assert.equal(vantagemDAO.contarResgates(vantagem.id), 0);
    console.log('[OK] VantagemDAO: create/findById/update/setAtiva/findAtivas/findByEmpresa/contarResgates.');

    // Transferência: debita, credita e grava as duas tabelas
    const envio = transacaoDAO.registrarTransferencia({
      professorId: profTeste.id,
      alunoId: alunoTeste.id,
      quantidade: 120,
      motivo: 'Participação em aula',
    });
    assert.equal(envio.saldoProfessor, 380);
    assert.equal(envio.saldoAluno, 120);
    assert.equal(saldoDe('professores', profTeste.id), 380);
    assert.equal(saldoDe('alunos', alunoTeste.id), 120);
    assert.equal(envio.transferencia.motivo, 'Participação em aula');
    assert.equal(envio.transferencia.alunoNome, 'Aluno Transacao DAO');
    assert.equal(envio.aluno.email, 'transacao.dao.aluno@pucminas.br');
    assert.equal(envio.professor.nome, 'Professor Transacao DAO');
    assert.ok(db.prepare('SELECT 1 FROM transacoes WHERE id = ? AND tipo = ?').get(envio.transferencia.id, 'TRANSFERENCIA'));
    assert.ok(db.prepare('SELECT 1 FROM transferencias_moedas WHERE transacao_id = ?').get(envio.transferencia.id));

    // Saldo insuficiente e destinatário inexistente: nada muda
    const totalTransacoes = () => Number(db.prepare('SELECT COUNT(*) AS n FROM transacoes').get().n);
    const antes = totalTransacoes();
    assert.throws(
      () => transacaoDAO.registrarTransferencia({ professorId: profTeste.id, alunoId: alunoTeste.id, quantidade: 381, motivo: 'x' }),
      (e) => e.statusCode === 409 && e.message === 'Saldo insuficiente'
    );
    assert.throws(
      () => transacaoDAO.registrarTransferencia({ professorId: profTeste.id, alunoId: 999999, quantidade: 10, motivo: 'x' }),
      (e) => e.statusCode === 404
    );
    assert.equal(saldoDe('professores', profTeste.id), 380, 'saldo do professor intacto após falhas (rollback)');
    assert.equal(saldoDe('alunos', alunoTeste.id), 120);
    assert.equal(totalTransacoes(), antes, 'nenhuma transação gravada nas falhas');
    console.log('[OK] TransacaoDAO.registrarTransferencia(): debita/credita e grava 2 tabelas; saldo insuficiente e aluno inexistente não alteram nada.');

    // Resgate: debita e grava código único
    const resgate1 = transacaoDAO.registrarResgate({ alunoId: alunoTeste.id, vantagemId: vantagem.id });
    assert.equal(resgate1.novoSaldo, 70);
    assert.equal(saldoDe('alunos', alunoTeste.id), 70);
    assert.match(resgate1.resgate.codigoCupom, /^CUPOM-\d{4}-[A-Z2-7]{8}$/);
    assert.equal(resgate1.resgate.quantidade, 50);
    assert.equal(resgate1.resgate.vantagemNome, 'Vantagem DAO 2');
    assert.equal(resgate1.resgate.empresaNome, 'Empresa Transacao DAO');
    assert.equal(resgate1.empresa.email, 'transacao.dao@empresa.com.br');
    assert.equal(resgate1.aluno.nome, 'Aluno Transacao DAO');
    assert.equal(vantagemDAO.contarResgates(vantagem.id), 1);

    // Colisão de código: o gerador devolve o código já usado e depois um inédito
    const codigos = [resgate1.resgate.codigoCupom, resgate1.resgate.codigoCupom, 'CUPOM-2099-INEDITO2'];
    let chamadas = 0;
    db.prepare('UPDATE alunos SET saldo_moedas = 200 WHERE usuario_id = ?').run(alunoTeste.id);
    const resgate2 = transacaoDAO.registrarResgate({
      alunoId: alunoTeste.id,
      vantagemId: vantagem.id,
      gerarCodigo: () => codigos[chamadas++],
    });
    assert.equal(chamadas, 3, 'duas colisões geraram nova tentativa');
    assert.equal(resgate2.resgate.codigoCupom, 'CUPOM-2099-INEDITO2');
    assert.equal(saldoDe('alunos', alunoTeste.id), 150, 'débito aplicado uma única vez apesar das colisões');
    assert.equal(
      Number(db.prepare('SELECT COUNT(*) AS n FROM resgates_vantagens WHERE aluno_id = ?').get(alunoTeste.id).n),
      2
    );

    // Colisão permanente esgota as tentativas e não debita
    assert.throws(
      () => transacaoDAO.registrarResgate({ alunoId: alunoTeste.id, vantagemId: vantagem.id, gerarCodigo: () => 'CUPOM-2099-INEDITO2' }),
      (e) => e.statusCode === 500
    );
    assert.equal(saldoDe('alunos', alunoTeste.id), 150);

    // Erros de negócio do resgate
    assert.throws(() => transacaoDAO.registrarResgate({ alunoId: alunoTeste.id, vantagemId: 999999 }), (e) => e.statusCode === 404);
    db.prepare('UPDATE alunos SET saldo_moedas = 10 WHERE usuario_id = ?').run(alunoTeste.id);
    assert.throws(
      () => transacaoDAO.registrarResgate({ alunoId: alunoTeste.id, vantagemId: vantagem.id }),
      (e) => e.statusCode === 409 && e.message === 'Saldo insuficiente'
    );
    assert.equal(saldoDe('alunos', alunoTeste.id), 10);
    vantagemDAO.setAtiva(vantagem.id, false);
    db.prepare('UPDATE alunos SET saldo_moedas = 500 WHERE usuario_id = ?').run(alunoTeste.id);
    assert.throws(() => transacaoDAO.registrarResgate({ alunoId: alunoTeste.id, vantagemId: vantagem.id }), (e) => e.statusCode === 409);
    assert.equal(saldoDe('alunos', alunoTeste.id), 500, 'vantagem inativa não debita');
    vantagemDAO.setAtiva(vantagem.id, true);
    console.log('[OK] TransacaoDAO.registrarResgate(): debita, grava código único, repete em colisão sem debitar 2x; 404/409 sem alterar saldo.');

    // Crédito semestral: acumula e é único por (professor, semestre)
    const credito = transacaoDAO.registrarCredito({ professorId: profTeste.id, semestre: semestreTeste, quantidade: 1000 });
    assert.equal(credito.saldoMoedas, 1380, 'crédito acumula ao saldo corrente (380 + 1000)');
    assert.equal(credito.credito.semestre, semestreTeste);
    assert.equal(saldoDe('professores', profTeste.id), 1380);
    assert.equal(transacaoDAO.registrarCredito({ professorId: profTeste.id, semestre: semestreTeste, quantidade: 1000 }), null);
    assert.equal(saldoDe('professores', profTeste.id), 1380, 'crédito repetido não altera o saldo');
    assert.equal(
      Number(db.prepare('SELECT COUNT(*) AS n FROM creditos_semestrais WHERE professor_id = ? AND semestre = ?').get(profTeste.id, semestreTeste).n),
      1
    );
    assert.equal(transacaoDAO.registrarCredito({ professorId: profTeste.id, semestre: '2099/2', quantidade: 1000 }).saldoMoedas, 2380);
    assert.throws(() => transacaoDAO.registrarCredito({ professorId: 999999, semestre: semestreTeste, quantidade: 1000 }), (e) => e.statusCode === 404);
    console.log('[OK] TransacaoDAO.registrarCredito(): acumula ao saldo e retorna null quando o semestre já foi creditado.');

    // Extratos
    const extratoProf = transacaoDAO.buscarExtratoProfessor(profTeste.id);
    assert.deepEqual(extratoProf.map((t) => t.tipo), ['CREDITO', 'CREDITO', 'TRANSFERENCIA']);
    assert.ok(extratoProf.every((t, i, a) => i === 0 || a[i - 1].id > t.id || a[i - 1].dataHora > t.dataHora), 'mais recente primeiro');
    assert.equal(extratoProf[2].alunoNome, 'Aluno Transacao DAO');
    const extratoAluno = transacaoDAO.buscarExtratoAluno(alunoTeste.id);
    assert.deepEqual(extratoAluno.map((t) => t.tipo), ['RESGATE', 'RESGATE', 'TRANSFERENCIA']);
    assert.equal(extratoAluno[0].codigoCupom, 'CUPOM-2099-INEDITO2');
    assert.equal(extratoAluno[2].professorNome, 'Professor Transacao DAO');
    const extratoEmpresa = transacaoDAO.buscarResgatesDaEmpresa(empresaTeste.id);
    assert.equal(extratoEmpresa.length, 2);
    assert.equal(extratoEmpresa[0].alunoNome, 'Aluno Transacao DAO');
    assert.equal(extratoEmpresa[0].codigoCupom, 'CUPOM-2099-INEDITO2');
    assert.equal(extratoEmpresa[0].alunoId, null, 'a empresa não recebe o id do aluno');
    assert.equal(transacaoDAO.buscarResgatesDaEmpresa(999999).length, 0);
    console.log('[OK] TransacaoDAO: extratos de professor, aluno e empresa em ordem decrescente.');

    // Exclusão da vantagem com resgates é barrada pela FK
    assert.throws(() => vantagemDAO.delete(vantagem.id), (e) => e.code === 'ERR_SQLITE_ERROR' && (e.errcode & 0xff) === 19);
    assert.ok(vantagemDAO.findById(vantagem.id), 'vantagem com resgates preservada');
    console.log('[OK] VantagemDAO.delete(): vantagem com resgates não é removida.');
  } finally {
    // Remove as transações do teste (subtabelas saem em cascata) e depois os usuários.
    db.prepare(
      `DELETE FROM transacoes WHERE id IN (
         SELECT transacao_id FROM transferencias_moedas WHERE professor_id = ? OR aluno_id = ?
         UNION SELECT transacao_id FROM creditos_semestrais WHERE professor_id = ?
         UNION SELECT transacao_id FROM resgates_vantagens WHERE aluno_id = ?)`
    ).run(profTeste.id, alunoTeste.id, profTeste.id, alunoTeste.id);
    db.prepare('DELETE FROM usuarios WHERE id IN (?, ?, ?)').run(profTeste.id, alunoTeste.id, empresaTeste.id);
  }
  assert.equal(vantagemDAO.delete(999999), false);
  console.log('[OK] Limpeza: usuários e transações de teste removidos.');
}

console.log('\n=== Todos os testes da camada DAO passaram com sucesso! ===');

