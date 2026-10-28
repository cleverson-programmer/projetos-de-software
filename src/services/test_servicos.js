import '../testes/prepararBancoTemporario.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getDatabase } from '../config/database.js';
import { normalizarCpf, normalizarCnpj, somenteDigitos } from '../utils/documentos.js';
import { gerarHashSenha, verificarSenha } from '../utils/senha.js';
import { semestreAtual } from '../utils/semestre.js';
import { emailValido, urlHttpValida, inteiroPositivo, textoObrigatorio } from '../utils/validacao.js';
import { escapeHtml } from '../utils/html.js';
import { traduzirErroBanco } from '../utils/erros.js';
import { Usuario } from '../models/Usuario.js';
import { Professor } from '../models/Professor.js';
import { Aluno } from '../models/Aluno.js';
import { EmpresaParceira } from '../models/EmpresaParceira.js';
import { Vantagem } from '../models/Vantagem.js';
import { ResgateVantagem } from '../models/ResgateVantagem.js';
import { TransferenciaMoedas } from '../models/TransferenciaMoedas.js';
import { CreditoSemestral } from '../models/CreditoSemestral.js';
import { AlunoService } from './AlunoService.js';
import { EmpresaParceiraService } from './EmpresaParceiraService.js';
import { ProfessorService } from './ProfessorService.js';
import { AuthService } from './AuthService.js';
import { EmailService } from './EmailService.js';
import { VantagemService } from './VantagemService.js';
import { TransacaoService } from './TransacaoService.js';
import { TransacaoDAO } from '../dao/TransacaoDAO.js';
import { assinarToken, verificarToken, exigirPerfil, exigirProprietario } from '../middleware/auth.js';
import { criarLoginThrottle } from '../middleware/loginThrottle.js';
import { rotas } from '../routes.js';

console.log('=== Testando Utilitários, Models, Services e Middleware ===\n');

const db = getDatabase();
const usuariosCriados = [];
let hashOriginalRafael = null;
// Estado inicial para a limpeza: transações criadas pelo teste são removidas e os saldos restaurados.
const baselineParaLimpeza = {
  maxTransacao: Number(db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM transacoes').get().m),
  professores: db.prepare('SELECT usuario_id, saldo_moedas FROM professores').all().map((l) => ({ ...l })),
  alunos: db.prepare('SELECT usuario_id, saldo_moedas FROM alunos').all().map((l) => ({ ...l })),
};
const rastrear = (entidade) => {
  usuariosCriados.push(entidade.id);
  return entidade;
};

function statusDe(fn) {
  try {
    fn();
  } catch (e) {
    return e.statusCode ?? `sem statusCode: ${e.message}`;
  }
  return 'sem erro';
}

try {
  // 1. Documentos (CPF/CNPJ)
  for (const cpf of ['529.982.247-25', '111.444.777-35', '390.533.447-05', '123.456.789-09', '987.654.321-00', '248.326.190-63']) {
    assert.equal(normalizarCpf(cpf), cpf, `CPF válido do seed/exemplo: ${cpf}`);
    assert.equal(normalizarCpf(somenteDigitos(cpf)), cpf, 'sem máscara é normalizado');
  }
  for (const cnpj of ['12.345.678/0001-95', '11.222.333/0001-81']) {
    assert.equal(normalizarCnpj(cnpj), cnpj);
    assert.equal(normalizarCnpj(somenteDigitos(cnpj)), cnpj);
  }
  for (const ruim of ['111.111.111-11', '123.456.789-00', '1234567890123', 'abc', '', '529.982.247-2a', null, 12345678909]) {
    assert.equal(normalizarCpf(ruim), null, `CPF inválido: ${ruim}`);
  }
  for (const ruim of ['11.111.111/1111-11', '12.345.678/0001-90', 'abc', '', undefined]) {
    assert.equal(normalizarCnpj(ruim), null, `CNPJ inválido: ${ruim}`);
  }
  console.log('[OK] documentos: CPF/CNPJ válidos passam; inválidos, repetidos e com letras falham; sem máscara é normalizado.');

  // 2. Senha (PBKDF2)
  const hashNovo = gerarHashSenha('123456');
  assert.match(hashNovo, /^pbkdf2\$600000\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(verificarSenha('123456', hashNovo), true);
  assert.equal(verificarSenha('outra', hashNovo), false);
  const saltLegado = crypto.randomBytes(16).toString('hex');
  const hashLegado = `pbkdf2$${saltLegado}$${crypto.pbkdf2Sync('123456', saltLegado, 10000, 64, 'sha256').toString('hex')}`;
  assert.equal(verificarSenha('123456', hashLegado), true, 'formato legado de 10000 iterações ainda verifica');
  assert.equal(verificarSenha('errada', hashLegado), false);
  assert.equal(verificarSenha('123456', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm'), false, 'bcrypt não verifica');
  assert.equal(verificarSenha('123456', '123456'), false, 'texto puro não verifica');
  assert.equal(verificarSenha('123456', 'pbkdf2$600000$zz$yy'), false, 'hash malformado não verifica');
  const usuarioTeste = new Usuario({ login: 'x', senhaHash: hashNovo, tipo: 'ALUNO' });
  assert.equal(usuarioTeste.autenticar('x', '123456'), true);
  assert.equal(usuarioTeste.autenticar('y', '123456'), false);
  assert.match(Usuario.gerarHashSenha('abc'), /^pbkdf2\$600000\$/);
  console.log('[OK] senha: PBKDF2 600000 it.; legado de 3 partes verifica; bcrypt e texto puro não.');

  // 3. Semestre, validação, HTML, erros de banco
  assert.equal(semestreAtual(new Date(2026, 5, 30)), '2026/1');
  assert.equal(semestreAtual(new Date(2026, 6, 1)), '2026/2');
  assert.equal(semestreAtual(new Date(2026, 11, 31)), '2026/2');
  assert.equal(semestreAtual(new Date(2027, 0, 1)), '2027/1');
  assert.equal(emailValido('a@b.co'), true);
  assert.equal(emailValido('a@b'), false);
  assert.equal(emailValido('a b@c.com'), false);
  assert.equal(urlHttpValida('https://exemplo.com/f.png'), true);
  assert.equal(urlHttpValida('javascript:alert(1)'), false);
  assert.equal(urlHttpValida('ftp://x.com/a'), false);
  assert.equal(urlHttpValida('notaurl'), false);
  assert.equal(urlHttpValida(`https://x.com/${'a'.repeat(500)}`), false);
  for (const v of [1, 10, '25', ' 7 ']) assert.ok(inteiroPositivo(v) > 0);
  for (const v of [0, -1, 1.5, 'abc', '', null, undefined, '1.5', Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(inteiroPositivo(v), null, `inteiroPositivo(${v})`);
  }
  assert.equal(textoObrigatorio('  oi '), 'oi');
  assert.equal(textoObrigatorio('   '), null);
  assert.equal(textoObrigatorio(5), null);
  assert.equal(escapeHtml(`<script>"x"&'y'</script>`), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  assert.equal(traduzirErroBanco(new Error('qualquer')), null);
  assert.equal(traduzirErroBanco({ code: 'ERR_SQLITE_ERROR', errcode: 2067 }).statusCode, 409);
  assert.equal(traduzirErroBanco({ code: 'ERR_SQLITE_ERROR', errcode: 787 }).statusCode, 409);
  assert.equal(traduzirErroBanco({ code: 'ERR_SQLITE_ERROR', errcode: 275 }).statusCode, 409);
  console.log('[OK] utilitários: semestre, e-mail, URL, inteiro positivo, escapeHtml e tradução de erros SQLite.');

  // 4. Models de domínio
  const professor = new Professor({ id: 1, nome: 'Prof', email: 'p@x.com', login: 'p', cpf: '529.982.247-25', departamento: 'D', saldoMoedas: 100, instituicaoId: 1 });
  const aluno = new Aluno({ id: 3, nome: 'Aluno', email: 'a@x.com', login: 'a', cpf: '390.533.447-05', endereco: 'E', curso: 'C', saldoMoedas: 10, instituicaoId: 1 });
  assert.equal(statusDe(() => professor.enviarMoedas(aluno, 500, 'bom')), 409, 'saldo insuficiente');
  assert.equal(professor.saldoMoedas, 100);
  assert.equal(statusDe(() => professor.enviarMoedas(aluno, 10, '   ')), 400, 'motivo obrigatório');
  assert.equal(statusDe(() => professor.enviarMoedas(aluno, 0, 'x')), 400);
  assert.equal(statusDe(() => professor.enviarMoedas(aluno, 1.5, 'x')), 400);
  const transferencia = professor.enviarMoedas(aluno, 40, '  Ótima participação ');
  assert.ok(transferencia instanceof TransferenciaMoedas);
  assert.equal(transferencia.motivo, 'Ótima participação');
  assert.equal(professor.saldoMoedas, 60);
  assert.equal(aluno.saldoMoedas, 50);
  assert.match(transferencia.getDescricao(), /40 moedas.*Prof.*Aluno/);
  const credito = professor.receberCreditoSemestral('2027/1');
  assert.ok(credito instanceof CreditoSemestral);
  assert.equal(professor.saldoMoedas, 1060, 'crédito acumula ao saldo corrente');
  assert.match(credito.getDescricao(), /1000.*2027\/1/);
  assert.deepEqual(Object.keys(professor.consultarExtrato()).sort(), ['saldoMoedas', 'transacoes']);

  const codigo = ResgateVantagem.gerarCodigo();
  assert.match(codigo, /^CUPOM-\d{4}-[A-Z2-7]{8}$/);
  assert.notEqual(codigo, ResgateVantagem.gerarCodigo());

  const vantagem = new Vantagem({ id: 1, empresaId: 5, empresaNome: 'Cantina', nome: 'Combo', descricao: 'd', fotoUrl: 'https://x.com/a.png', custoMoedas: 30, ativa: true });
  const resgateModelo = aluno.resgatarVantagem(vantagem);
  assert.ok(resgateModelo instanceof ResgateVantagem);
  assert.equal(aluno.saldoMoedas, 20);
  assert.match(resgateModelo.codigoCupom, /^CUPOM-\d{4}-[A-Z2-7]{8}$/);
  assert.match(resgateModelo.getDescricao(), /Combo/);
  assert.equal(statusDe(() => aluno.resgatarVantagem(vantagem)), 409, 'saldo insuficiente no resgate');
  assert.equal(statusDe(() => aluno.resgatarVantagem(new Vantagem({ ...vantagem, ativa: false, empresaId: 5 }))), 409, 'vantagem inativa');
  assert.equal(JSON.stringify(vantagem.toJSON()).includes('foto_url'), false);

  const empresa = new EmpresaParceira({ id: 5, nome: 'Cantina', email: 'c@x.com', login: 'c', cnpj: '12.345.678/0001-95' });
  assert.equal(statusDe(() => empresa.cadastrarVantagem({ nome: 'n', descricao: 'd', fotoUrl: 'javascript:alert(1)', custoMoedas: 5 })), 400);
  assert.equal(statusDe(() => empresa.cadastrarVantagem({ nome: 'n', descricao: 'd', fotoUrl: 'https://x.com/a.png', custoMoedas: 0 })), 400);
  const nova = empresa.cadastrarVantagem({ nome: 'n', descricao: 'd', fotoUrl: 'https://x.com/a.png', custoMoedas: 5 });
  nova.id = 77;
  assert.equal(empresa.editarVantagem(77, { nome: 'n2', descricao: 'd', fotoUrl: 'https://x.com/b.png', custoMoedas: 6 }).custoMoedas, 6);
  assert.equal(statusDe(() => empresa.removerVantagem(999)), 404);
  empresa.removerVantagem(77);
  assert.equal(empresa.vantagens.length, 0);

  const toJsonProf = professor.toJSON();
  assert.equal(toJsonProf.senhaHash, undefined);
  assert.equal(toJsonProf.tipo, 'PROFESSOR');
  console.log('[OK] models: Professor.enviarMoedas/receberCreditoSemestral, Aluno.resgatarVantagem, EmpresaParceira.*Vantagem, gerarCodigo.');

  // 5. Services
  const alunoService = new AlunoService();
  const empresaService = new EmpresaParceiraService();
  const professorService = new ProfessorService();
  const authService = new AuthService();

  const dadosAluno = {
    nome: 'Aluno Serviço',
    email: 'servico.aluno@pucminas.br',
    login: 'servico.aluno',
    senha: 'senha123',
    cpf: '52998224725',
    endereco: 'Rua Serviço, 1',
    curso: 'Engenharia de Software',
    instituicaoId: 1,
  };
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, cpf: '111.111.111-11' })), 400, 'CPF inválido → 400');
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, email: 'sem-arroba' })), 400, 'e-mail inválido → 400');
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, nome: 123 })), 400, 'campo de tipo errado → 400');
  const alunoCriado = rastrear(alunoService.cadastrarAluno(dadosAluno));
  assert.equal(alunoCriado.cpf, '529.982.247-25', 'CPF sem máscara é gravado mascarado');
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, email: 'outro@pucminas.br', login: 'outro.login', cpf: '529.982.247-25' })), 409, 'CPF duplicado (com máscara)');
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, login: 'outro.login2' })), 409, 'e-mail duplicado');
  assert.equal(statusDe(() => alunoService.cadastrarAluno({ ...dadosAluno, email: 'outro2@pucminas.br' })), 409, 'login duplicado');
  console.log('[OK] AlunoService.cadastrarAluno: CPF inválido → 400, sem máscara gravado mascarado, duplicidades → 409.');

  // Conta antiga com CPF inválido continua editável se o CPF não mudar
  const alunoLegado = rastrear(
    new AlunoService().alunoDAO.create({
      nome: 'Aluno Legado',
      email: 'legado.servico@pucminas.br',
      login: 'legado.servico',
      senha: 'senha123',
      cpf: '123.456.789-00',
      endereco: 'Rua Legado, 1',
      curso: 'Engenharia de Software',
      instituicaoId: 1,
    })
  );
  const atualizado = alunoService.atualizarAluno(alunoLegado.id, { nome: 'Aluno Legado Editado', cpf: '123.456.789-00' });
  assert.equal(atualizado.nome, 'Aluno Legado Editado');
  assert.equal(atualizado.cpf, '123.456.789-00', 'CPF antigo inalterado');
  assert.equal(alunoService.atualizarAluno(alunoLegado.id, { cpf: '12345678900' }).cpf, '123.456.789-00', 'mesmo CPF sem máscara não altera');
  assert.equal(statusDe(() => alunoService.atualizarAluno(alunoLegado.id, { cpf: '999.999.999-99' })), 400, 'CPF alterado para inválido → 400');
  assert.equal(statusDe(() => alunoService.atualizarAluno(alunoLegado.id, { cpf: '529.982.247-25' })), 409, 'CPF alterado para o de outro aluno → 409');
  assert.equal(alunoService.atualizarAluno(alunoLegado.id, { cpf: '16899535009' }).cpf, '168.995.350-09', 'CPF válido novo é normalizado');
  console.log('[OK] AlunoService.atualizarAluno: CPF antigo inalterado ok; alterado para inválido → 400; novo válido normalizado.');

  // Empresa
  const dadosEmpresa = {
    nome: 'Empresa Serviço',
    email: 'servico.empresa@empresa.com.br',
    login: 'servico.empresa',
    senha: 'senha123',
    cnpj: '11222333000181',
  };
  assert.equal(statusDe(() => empresaService.cadastrarEmpresa({ ...dadosEmpresa, cnpj: '11.111.111/1111-11' })), 400);
  assert.equal(statusDe(() => empresaService.cadastrarEmpresa({ ...dadosEmpresa, email: 'x' })), 400);
  const empresaCriada = rastrear(empresaService.cadastrarEmpresa(dadosEmpresa));
  assert.equal(empresaCriada.cnpj, '11.222.333/0001-81');
  assert.equal(statusDe(() => empresaService.cadastrarEmpresa({ ...dadosEmpresa, email: 'o@x.com', login: 'o.login', cnpj: '11.222.333/0001-81' })), 409);
  assert.equal(empresaService.atualizarEmpresa(empresaCriada.id, { descricao: 'Nova descrição', cnpj: '11222333000181' }).descricao, 'Nova descrição');
  assert.equal(statusDe(() => empresaService.atualizarEmpresa(empresaCriada.id, { cnpj: '00.000.000/0000-00' })), 400);
  console.log('[OK] EmpresaParceiraService: CNPJ inválido → 400, canônico, duplicado → 409, update preserva CNPJ.');

  // Exclusão: 409 com histórico, 200 sem histórico
  assert.equal(statusDe(() => alunoService.excluirAluno(3)), 409, 'aluno seed com histórico → 409');
  assert.ok(alunoService.alunoDAO.findById(3), 'aluno seed preservado');
  assert.equal(statusDe(() => empresaService.excluirEmpresa(5)), 409, 'empresa seed com resgate → 409');
  assert.ok(empresaService.empresaDAO.findById(5), 'empresa seed preservada');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transacoes WHERE tipo IN (?, ?)').get('TRANSFERENCIA', 'RESGATE').n >= 2, true, 'transações preservadas');
  assert.equal(alunoService.excluirAluno(alunoCriado.id), true);
  assert.equal(empresaService.excluirEmpresa(empresaCriada.id), true);
  assert.equal(statusDe(() => alunoService.buscarPorId(alunoCriado.id)), 404);
  console.log('[OK] exclusão: com histórico → 409 sem apagar transações; sem histórico → removido.');

  assert.equal(alunoService.listarDestinatarios().every((d) => Object.keys(d).length === 4), true);
  assert.equal(typeof alunoService.listarAlunos, 'undefined', 'listagem pública removida do service');
  assert.equal(typeof empresaService.listarEmpresas, 'undefined', 'listagem pública removida do service');

  // Professor
  assert.equal(statusDe(() => professorService.cadastrarProfessor({ nome: 'P', email: 'p@x.com', login: 'plogin', cpf: '111.111.111-11', departamento: 'D', instituicaoId: 1 })), 400);
  assert.equal(statusDe(() => professorService.cadastrarProfessor({ nome: 'P', email: 'p@x.com', login: 'plogin', cpf: '52998224725', departamento: 'D', instituicaoId: 999 })), 400, 'instituição inexistente');
  assert.equal(statusDe(() => professorService.cadastrarProfessor({ nome: 'P', email: 'p@x', login: 'plogin', cpf: '52998224725', departamento: 'D', instituicaoId: 1 })), 400, 'e-mail inválido');
  const criadoSemSenha = professorService.cadastrarProfessor({
    nome: 'Professor Serviço',
    email: 'servico.professor@pucminas.br',
    login: 'servico.professor',
    cpf: '98765432100',
    departamento: 'Computação',
    instituicaoId: 1,
  });
  rastrear(criadoSemSenha.professor);
  assert.ok(criadoSemSenha.senhaInicial.length >= 12, 'senha inicial gerada');
  assert.equal(criadoSemSenha.professor.cpf, '987.654.321-00');
  assert.equal(criadoSemSenha.professor.saldoMoedas, 0);
  assert.equal(authService.autenticar('servico.professor', criadoSemSenha.senhaInicial).tipo, 'PROFESSOR');
  assert.equal(statusDe(() => professorService.cadastrarProfessor({ nome: 'Outro', email: 'outro.prof@pucminas.br', login: 'outro.prof', cpf: '987.654.321-00', departamento: 'D', instituicaoId: 1 })), 409, 'CPF duplicado');

  const importacao = professorService.importarProfessores([
    { nome: 'Importado 1', email: 'imp1@pucminas.br', login: 'imp1', cpf: '248.326.190-63', departamento: 'D', instituicaoId: 3, senha: 'Senha@1' },
    { nome: 'Importado 2', email: 'imp2@pucminas.br', login: 'imp2', cpf: '000.000.000-00', departamento: 'D', instituicaoId: 3 },
  ]);
  if (importacao[0].ok) rastrear(importacao[0].professor);
  assert.equal(importacao[0].ok, true);
  assert.equal(importacao[0].senhaInicial, 'Senha@1');
  assert.equal(importacao[1].ok, false);
  assert.match(importacao[1].erro, /CPF inválido/);
  console.log('[OK] ProfessorService: validações, senha inicial gerada, duplicidade → 409, importação parcial.');

  // AuthService
  assert.equal(statusDe(() => authService.autenticar('', '')), 400);
  assert.equal(statusDe(() => authService.autenticar('inexistente', '123456')), 401);
  assert.equal(statusDe(() => authService.autenticar('milena.adao', 'errada')), 401);
  const milena = authService.autenticar('milena.adao', '123456');
  assert.ok(milena instanceof Professor, 'login de professor devolve Professor completo');
  assert.ok(milena.departamento && milena.instituicao.nome && milena.cpf);
  assert.ok(authService.autenticar('kaio.silva', '123456') instanceof Aluno);
  assert.ok(authService.autenticar('cantina.gourmet', '123456') instanceof EmpresaParceira);
  hashOriginalRafael = db.prepare('SELECT senha_hash FROM usuarios WHERE id = 4').get().senha_hash;
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = 4').run('$2b$10$qualquer');
  assert.equal(statusDe(() => authService.autenticar('rafael.lopes', '123456')), 401, 'hash bcrypt qualquer não autentica');
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = 4').run('123456');
  assert.equal(statusDe(() => authService.autenticar('rafael.lopes', '123456')), 401, 'texto puro não autentica');
  console.log('[OK] AuthService: Professor completo; credenciais inválidas → 401; bcrypt/texto puro não autenticam.');

  // 6. Middleware: token
  const segredo = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
  const agora = Date.now();
  const token = assinarToken({ sub: 3, tipo: 'ALUNO' }, { segredo, agora });
  const payload = verificarToken(token, { segredo, agora });
  assert.equal(payload.sub, 3);
  assert.equal(payload.tipo, 'ALUNO');
  assert.equal(payload.exp - payload.iat, 8 * 3600);
  const [h, p, s] = token.split('.');
  const payloadAdulterado = Buffer.from(JSON.stringify({ sub: 4, tipo: 'ALUNO', iat: payload.iat, exp: payload.exp })).toString('base64url');
  const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const casos = {
    'payload alterado': `${h}.${payloadAdulterado}.${s}`,
    'outro segredo': assinarToken({ sub: 3, tipo: 'ALUNO' }, { segredo: 'outro-segredo-totalmente-diferente-123456', agora }),
    'alg diferente': `${headerNone}.${p}.${s}`,
    'alg none sem assinatura': `${headerNone}.${p}.`,
    expirado: assinarToken({ sub: 3, tipo: 'ALUNO' }, { segredo, agora: agora - 9 * 3600 * 1000 }),
    malformado: 'abc.def',
    lixo: 'não é token',
    vazio: '',
    'assinatura curta': `${h}.${p}.abc`,
  };
  for (const [nome, t] of Object.entries(casos)) {
    assert.equal(statusDe(() => verificarToken(t, { segredo, agora })), 401, `token ${nome} → 401`);
  }
  assert.equal(statusDe(() => verificarToken(undefined, { segredo, agora })), 401);
  assert.equal(statusDe(() => verificarToken(assinarToken({ sub: 3, tipo: 'ADMIN' }, { segredo, agora }), { segredo, agora })), 401, 'tipo desconhecido');

  const reqAluno = { auth: { id: 3, tipo: 'ALUNO' } };
  exigirPerfil(reqAluno, 'ALUNO');
  assert.equal(statusDe(() => exigirPerfil(reqAluno, 'PROFESSOR')), 403);
  exigirProprietario(reqAluno, '3', 'ALUNO');
  assert.equal(statusDe(() => exigirProprietario(reqAluno, 4, 'ALUNO')), 403);
  assert.equal(statusDe(() => exigirProprietario(reqAluno, 3, 'EMPRESA')), 403);
  console.log('[OK] middleware/auth: token válido; adulterado, outro segredo, alg diferente, expirado e malformado → 401; perfil/proprietário → 403.');

  // 7. Throttle de login
  const throttle = criarLoginThrottle({ maxFalhas: 5, janelaMs: 1000, maxChaves: 3 });
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i += 1) {
    throttle.verificarBloqueio('Maria', '::1', t0 + i);
    throttle.registrarFalha('Maria', '::1', t0 + i);
  }
  const bloqueio = (() => {
    try {
      throttle.verificarBloqueio(' maria ', '::1', t0 + 10);
    } catch (e) {
      return e;
    }
    return null;
  })();
  assert.equal(bloqueio?.statusCode, 429, '6ª tentativa → 429');
  assert.ok(Number(bloqueio.headers['Retry-After']) >= 1);
  throttle.verificarBloqueio('outra', '::1', t0 + 10);
  throttle.verificarBloqueio('maria', '::2', t0 + 10);
  throttle.verificarBloqueio('maria', '::1', t0 + 2000); // fora da janela
  throttle.registrarFalha('ana', '::1', t0);
  throttle.registrarFalha('ana', '::1', t0 + 1);
  throttle.registrarSucesso('ana', '::1');
  assert.equal(throttle.tamanho <= 3, true);
  for (let i = 0; i < 4; i += 1) throttle.registrarFalha('fulano', '::1', t0 + 3000 + i);
  throttle.registrarSucesso('fulano', '::1');
  for (let i = 0; i < 10; i += 1) throttle.registrarFalha(`u${i}`, '::1', t0 + 3000);
  assert.equal(throttle.tamanho <= 3, true, 'teto de chaves respeitado');
  console.log('[OK] loginThrottle: 5 falhas → 6ª recebe 429 com Retry-After; sucesso zera; teto de chaves.');

  // 8. Tabela de rotas
  assert.ok(Array.isArray(rotas) && rotas.length > 0);
  const publicas = rotas.filter((r) => r.publica).map((r) => `${r.metodo} ${r.padrao.source}`).sort();
  assert.deepEqual(publicas, [
    'GET ^\\/api\\/instituicoes$',
    'POST ^\\/api\\/alunos$',
    'POST ^\\/api\\/auth\\/login$',
    'POST ^\\/api\\/empresas$',
  ]);
  assert.equal(rotas.some((r) => r.metodo === 'GET' && r.padrao.test('/api/alunos')), false, 'GET /api/alunos removida');
  assert.equal(rotas.some((r) => r.metodo === 'GET' && r.padrao.test('/api/empresas')), false, 'GET /api/empresas removida');
  console.log('[OK] routes: somente login, cadastro de aluno/empresa e instituições são públicos; listagens removidas.');
  const rotasVantagemETransacao = [
    ['GET', '/api/vantagens'],
    ['GET', '/api/vantagens/minhas'],
    ['POST', '/api/vantagens'],
    ['PUT', '/api/vantagens/1'],
    ['PATCH', '/api/vantagens/1/ativa'],
    ['DELETE', '/api/vantagens/1'],
    ['POST', '/api/vantagens/1/resgatar'],
    ['POST', '/api/transacoes/enviar-moedas'],
    ['GET', '/api/extrato'],
    ['POST', '/api/creditos-semestrais/executar'],
  ];
  for (const [metodo, caminho] of rotasVantagemETransacao) {
    const rota = rotas.find((r) => r.metodo === metodo && r.padrao.test(caminho));
    assert.ok(rota, `rota ${metodo} ${caminho} existe`);
    assert.notEqual(rota.publica, true, `rota ${metodo} ${caminho} exige autenticação`);
  }
  console.log('[OK] routes: rotas de vantagens, transações, extrato e crédito semestral existem e exigem token.');

  // 9. EmailService (transporter injetado)
  const enviadas = [];
  const transporterOk = {
    sendMail: async (mensagem) => {
      enviadas.push(mensagem);
      return {};
    },
  };
  const transporterFalha = {
    sendMail: async () => {
      throw new Error('SMTP indisponível');
    },
  };
  const silenciar = async (fn) => {
    const original = { log: console.log, error: console.error };
    const linhas = { log: [], error: [] };
    console.log = (...a) => linhas.log.push(a.join(' '));
    console.error = (...a) => linhas.error.push(a.join(' '));
    try {
      return { resultado: await fn(), linhas };
    } finally {
      console.log = original.log;
      console.error = original.error;
    }
  };

  const emailOk = new EmailService(transporterOk, { de: 'Teste <teste@exemplo.com>' });
  const emailFalha = new EmailService(transporterFalha);
  const codigoEmail = 'CUPOM-2026-ABCD2345';

  enviadas.length = 0;
  const profMalicioso = { nome: 'Prof\r\nBcc: invasor@x.com' };
  assert.equal(
    await emailOk.notificarRecebimento({
      aluno: { nome: 'Aluno <b>', email: 'aluno@x.com' },
      professor: profMalicioso,
      quantidade: 5,
      motivo: '<script>alert(1)</script>',
      novoSaldo: 15,
    }),
    true
  );
  const notificacao = enviadas[0];
  assert.equal(notificacao.to, 'aluno@x.com');
  assert.equal(notificacao.from, 'Teste <teste@exemplo.com>');
  assert.doesNotMatch(notificacao.subject, /[\r\n]/, 'assunto sem CR/LF');
  assert.match(notificacao.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, 'motivo escapado no HTML');
  assert.doesNotMatch(notificacao.html, /<script>/);
  assert.match(notificacao.html, /Aluno &lt;b&gt;/);
  assert.ok(notificacao.text.includes('<script>alert(1)</script>') && notificacao.text.includes('5 moedas'), 'texto puro presente');

  enviadas.length = 0;
  const dadosCupom = {
    aluno: { nome: 'Aluno', email: 'aluno@x.com' },
    vantagem: { nome: 'Combo "<i>"', custoMoedas: 100, empresaNome: 'Cantina' },
    codigo: codigoEmail,
  };
  assert.equal(await emailOk.enviarCupomAluno(dadosCupom), true);
  assert.equal(
    await emailOk.enviarConferenciaParceiro({
      empresa: { nome: 'Cantina', email: 'cantina@x.com' },
      aluno: { nome: 'Aluno' },
      vantagem: dadosCupom.vantagem,
      codigo: codigoEmail,
      dataHora: '2026-10-28 15:30:00',
    }),
    true
  );
  assert.equal(enviadas.length, 2);
  for (const mensagem of enviadas) {
    assert.ok(mensagem.text.includes(codigoEmail) && mensagem.html.includes(codigoEmail), 'mesmo código em texto e HTML');
    assert.doesNotMatch(mensagem.html, /<i>/, 'nome da vantagem escapado');
  }
  assert.equal(enviadas[0].to, 'aluno@x.com');
  assert.equal(enviadas[1].to, 'cantina@x.com');
  assert.match(enviadas[1].text, /28\/10\/2026/);

  const falhou = await silenciar(() => emailFalha.enviarCupomAluno(dadosCupom));
  assert.equal(falhou.resultado, false, 'transporter que lança → false (nunca lança)');
  assert.ok(falhou.linhas.error.some((l) => l.includes('[E-mail] falha')), 'falha é registrada no log');

  // Modo simulado com o jsonTransport real do nodemailer
  const nodemailer = (await import('nodemailer')).default;
  const emailSimuladoSvc = new EmailService(nodemailer.createTransport({ jsonTransport: true }), { simulado: true });
  const simulado = await silenciar(() => emailSimuladoSvc.enviarCupomAluno(dadosCupom));
  assert.equal(simulado.resultado, true);
  const linhaSimulada = simulado.linhas.log.find((l) => l.startsWith('[EMAIL-SIMULADO] '));
  assert.ok(linhaSimulada, 'linha [EMAIL-SIMULADO] impressa');
  const jsonSimulado = JSON.parse(linhaSimulada.slice('[EMAIL-SIMULADO] '.length));
  assert.equal(jsonSimulado.to, 'aluno@x.com');
  assert.ok(jsonSimulado.text.includes(codigoEmail));
  assert.deepEqual(Object.keys(jsonSimulado).sort(), ['subject', 'text', 'to']);
  console.log('[OK] EmailService: HTML escapado + texto, assunto sem CR/LF, falha → false, linha [EMAIL-SIMULADO] parseável.');

  // 10. VantagemService
  const vantagemService = new VantagemService();
  const empresaDono = rastrear(
    empresaService.empresaDAO.create({
      nome: 'Empresa Dona Serviço',
      email: 'dona.servico@empresa.com.br',
      login: 'dona.servico',
      senha: 'senha123',
      cnpj: '00.000.000/0003-53',
    })
  );
  const empresaOutra = rastrear(
    empresaService.empresaDAO.create({
      nome: 'Empresa Outra Serviço',
      email: 'outra.servico@empresa.com.br',
      login: 'outra.servico',
      senha: 'senha123',
      cnpj: '00.000.000/0004-34',
    })
  );
  const dadosVantagem = {
    nome: 'Desconto Serviço',
    descricao: 'Descrição do desconto',
    fotoUrl: 'https://exemplo.com/foto.png',
    custoMoedas: 40,
  };
  for (const [campo, valor] of [
    ['nome', ''],
    ['nome', 123],
    ['descricao', '   '],
    ['fotoUrl', 'javascript:alert(1)'],
    ['fotoUrl', 'ftp://x.com/a'],
    ['fotoUrl', 'notaurl'],
    ['fotoUrl', undefined],
    ['custoMoedas', 0],
    ['custoMoedas', -5],
    ['custoMoedas', 1.5],
    ['custoMoedas', 'abc'],
    ['custoMoedas', undefined],
  ]) {
    assert.equal(
      statusDe(() => vantagemService.cadastrar(empresaDono.id, { ...dadosVantagem, [campo]: valor })),
      400,
      `vantagem com ${campo}=${String(valor)} → 400`
    );
  }
  assert.equal(statusDe(() => vantagemService.cadastrar(999999, dadosVantagem)), 404, 'empresa inexistente');
  const vantagemCriada = vantagemService.cadastrar(empresaDono.id, { ...dadosVantagem, custoMoedas: '40' });
  assert.equal(vantagemCriada.custoMoedas, 40, 'custo em string de dígitos é aceito');
  assert.equal(vantagemCriada.ativa, true);
  assert.equal(vantagemCriada.empresaId, empresaDono.id);
  assert.deepEqual(Object.keys(vantagemCriada.toJSON()).sort(), [
    'ativa', 'createdAt', 'custoMoedas', 'descricao', 'empresaId', 'empresaNome', 'fotoUrl', 'id', 'nome',
  ]);
  assert.deepEqual(vantagemService.listarDaEmpresa(empresaDono.id).map((v) => v.id), [vantagemCriada.id]);
  assert.deepEqual(vantagemService.listarDaEmpresa(empresaOutra.id), []);

  const vantagemEditada = vantagemService.atualizar(empresaDono.id, vantagemCriada.id, { ...dadosVantagem, nome: 'Desconto Editado', custoMoedas: 50 });
  assert.equal(vantagemEditada.nome, 'Desconto Editado');
  assert.equal(vantagemEditada.custoMoedas, 50);
  assert.equal(statusDe(() => vantagemService.atualizar(empresaOutra.id, vantagemCriada.id, dadosVantagem)), 403, 'outra empresa não edita');
  assert.equal(statusDe(() => vantagemService.atualizar(empresaDono.id, 999999, dadosVantagem)), 404);
  assert.equal(statusDe(() => vantagemService.atualizar(empresaDono.id, vantagemCriada.id, { ...dadosVantagem, custoMoedas: 0 })), 400);
  assert.equal(statusDe(() => vantagemService.alterarAtiva(empresaDono.id, vantagemCriada.id, 'sim')), 400, 'ativa deve ser boolean');
  assert.equal(statusDe(() => vantagemService.alterarAtiva(empresaOutra.id, vantagemCriada.id, false)), 403);
  assert.equal(statusDe(() => vantagemService.excluir(empresaOutra.id, vantagemCriada.id)), 403, 'outra empresa não exclui');

  assert.ok(vantagemService.listarAtivas().some((v) => v.id === vantagemCriada.id));
  assert.ok(vantagemService.listarAtivas({ empresaId: String(empresaDono.id) }).every((v) => v.empresaId === empresaDono.id));
  assert.equal(vantagemService.listarAtivas({ empresaId: String(empresaOutra.id) }).length, 0);
  assert.equal(statusDe(() => vantagemService.listarAtivas({ empresaId: 'abc' })), 400);
  assert.equal(vantagemService.alterarAtiva(empresaDono.id, vantagemCriada.id, false).ativa, false);
  assert.equal(vantagemService.listarAtivas().some((v) => v.id === vantagemCriada.id), false, 'inativa some do catálogo');
  assert.equal(vantagemService.listarDaEmpresa(empresaDono.id).length, 1, 'inativa continua nas "minhas"');
  assert.equal(vantagemService.alterarAtiva(empresaDono.id, vantagemCriada.id, true).ativa, true);
  console.log('[OK] VantagemService: validações (400), posse (403/404), ativar/desativar, catálogo só com ativas.');

  // 11. TransacaoService (e-mail com transporter stub)
  const professorT = rastrear(
    professorService.professorDAO.create({
      nome: 'Professor Transação',
      email: 'transacao.prof@pucminas.br',
      login: 'transacao.prof',
      senha: 'senha123',
      cpf: '000.000.011-82',
      departamento: 'Computação',
      instituicaoId: 1,
      saldoMoedas: 300,
    })
  );
  const alunoT = rastrear(
    alunoService.alunoDAO.create({
      nome: 'Aluno Transação',
      email: 'transacao.aluno@pucminas.br',
      login: 'transacao.aluno',
      senha: 'senha123',
      cpf: '000.000.012-63',
      endereco: 'Rua T, 1',
      curso: 'Engenharia de Software',
      instituicaoId: 1,
    })
  );
  const saldoDe = (tabela, id) => Number(db.prepare(`SELECT saldo_moedas AS s FROM ${tabela} WHERE usuario_id = ?`).get(id).s);
  const statusDeAsync = async (fn) => {
    try {
      await fn();
    } catch (e) {
      return e.statusCode ?? `sem statusCode: ${e.message}`;
    }
    return 'sem erro';
  };

  enviadas.length = 0;
  const transacaoService = new TransacaoService(undefined, undefined, undefined, undefined, new EmailService(transporterOk));
  const envioOk = { alunoId: alunoT.id, quantidade: 50, motivo: '  Excelente participação  ' };

  for (const quantidade of [0, -1, 1.5, 'abc', undefined, null]) {
    assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, quantidade })), 400, `quantidade ${String(quantidade)} → 400`);
  }
  for (const motivo of ['', '   ', undefined, null, 42]) {
    assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, motivo })), 400, `motivo ${String(motivo)} → 400`);
  }
  assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, motivo: 'x'.repeat(1001) })), 400, 'motivo > 1000 caracteres');
  assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, alunoId: undefined })), 400, 'aluno ausente');
  assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, alunoId: 999999 })), 404, 'aluno inexistente');
  assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, alunoId: professorT.id })), 404, 'destinatário que não é aluno');
  assert.equal(await statusDeAsync(() => transacaoService.enviarMoedas(professorT.id, { ...envioOk, quantidade: 301 })), 409, 'saldo insuficiente');
  assert.equal(saldoDe('professores', professorT.id), 300, 'falhas não alteram o saldo');
  assert.equal(enviadas.length, 0, 'nenhum e-mail nas falhas');

  const envio = await transacaoService.enviarMoedas(professorT.id, envioOk);
  assert.equal(envio.saldoProfessor, 250);
  assert.equal(envio.emailEnviado, true);
  assert.equal(envio.transacao.quantidade, 50);
  assert.equal(envio.transacao.motivo, 'Excelente participação');
  assert.equal(envio.transacao.alunoId, alunoT.id);
  assert.equal(envio.transacao.alunoNome, 'Aluno Transação');
  assert.ok(envio.transacao.id && envio.transacao.dataHora);
  assert.equal(saldoDe('alunos', alunoT.id), 50);
  assert.equal(enviadas.length, 1, 'exatamente um e-mail ao aluno');
  assert.equal(enviadas[0].to, 'transacao.aluno@pucminas.br');
  assert.ok(enviadas[0].text.includes('Professor Transação') && enviadas[0].text.includes('Excelente participação') && enviadas[0].text.includes('50 moedas'));
  const envioString = await transacaoService.enviarMoedas(professorT.id, { alunoId: String(alunoT.id), quantidade: '50', motivo: 'Segundo envio' });
  assert.equal(envioString.saldoProfessor, 200, 'ids e quantidade como string de dígitos são aceitos');

  // Concorrência: três envios simultâneos de 90 com saldo 200 → 2 sucessos e 1 saldo insuficiente
  const simultaneos = await Promise.allSettled(
    [1, 2, 3].map((n) => transacaoService.enviarMoedas(professorT.id, { ...envioOk, quantidade: 90, motivo: `Simultâneo ${n}` }))
  );
  assert.equal(simultaneos.filter((r) => r.status === 'fulfilled').length, 2);
  assert.equal(simultaneos.filter((r) => r.status === 'rejected' && r.reason.statusCode === 409).length, 1);
  assert.equal(saldoDe('professores', professorT.id), 20, 'saldo nunca fica negativo');
  assert.equal(saldoDe('alunos', alunoT.id), 280);

  // Falha de e-mail não desfaz a transação
  const servicoEmailFalha = new TransacaoService(undefined, undefined, undefined, undefined, emailFalha);
  const envioSemEmail = (await silenciar(() => servicoEmailFalha.enviarMoedas(professorT.id, { ...envioOk, quantidade: 5, motivo: 'Sem e-mail' }))).resultado;
  assert.equal(envioSemEmail.emailEnviado, false);
  assert.equal(envioSemEmail.saldoProfessor, 15);
  assert.equal(saldoDe('professores', professorT.id), 15, 'transação permanece mesmo sem e-mail');
  assert.ok(db.prepare('SELECT 1 FROM transferencias_moedas WHERE transacao_id = ?').get(envioSemEmail.transacao.id));
  console.log('[OK] TransacaoService.enviarMoedas: 400/404/409, débito/crédito, e-mail ao aluno, simultâneos sem saldo negativo, falha de e-mail mantém a transação.');

  // Resgate
  const vantagemResgate = vantagemService.cadastrar(empresaDono.id, { ...dadosVantagem, nome: 'Vantagem Resgate', custoMoedas: 100 });
  const vantagemCara = vantagemService.cadastrar(empresaDono.id, { ...dadosVantagem, nome: 'Vantagem Cara', custoMoedas: 5000 });
  const vantagemInativa = vantagemService.alterarAtiva(
    empresaDono.id,
    vantagemService.cadastrar(empresaDono.id, { ...dadosVantagem, nome: 'Vantagem Inativa' }).id,
    false
  );
  assert.equal(await statusDeAsync(() => transacaoService.resgatarVantagem(alunoT.id, 999999)), 404, 'vantagem inexistente');
  assert.equal(await statusDeAsync(() => transacaoService.resgatarVantagem(alunoT.id, 'abc')), 404);
  assert.equal(await statusDeAsync(() => transacaoService.resgatarVantagem(alunoT.id, vantagemInativa.id)), 409, 'vantagem inativa');
  assert.equal(await statusDeAsync(() => transacaoService.resgatarVantagem(alunoT.id, vantagemCara.id)), 409, 'saldo insuficiente');
  assert.equal(saldoDe('alunos', alunoT.id), 285, 'falhas não debitam (280 + 5)');

  enviadas.length = 0;
  const resgate = await transacaoService.resgatarVantagem(alunoT.id, vantagemResgate.id);
  assert.match(resgate.codigo, /^CUPOM-\d{4}-[A-Z2-7]{8}$/);
  assert.equal(resgate.novoSaldo, 185);
  assert.equal(saldoDe('alunos', alunoT.id), 185);
  assert.deepEqual(resgate.vantagem, { id: vantagemResgate.id, nome: 'Vantagem Resgate', custoMoedas: 100, empresaNome: 'Empresa Dona Serviço' });
  assert.equal(resgate.transacao.quantidade, 100);
  assert.equal(resgate.emailAlunoEnviado, true);
  assert.equal(resgate.emailEmpresaEnviado, true);
  assert.equal(enviadas.length, 2, 'dois e-mails: aluno e empresa');
  assert.deepEqual(enviadas.map((m) => m.to).sort(), ['dona.servico@empresa.com.br', 'transacao.aluno@pucminas.br']);
  assert.ok(enviadas.every((m) => m.text.includes(resgate.codigo) && m.html.includes(resgate.codigo)), 'MESMO código nos dois e-mails');
  assert.ok(enviadas.every((m) => m.text.includes('Vantagem Resgate')));
  assert.ok(enviadas.find((m) => m.to === 'dona.servico@empresa.com.br').text.includes('Aluno Transação'), 'e-mail da empresa traz o aluno');
  assert.equal(await statusDeAsync(() => vantagemService.excluir(empresaDono.id, vantagemResgate.id)), 409, 'vantagem com resgates não é excluída');
  assert.equal(vantagemService.excluir(empresaDono.id, vantagemCara.id), true, 'vantagem sem resgates é excluída');

  // Colisão forçada de código: o gerador devolve o mesmo código duas vezes
  class TransacaoDAOComColisao extends TransacaoDAO {
    constructor(sequencia) {
      super();
      this.sequencia = sequencia;
      this.chamadas = 0;
    }
    registrarResgate(dados) {
      return super.registrarResgate({ ...dados, gerarCodigo: () => this.sequencia[this.chamadas++] });
    }
  }
  const daoColisao = new TransacaoDAOComColisao([resgate.codigo, resgate.codigo, 'CUPOM-2026-NOVO2345']);
  const servicoColisao = new TransacaoService(daoColisao, undefined, undefined, undefined, new EmailService(transporterOk));
  const resgateColisao = await servicoColisao.resgatarVantagem(alunoT.id, vantagemResgate.id);
  assert.equal(resgateColisao.codigo, 'CUPOM-2026-NOVO2345');
  assert.equal(daoColisao.chamadas, 3, 'duas colisões geraram novas tentativas');
  assert.equal(saldoDe('alunos', alunoT.id), 85, 'débito de 100 aplicado uma única vez');

  // Falha de e-mail no resgate: resgate permanece
  const servicoResgateSemEmail = new TransacaoService(undefined, undefined, undefined, undefined, emailFalha);
  db.prepare('UPDATE alunos SET saldo_moedas = 150 WHERE usuario_id = ?').run(alunoT.id);
  const resgateSemEmail = (await silenciar(() => servicoResgateSemEmail.resgatarVantagem(alunoT.id, vantagemResgate.id))).resultado;
  assert.equal(resgateSemEmail.emailAlunoEnviado, false);
  assert.equal(resgateSemEmail.emailEmpresaEnviado, false);
  assert.equal(saldoDe('alunos', alunoT.id), 50, 'resgate permanece mesmo sem e-mail');
  assert.ok(db.prepare('SELECT 1 FROM resgates_vantagens WHERE codigo_cupom = ?').get(resgateSemEmail.codigo));
  console.log('[OK] TransacaoService.resgatarVantagem: 404/409, débito, dois e-mails com o mesmo código, colisão de código, falha de e-mail mantém o resgate.');

  // Crédito semestral
  const professoresAntes = Object.fromEntries(
    db.prepare('SELECT usuario_id, saldo_moedas FROM professores').all().map((l) => [l.usuario_id, Number(l.saldo_moedas)])
  );
  const totalProfessores = Object.keys(professoresAntes).length;
  const credito1 = transacaoService.creditarSemestre({ semestre: '2027/1' });
  assert.equal(credito1.semestre, '2027/1');
  assert.equal(credito1.creditados.length, totalProfessores, 'todos os professores creditados');
  assert.equal(credito1.jaCreditados, 0);
  for (const c of credito1.creditados) {
    assert.equal(c.quantidade, 1000);
    assert.equal(c.saldoMoedas, professoresAntes[c.professorId] + 1000, 'crédito soma ao saldo atual (acumula)');
    assert.equal(saldoDe('professores', c.professorId), c.saldoMoedas);
    assert.deepEqual(Object.keys(c).sort(), ['nome', 'professorId', 'quantidade', 'saldoMoedas']);
  }
  const credito2 = transacaoService.creditarSemestre({ semestre: '2027/1' });
  assert.equal(credito2.creditados.length, 0, '2ª chamada não credita');
  assert.equal(credito2.jaCreditados, totalProfessores);
  assert.equal(saldoDe('professores', professorT.id), professoresAntes[professorT.id] + 1000);
  const credito3 = transacaoService.creditarSemestre({ semestre: '2027/2' });
  assert.equal(credito3.creditados.length, totalProfessores, 'outro semestre credita de novo (acumulando)');
  assert.equal(saldoDe('professores', professorT.id), professoresAntes[professorT.id] + 2000);
  assert.equal(
    Number(db.prepare('SELECT COUNT(*) AS n FROM creditos_semestrais WHERE professor_id = ? AND semestre IN (?, ?)').get(professorT.id, '2027/1', '2027/2').n),
    2
  );
  console.log('[OK] TransacaoService.creditarSemestre: +1000 somado ao saldo atual, 2ª chamada credita 0, semestre novo credita de novo.');

  // Extrato
  const extratoProfessor = transacaoService.gerarExtrato(professorT.id, 'PROFESSOR');
  assert.equal(extratoProfessor.tipo, 'PROFESSOR');
  assert.equal(extratoProfessor.saldoMoedas, saldoDe('professores', professorT.id));
  const tiposProfessor = extratoProfessor.transacoes.map((t) => t.tipo);
  assert.deepEqual(tiposProfessor.slice(0, 2), ['CREDITO', 'CREDITO'], 'mais recente primeiro: créditos de 2027 antes dos envios');
  assert.equal(extratoProfessor.transacoes[0].semestre, '2027/2');
  assert.ok(tiposProfessor.includes('TRANSFERENCIA'));
  assert.equal(tiposProfessor.filter((t) => t === 'TRANSFERENCIA').length, 5);
  const ids = extratoProfessor.transacoes.map((t) => t.id);
  assert.deepEqual([...ids].sort((a, b) => b - a), ids, 'ordenado por id decrescente (mesmo segundo)');
  const envioJson = JSON.parse(JSON.stringify(extratoProfessor)).transacoes.find((t) => t.tipo === 'TRANSFERENCIA');
  assert.ok(envioJson.alunoNome && envioJson.motivo && envioJson.quantidade > 0 && envioJson.dataHora && envioJson.descricao);

  const extratoAluno = transacaoService.gerarExtrato(alunoT.id, 'ALUNO');
  assert.equal(extratoAluno.tipo, 'ALUNO');
  assert.equal(extratoAluno.saldoMoedas, 50);
  const tiposAluno = extratoAluno.transacoes.map((t) => t.tipo);
  assert.equal(tiposAluno.filter((t) => t === 'RESGATE').length, 3);
  assert.equal(tiposAluno.filter((t) => t === 'TRANSFERENCIA').length, 5);
  assert.equal(extratoAluno.transacoes[0].tipo, 'RESGATE');
  const resgateJson = JSON.parse(JSON.stringify(extratoAluno)).transacoes[0];
  assert.match(resgateJson.codigoCupom, /^CUPOM-/);
  assert.equal(resgateJson.vantagemNome, 'Vantagem Resgate');
  assert.equal(resgateJson.empresaNome, 'Empresa Dona Serviço');
  const recebimentoJson = JSON.parse(JSON.stringify(extratoAluno)).transacoes.find((t) => t.tipo === 'TRANSFERENCIA');
  assert.equal(recebimentoJson.professorNome, 'Professor Transação');
  assert.ok(recebimentoJson.motivo);

  const extratoEmpresa = transacaoService.gerarExtrato(empresaDono.id, 'EMPRESA');
  assert.equal(extratoEmpresa.tipo, 'EMPRESA');
  assert.equal('saldoMoedas' in extratoEmpresa, false, 'empresa não tem saldo');
  assert.equal(extratoEmpresa.transacoes.length, 3);
  const resgateEmpresaJson = JSON.parse(JSON.stringify(extratoEmpresa)).transacoes[0];
  assert.equal(resgateEmpresaJson.tipo, 'RESGATE');
  assert.equal(resgateEmpresaJson.alunoNome, 'Aluno Transação');
  assert.equal(resgateEmpresaJson.vantagemNome, 'Vantagem Resgate');
  assert.match(resgateEmpresaJson.codigoCupom, /^CUPOM-/);
  assert.equal(resgateEmpresaJson.alunoId, undefined, 'empresa não recebe o id do aluno');
  assert.deepEqual(transacaoService.gerarExtrato(empresaOutra.id, 'EMPRESA').transacoes, []);
  assert.equal(statusDe(() => transacaoService.gerarExtrato(999999, 'ALUNO')), 404);
  assert.equal(statusDe(() => transacaoService.gerarExtrato(alunoT.id, 'ADMIN')), 403);
  console.log('[OK] TransacaoService.gerarExtrato: professor (envios + créditos), aluno (recebimentos + resgates com código) e empresa (resgates), mais recentes primeiro.');

  // O job de crédito automático nunca dispara por import de módulos
  const creditosAntesImport = Number(db.prepare('SELECT COUNT(*) AS n FROM creditos_semestrais').get().n);
  const moduloServidor = await import('../server.js');
  const moduloJob = await import('../jobs/creditoSemestralJob.js');
  assert.equal(typeof moduloServidor.createAppServer, 'function');
  assert.equal(typeof moduloJob.iniciarCreditoSemestral, 'function');
  assert.equal(
    Number(db.prepare('SELECT COUNT(*) AS n FROM creditos_semestrais').get().n),
    creditosAntesImport,
    'importar server.js e o job não credita ninguém'
  );
  console.log('[OK] job de crédito semestral: importar módulos não dispara o crédito.');
} finally {
  if (baselineParaLimpeza) {
    // Remove as transações criadas pelo teste (subtabelas saem em cascata) e restaura os saldos.
    db.prepare('DELETE FROM transacoes WHERE id > ?').run(baselineParaLimpeza.maxTransacao);
  }
  if (hashOriginalRafael) {
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = 4').run(hashOriginalRafael);
  }
  for (const id of usuariosCriados) {
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  }
  if (baselineParaLimpeza) {
    for (const p of baselineParaLimpeza.professores) {
      db.prepare('UPDATE professores SET saldo_moedas = ? WHERE usuario_id = ?').run(p.saldo_moedas, p.usuario_id);
    }
    for (const a of baselineParaLimpeza.alunos) {
      db.prepare('UPDATE alunos SET saldo_moedas = ? WHERE usuario_id = ?').run(a.saldo_moedas, a.usuario_id);
    }
  }
}

console.log('\n=== Todos os testes de utilitários, models, services e middleware passaram! ===');
