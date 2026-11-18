const $ = (selector) => document.querySelector(selector);
const state = { user: null, csrf: null, institutions: [], students: [], benefits: [], allBenefits: [], coupons: [], statement: [], couponSummary: {}, statementCursor: null, couponCursor: null, panel: 'overview', registerType: 'ALUNO', editing: null, redeem: null, checked: null };
const labels = { ALUNO: 'Aluno', PROFESSOR: 'Professor', EMPRESA: 'Empresa parceira' };
const names = { overview: 'Visão geral', transfer: 'Enviar moedas', benefits: 'Vantagens', 'benefit-edit': 'Minha vantagem', coupons: 'Meus cupons', statement: 'Extrato', account: 'Minha conta' };
const number = (value) => Number(value || 0).toLocaleString('pt-BR');
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let toastTimer;

function toast(message, error = false) {
  const dialog = document.querySelector('dialog[open]');
  if (dialog) {
    let feedback = dialog.querySelector('.dialog-feedback');
    if (!feedback) { feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); dialog.prepend(feedback); }
    feedback.className = 'dialog-feedback' + (error ? ' error' : '');
    feedback.textContent = message;
  }
  const element = $('#toast');
  element.textContent = message;
  element.className = 'toast' + (error ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), 6500);
}
function show(selector, visible = true) { $(selector).classList.toggle('hidden', !visible); }

async function api(url, { method = 'GET', body, operationKey } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.csrf && method !== 'GET') headers['X-CSRF-Token'] = state.csrf;
  if (operationKey) headers['Idempotency-Key'] = operationKey;
  const response = await fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(new Error(data.error || 'Não foi possível concluir a operação.'), { status: response.status });
    if (response.status === 401 && state.user) guest();
    throw error;
  }
  return data;
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4).toString(16));
}
const pendingOperations = new Map();
async function financial(url, payload) {
  const name = state.user.id + ':' + url + ':' + JSON.stringify(payload);
  let key = pendingOperations.get(name);
  if (!key) { key = uuid(); pendingOperations.set(name, key); }
  const result = await api(url, { method: 'POST', body: payload, operationKey: key });
  pendingOperations.delete(name);
  return result;
}

async function busy(element, callback) {
  const buttons = element.matches('button') ? [element] : [...element.querySelectorAll('button[type=submit]')];
  const disabled = buttons.map((button) => button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  try { return await callback(); } catch (error) { toast(error.message || 'Verifique sua conexão e tente novamente.', true); }
  finally { buttons.forEach((button, index) => { button.disabled = disabled[index]; }); }
}
function formData(form) {
  const result = Object.fromEntries(new FormData(form));
  for (const key of ['instituicaoId', 'alunoId', 'quantidade', 'custoMoedas']) if (key in result) result[key] = Number(result[key]);
  return result;
}
function guest(register = false) {
  state.user = null; state.csrf = null; state.checked = null; state.redeem = null;
  $('#checked-coupon').replaceChildren(); $('#account-form').replaceChildren();
  $('#coupon-list').replaceChildren(); $('#statement-body').replaceChildren();
  $('#transfer-form').reset(); $('#benefit-form').reset(); $('#deactivate-form').reset();
  $('#coupon-detail').replaceChildren(); $('#redeem-content').replaceChildren();
  document.querySelectorAll('input[type=password]').forEach((input) => { input.value = ''; });
  pendingOperations.clear();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  show('#workspace', false); show('#guest'); show('#loading', false);
  show('#login-view', !register); show('#register-view', register);
}
function registerType(tipo) {
  state.registerType = tipo;
  const student = tipo === 'ALUNO';
  show('#student-fields', student); $('#student-fields').disabled = !student;
  show('#company-fields', !student); $('#company-fields').disabled = student;
  $('#register-student').classList.toggle('selected', student);
  $('#register-company').classList.toggle('selected', !student);
  $('#register-student').setAttribute('aria-pressed', String(student));
  $('#register-company').setAttribute('aria-pressed', String(!student));
  $('#register-name-label').textContent = student ? 'Nome completo' : 'Nome da empresa';
}
function institutionOptions(selected) {
  return '<option value="">Selecione sua instituição</option>' + state.institutions.map((item) =>
    '<option value="' + item.id + '"' + (Number(selected) === item.id ? ' selected' : '') + '>' + escape(item.nome) + '</option>').join('');
}
async function loadInstitutions() {
  state.institutions = await api('/api/instituicoes');
  for (const element of document.querySelectorAll('.institution-select')) element.innerHTML = institutionOptions(element.value);
}

const menuFor = (role) => role === 'PROFESSOR'
  ? [['overview', '◈', 'Visão geral'], ['transfer', '↗', 'Enviar moedas'], ['statement', '≡', 'Extrato'], ['account', '○', 'Minha conta']]
  : role === 'EMPRESA'
    ? [['overview', '◈', 'Visão geral'], ['benefits', '◇', 'Minhas vantagens'], ['coupons', '▤', 'Cupons recebidos'], ['account', '○', 'Minha conta']]
    : [['overview', '◈', 'Visão geral'], ['benefits', '◇', 'Vantagens'], ['coupons', '▤', 'Meus cupons'], ['statement', '≡', 'Extrato'], ['account', '○', 'Minha conta']];

function switchPanel(panel) {
  if (!state.user) return;
  if (!menuFor(state.user.tipo).some(([name]) => name === panel) && !(panel === 'benefit-edit' && state.user.tipo === 'EMPRESA')) return;
  state.panel = panel;
  document.querySelectorAll('.panel').forEach((element) => element.classList.toggle('hidden', element.id !== 'panel-' + panel));
  document.querySelectorAll('.nav-button').forEach((element) => element.classList.toggle('active', element.dataset.panel === (panel === 'benefit-edit' ? 'benefits' : panel)));
  $('#page-title').textContent = panel === 'benefits' && state.user.tipo === 'EMPRESA' ? 'Minhas vantagens' :
    panel === 'coupons' && state.user.tipo === 'EMPRESA' ? 'Cupons recebidos' : names[panel];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function card(label, value, foot, wallet = false) {
  return '<article class="summary-card' + (wallet ? ' wallet' : '') + '"><span class="summary-label">' + label + '</span><strong class="summary-value">' + number(value) + '</strong><span class="summary-foot">' + escape(foot) + '</span></article>';
}
function action(panel, title, subtitle, extra = '') {
  return '<button type="button" class="action-card" data-panel="' + panel + '" ' + extra + '><span><strong>' + title + '</strong><small>' + subtitle + '</small></span><span class="arrow" aria-hidden="true">↗</span></button>';
}
function statementTitle(row) {
  return row.tipo === 'CREDITO' ? 'Crédito semestral' : row.tipo === 'RESGATE' ? 'Resgate de vantagem' : row.delta > 0 ? 'Moedas recebidas' : 'Moedas enviadas';
}
function statementDetail(row) {
  return row.tipo === 'CREDITO' ? 'Referente ao semestre ' + row.semestre : (row.contraparte || '') + (row.motivo ? ' · ' + row.motivo : '');
}
function renderOverview() {
  const user = state.user;
  let cards, actions, subtitle;
  if (user.tipo === 'PROFESSOR') {
    cards = card('Saldo disponível', user.saldoMoedas, 'moedas para reconhecer seus alunos', true) + card('Crédito por semestre', 1000, 'O saldo não utilizado se acumula.') + card('Alunos da instituição', state.students.length, 'Reconheça quem faz a diferença.');
    actions = action('transfer', 'Enviar reconhecimento', 'Valorize uma conquista com moedas e uma mensagem.') + action('statement', 'Acompanhar os envios', 'Consulte seu saldo e todas as movimentações.');
    subtitle = 'Uma mensagem de reconhecimento pode fazer a diferença.';
  } else if (user.tipo === 'EMPRESA') {
    cards = card('Moedas em resgates', state.couponSummary.moedas, 'total de moedas trocadas por suas vantagens', true) + card('Vantagens ativas', state.allBenefits.filter((item) => item.ativa).length, 'Benefícios disponíveis para os alunos.') + card('Cupons a utilizar', state.couponSummary.disponiveis, 'Confira o código no momento da entrega.');
    actions = action('benefit-edit', 'Oferecer uma vantagem', 'Adicione uma foto, uma descrição e o custo.', 'data-new-benefit="true"') + action('coupons', 'Conferir cupons', 'Veja os resgates e confirme as trocas presenciais.');
    subtitle = 'Sua empresa faz parte de uma comunidade de conquistas.';
  } else {
    cards = card('Suas moedas', user.saldoMoedas, 'saldo disponível para aproveitar vantagens', true) + card('Vantagens ao seu alcance', state.allBenefits.filter((item) => item.custoMoedas <= user.saldoMoedas).length, 'Recompensas que cabem no seu saldo.') + card('Cupons disponíveis', state.couponSummary.disponiveis, 'Apresente o código na empresa parceira.');
    actions = action('benefits', 'Encontrar uma vantagem', 'Transforme seu reconhecimento em benefícios.') + action('coupons', 'Usar meus cupons', 'Tenha seus códigos sempre à mão.');
    subtitle = 'Continue conquistando e escolha como aproveitar suas moedas.';
  }
  $('#summary-cards').innerHTML = cards;
  $('#quick-actions').innerHTML = actions;
  $('#overview-subtitle').textContent = subtitle;
  $('#recent-title').textContent = user.tipo === 'EMPRESA' ? 'Resgates recentes' : 'Atividades recentes';
  const recent = user.tipo === 'EMPRESA' ? state.coupons : state.statement;
  $('#recent-activity').innerHTML = recent.length ? recent.slice(0, 5).map((row) => {
    const company = user.tipo === 'EMPRESA';
    const delta = company ? row.quantidade : row.delta;
    const detail = company ? row.aluno + ' · ' + row.vantagem : statementDetail(row);
    return '<div class="activity-row"><span class="activity-icon" aria-hidden="true">' + (company || delta > 0 ? '↙' : '↗') +
      '</span><span class="activity-copy"><strong>' + escape(company ? row.vantagem : statementTitle(row)) + '</strong><small>' +
      escape(detail.length > 130 ? detail.slice(0, 130) + '…' : detail) + '</small><small>' + date(row.dataHora) +
      '</small></span><span class="amount ' + (delta > 0 ? 'positive' : 'negative') + '">' + (company ? '' : delta > 0 ? '+' : '−') + number(Math.abs(delta)) + '</span></div>';
  }).join('') : '<div class="empty">Suas próximas conquistas aparecerão aqui.</div>';
}

function renderStatement() {
  $('#statement-balance').textContent = number(state.user.saldoMoedas) + ' moedas disponíveis';
  $('#statement-body').innerHTML = state.statement.length ? state.statement.map((row) =>
    '<tr><td>' + date(row.dataHora) + '</td><td><strong>' + escape(statementTitle(row)) + '</strong></td><td>' + escape(row.contraparte || row.semestre || 'Sistema de mérito') +
    '<small>' + escape(row.motivo || '') + (row.codigoCupom ? '<br>Cupom: ' + escape(row.codigoCupom) : '') +
    '</small></td><td class="amount ' + (row.delta > 0 ? 'positive' : 'negative') + '">' + (row.delta > 0 ? '+' : '−') + number(Math.abs(row.delta)) + '</td></tr>'
  ).join('') : '<tr><td colspan="4" class="empty">Nenhuma movimentação por enquanto.</td></tr>';
  show('#more-statement', Boolean(state.statementCursor));
}

function renderBenefits() {
  const company = state.user.tipo === 'EMPRESA';
  show('#new-benefit', company);
  $('#benefits-title').textContent = company ? 'Vantagens da sua empresa' : 'Escolha sua próxima recompensa';
  $('#benefits-subtitle').textContent = company ? 'Cadastre, atualize e acompanhe os benefícios que você oferece.' : 'Benefícios de empresas que valorizam o seu mérito.';
  $('#benefit-grid').innerHTML = state.benefits.length ? state.benefits.map((item) =>
    '<article class="benefit-card"><div class="benefit-image"><img src="' + escape(item.fotoUrl) + '" alt="' + escape(item.nome) +
    '" loading="lazy" referrerpolicy="no-referrer"></div><div class="benefit-content"><span class="benefit-company">' + escape(item.empresa || state.user.nome) +
    '</span><h3>' + escape(item.nome) + '</h3><p>' + escape(item.descricao) + '</p>' +
    (company ? '<span class="badge' + (item.ativa ? '' : ' inactive') + '">' + (item.ativa ? 'Disponível' : 'Pausada') + '</span>' : '') +
    '<div class="benefit-cost">' + number(item.custoMoedas) + ' <small>moedas</small></div><div class="benefit-actions">' +
    (company ? '<button class="button secondary" type="button" data-edit-benefit="' + item.id + '">Editar</button>' +
      (item.ativa ? '<button class="button ghost" type="button" data-pause-benefit="' + item.id + '">Pausar</button>' : '') :
      '<button class="button primary wide" type="button" data-redeem="' + item.id + '"' + (item.custoMoedas > state.user.saldoMoedas ? ' disabled' : '') + '>' +
      (item.custoMoedas > state.user.saldoMoedas ? 'Saldo insuficiente' : 'Resgatar vantagem') + '</button>') +
    '</div></div></article>'
  ).join('') : '<div class="empty">Nenhuma vantagem encontrada.' + (company ? ' Cadastre o primeiro benefício da sua empresa.' : '') + '</div>';
}

function couponMarkup(row, full = false) {
  const company = state.user.tipo === 'EMPRESA';
  const emailStatus = row.emailsPendentes > 0 ? 'Email em processamento' : row.emailsEnviados > 0 ? 'Emails encaminhados' : 'O cupom também pode ser enviado por email.';
  return '<article class="' + (full ? '' : 'coupon-card') + '"><span class="badge' + (row.confirmadoEm ? ' used' : '') + '">' + (row.confirmadoEm ? 'Utilizado' : 'Disponível') +
    '</span><h3>' + escape(row.vantagem) + '</h3><p>' + escape(company ? 'Aluno: ' + row.aluno : row.empresa) + '<br>' + number(row.quantidade) + ' moedas · ' + date(row.dataHora) +
    (row.confirmadoEm ? '<br>Utilizado em ' + date(row.confirmadoEm) : '') + '</p><code class="coupon-code">' + escape(row.codigo) +
    '</code><div class="coupon-mail">' + emailStatus + '</div><div class="button-row">' +
    '<button class="button secondary" type="button" data-copy="' + escape(row.codigo) + '">Copiar código</button>' +
    (company && !row.confirmadoEm ? '<button class="button primary" type="button" data-confirm-coupon="' + row.id + '">Confirmar utilização</button>' : '') +
    '<button class="button ghost" type="button" data-resend-coupon="' + row.id + '">Reenviar emails</button></div></article>';
}
function renderCoupons() {
  const company = state.user.tipo === 'EMPRESA';
  show('#coupon-check', company);
  $('#coupons-title').textContent = company ? 'Cupons recebidos' : 'Meus cupons';
  $('#coupons-subtitle').textContent = company ? 'Confira o código e confirme a utilização somente no momento da entrega.' : 'Apresente o código no estabelecimento. Você e a empresa recebem o mesmo cupom por email.';
  $('#coupon-list').innerHTML = state.coupons.length ? state.coupons.map((row) => couponMarkup(row)).join('') : '<div class="empty">Os cupons aparecerão aqui após um resgate.</div>';
  show('#more-coupons', Boolean(state.couponCursor));
}

function field(name, label, value = '', type = 'text', attrs = '') {
  return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + escape(value) + '" ' + attrs + '></label>';
}
function renderAccount() {
  const user = state.user;
  let html = field('nome', user.tipo === 'EMPRESA' ? 'Nome da empresa' : 'Nome completo', user.nome, 'text', 'required maxlength="255"') +
    field('email', 'Email', user.email, 'email', 'required maxlength="255" autocomplete="email"') +
    field('login', 'Login', user.login, 'text', 'required minlength="3" maxlength="100" pattern="[a-zA-Z0-9][a-zA-Z0-9._@-]{2,99}" autocomplete="username"');
  if (user.tipo === 'ALUNO') {
    html += '<div class="form-row">' + field('cpf', 'CPF', user.cpf, 'text', 'required maxlength="14" inputmode="numeric"') +
      field('rg', 'RG', user.rg, 'text', 'required minlength="4" maxlength="20"') + '</div>' +
      field('endereco', 'Endereço', user.endereco, 'text', 'required maxlength="255"') +
      '<label>Instituição de ensino<select name="instituicaoId" required>' + institutionOptions(user.instituicaoId) + '</select></label>' +
      field('curso', 'Curso', user.curso, 'text', 'required maxlength="100"');
  } else if (user.tipo === 'EMPRESA') {
    html += field('cnpj', 'CNPJ', user.cnpj, 'text', 'required maxlength="18" inputmode="numeric"') +
      '<label>Sobre a empresa<textarea name="descricao" maxlength="2000" rows="3">' + escape(user.descricao) + '</textarea></label>';
  } else {
    html += '<div class="note"><strong>Dados informados pela instituição</strong><br>CPF: ' + escape(user.cpf) + '<br>Departamento: ' + escape(user.departamento) + '<br>Instituição: ' + escape(user.instituicao.nome) + '</div>';
  }
  html += '<hr><h3>Alterar senha</h3><p class="note">Preencha os dois campos abaixo somente se quiser trocar sua senha.</p>' +
    field('senhaAtual', 'Senha atual', '', 'password', 'maxlength="128" autocomplete="current-password"') +
    field('senha', 'Nova senha', '', 'password', 'minlength="8" maxlength="128" autocomplete="new-password"') +
    '<button class="button primary" type="submit">Salvar meu cadastro</button>';
  $('#account-form').innerHTML = html;
}

async function loadWorkspace(keepPanel = false) {
  const previous = keepPanel ? state.panel : 'overview';
  const me = await api('/api/auth/me');
  state.user = me.usuario; state.csrf = me.csrfToken;
  const company = state.user.tipo === 'EMPRESA';
  const professor = state.user.tipo === 'PROFESSOR';
  const [statement, benefits, coupons, students] = await Promise.all([
    company ? null : api('/api/extrato'), professor ? [] : api('/api/vantagens'),
    professor ? null : api('/api/cupons'), professor ? api('/api/alunos') : [],
  ]);
  state.statement = statement?.transacoes || []; state.statementCursor = statement?.proximo || null;
  if (statement) state.user.saldoMoedas = statement.saldoMoedas;
  state.allBenefits = benefits;
  const term = $('#search').value.trim().toLowerCase();
  state.benefits = benefits.filter((item) => !term || [item.nome, item.descricao, item.empresa].some((value) => String(value || '').toLowerCase().includes(term))); state.coupons = coupons?.cupons || []; state.couponCursor = coupons?.proximo || null;
  state.couponSummary = coupons?.resumo || {}; state.students = students;
  $('#navigation').innerHTML = menuFor(state.user.tipo).map(([panel, icon, label]) => '<button type="button" class="nav-button" data-panel="' + panel + '"><span class="nav-icon" aria-hidden="true">' + icon + '</span>' + label + '</button>').join('');
  $('#role-label').textContent = labels[state.user.tipo]; $('#sidebar-name').textContent = state.user.nome;
  $('#identity').innerHTML = '<strong>Olá, ' + escape(state.user.nome) + '.</strong> ' +
    (company ? 'CNPJ ' + escape(state.user.cnpj) : escape(state.user.instituicao.nome) + ' · ' + escape(professor ? state.user.departamento : state.user.curso));
  if (state.user.tipo === 'ALUNO' && !state.user.cadastroCompleto) {
    $('#identity').insertAdjacentHTML('beforeend', '<br><button type="button" class="link" data-panel="account">Complete seu cadastro com o RG para receber e resgatar moedas.</button>');
  }
  $('#transfer-student').innerHTML = '<option value="">Selecione um aluno da sua instituição</option>' + students.map((item) => '<option value="' + item.id + '">' + escape(item.nome + ' · ' + item.curso) + '</option>').join('');
  $('#transfer-balance').textContent = number(state.user.saldoMoedas);
  renderOverview(); renderBenefits(); renderCoupons(); renderAccount();
  if (!company) renderStatement();
  show('#guest', false); show('#workspace');
  switchPanel(previous);
}

function editBenefit(id = null) {
  state.editing = id;
  const item = state.benefits.find((row) => row.id === id);
  const form = $('#benefit-form');
  form.reset();
  for (const name of ['nome', 'descricao', 'custoMoedas', 'fotoUrl']) form.elements.namedItem(name).value = item?.[name] ?? '';
  form.elements.namedItem('ativa').checked = item?.ativa ?? true;
  $('#benefit-photo-url').required = true;
  $('#benefit-form-title').textContent = item ? 'Editar vantagem' : 'Nova vantagem';
  previewPhoto(item?.fotoUrl);
  switchPanel('benefit-edit');
}
let previewUrl;
function previewPhoto(url) {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  if (url instanceof File) { previewUrl = URL.createObjectURL(url); url = previewUrl; }
  const image = $('#photo-preview');
  image.classList.remove('hidden');
  if (url && (url.startsWith('https://') || url.startsWith('/api/fotos/') || url.startsWith('blob:'))) {
    image.src = url; show('#photo-preview');
  } else { image.removeAttribute('src'); show('#photo-preview', false); }
}
async function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(file);
  });
}

$('#open-register').addEventListener('click', () => { guest(true); registerType('ALUNO'); });
$('#open-login').addEventListener('click', () => guest());
$('#register-student').addEventListener('click', () => registerType('ALUNO'));
$('#register-company').addEventListener('click', () => registerType('EMPRESA'));
$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => {
    const result = await api('/api/auth/login', { method: 'POST', body: formData(event.target) });
    state.user = result.usuario; state.csrf = result.csrfToken; $('#search').value = '';
    event.target.reset(); await loadWorkspace(); toast('Bem-vindo à sua conta!');
  });
});
$('#register-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => {
    const result = await api(state.registerType === 'ALUNO' ? '/api/alunos' : '/api/empresas', { method: 'POST', body: formData(event.target) });
    state.user = result.usuario; state.csrf = result.csrfToken; $('#search').value = '';
    event.target.reset(); await loadWorkspace(); toast('Sua conta foi criada. Bem-vindo!');
  });
});
$('#logout').addEventListener('click', (event) => {
  void busy(event.currentTarget, async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); guest(); toast('Você saiu da conta.'); });
});
$('#refresh').addEventListener('click', (event) => { void busy(event.currentTarget, async () => { await loadWorkspace(true); toast('Informações atualizadas.'); }); });
$('#transfer-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  void busy(form, async () => {
    const result = await financial('/api/transferencias', formData(form));
    form.reset(); await loadWorkspace(true);
    toast(number(result.quantidade) + ' moedas enviadas para ' + result.aluno + '. O aluno receberá seu reconhecimento por email.');
  });
});
$('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => { state.benefits = await api('/api/vantagens?busca=' + encodeURIComponent($('#search').value)); renderBenefits(); });
});
$('#new-benefit').addEventListener('click', () => editBenefit());
$('#cancel-benefit').addEventListener('click', () => { previewPhoto(null); switchPanel('benefits'); });
$('#benefit-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2097152)) {
    event.target.value = ''; toast('Escolha JPEG, PNG ou WebP de até 2 MB.', true);
    $('#benefit-photo-url').required = true; return;
  }
  $('#benefit-photo-url').required = !file;
  previewPhoto(file || $('#benefit-photo-url').value);
});
$('#benefit-photo-url').addEventListener('input', (event) => { if (!$('#benefit-file').files.length) previewPhoto(event.target.value); });
$('#benefit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  void busy(form, async () => {
    const data = formData(form);
    data.ativa = form.elements.namedItem('ativa').checked;
    const file = $('#benefit-file').files[0];
    if (file) data.fotoUrl = (await api('/api/vantagens/foto', { method: 'POST', body: { mime: file.type, base64: await fileBase64(file) } })).fotoUrl;
    await api('/api/vantagens' + (state.editing ? '/' + state.editing : ''), { method: state.editing ? 'PUT' : 'POST', body: data });
    form.reset(); previewPhoto(null); $('#search').value = '';
    await loadWorkspace(); switchPanel('benefits'); toast('Vantagem salva.');
  });
});
$('#confirm-redeem').addEventListener('click', (event) => {
  void busy(event.currentTarget, async () => {
    if (!state.redeem) return;
    const result = await financial('/api/resgates', { vantagemId: state.redeem.id, custoEsperado: state.redeem.custoMoedas });
    $('#redeem-dialog').close(); await loadWorkspace(); switchPanel('coupons');
    $('#coupon-detail').innerHTML = '<h2>Seu resgate foi concluído!</h2>' + couponMarkup(result.cupom, true);
    $('#coupon-dialog').showModal(); toast('Cupom gerado. Você e a empresa receberão o código por email.');
  });
});
$('#account-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => { await api('/api/conta', { method: 'PUT', body: formData(event.target) }); await loadWorkspace(true); toast('Seu cadastro foi atualizado.'); });
});
$('#deactivate-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => {
    await api('/api/conta', { method: 'DELETE', body: { senhaAtual: event.target.elements.namedItem('senhaAtual').value } });
    event.target.reset(); guest(); toast('Conta desativada. Seu histórico foi preservado.');
  });
});
$('#check-coupon-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void busy(event.currentTarget, async () => {
    state.checked = await api('/api/cupons/conferir?codigo=' + encodeURIComponent(event.target.elements.namedItem('codigo').value));
    $('#checked-coupon').innerHTML = couponMarkup(state.checked);
  });
});
$('#more-statement').addEventListener('click', (event) => {
  void busy(event.currentTarget, async () => {
    const result = await api('/api/extrato?antesDe=' + state.statementCursor);
    state.statement.push(...result.transacoes); state.statementCursor = result.proximo; state.user.saldoMoedas = result.saldoMoedas; renderStatement();
  });
});
$('#more-coupons').addEventListener('click', (event) => {
  void busy(event.currentTarget, async () => {
    const result = await api('/api/cupons?antesDe=' + state.couponCursor);
    state.coupons.push(...result.cupons); state.couponCursor = result.proximo; renderCoupons();
  });
});
document.addEventListener('input', (event) => {
  const input = event.target;
  if (input.matches('input[name=cpf],input[name=cnpj]')) {
    const digits = input.value.replace(/\D/g, '').slice(0, input.name === 'cpf' ? 11 : 14);
    input.value = input.name === 'cpf' ? digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') :
      digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  if (input.matches('#account-form input[name=senha]')) $('#account-form input[name=senhaAtual]').required = Boolean(input.value);
});
document.addEventListener('error', (event) => {
  if (event.target.tagName === 'IMG') {
    event.target.classList.add('hidden');
    event.target.closest('.benefit-image')?.classList.add('image-failed');
    if (event.target.id === 'photo-preview') toast('Não foi possível carregar a prévia. Confira a foto ou a URL.', true);
  }
}, true);
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.close) { $('#' + button.dataset.close).close(); return; }
  if (button.dataset.newBenefit) { editBenefit(); return; }
  if (button.dataset.panel) { switchPanel(button.dataset.panel); return; }
  if (button.dataset.editBenefit) { editBenefit(Number(button.dataset.editBenefit)); return; }
  if (button.dataset.redeem) {
    state.redeem = state.benefits.find((row) => row.id === Number(button.dataset.redeem));
    if (!state.redeem) return;
    $('#redeem-content').innerHTML = '<span class="eyebrow">APROVEITE SEU MÉRITO</span><h2>Confirmar resgate</h2><p>' + escape(state.redeem.nome) +
      ' · ' + escape(state.redeem.empresa) + '</p><p>Você utilizará <strong>' + number(state.redeem.custoMoedas) + ' moedas</strong>. Seu saldo ficará em <strong>' +
      number(state.user.saldoMoedas - state.redeem.custoMoedas) + ' moedas</strong>.</p><p>O código será enviado para você e para a empresa.</p>';
    $('#redeem-dialog').showModal(); return;
  }
  if (button.dataset.copy) {
    void busy(button, async () => {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(button.dataset.copy); toast('Código copiado.'); }
      else { toast('Selecione o código exibido e copie para apresentar na empresa.'); }
    }); return;
  }
  if (button.dataset.pauseBenefit) {
    void busy(button, async () => { await api('/api/vantagens/' + button.dataset.pauseBenefit, { method: 'DELETE', body: {} }); await loadWorkspace(true); toast('Vantagem pausada. Os cupons já emitidos continuam válidos.'); }); return;
  }
  if (button.dataset.confirmCoupon) {
    if (!window.confirm('Confirme somente se o benefício está sendo entregue ao aluno. Marcar este cupom como utilizado?')) return;
    void busy(button, async () => {
      const coupon = await api('/api/cupons/' + button.dataset.confirmCoupon + '/confirmar', { method: 'POST', body: {} });
      await loadWorkspace(true);
      if (state.checked?.id === coupon.id) { state.checked = coupon; $('#checked-coupon').innerHTML = couponMarkup(coupon); }
      if ($('#coupon-dialog').open) $('#coupon-detail').innerHTML = couponMarkup(coupon, true);
      toast('Utilização do cupom confirmada.');
    }); return;
  }
  if (button.dataset.resendCoupon) {
    void busy(button, async () => { const result = await api('/api/cupons/' + button.dataset.resendCoupon + '/reenviar', { method: 'POST', body: {} }); toast(result.message); });
  }
});

async function boot() {
  try {
    await loadInstitutions();
    try { await loadWorkspace(); } catch (error) { if (error.status === 401) guest(); else throw error; }
  } catch (error) {
    guest(); toast(error.message || 'Não foi possível conectar ao sistema. Atualize a página.', true);
  }
}
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('close', () => dialog.querySelector('.dialog-feedback')?.remove()));
void boot();
