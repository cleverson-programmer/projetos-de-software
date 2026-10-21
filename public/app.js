// ============================================================================
// Front-end MVC Client - Sistema de Moeda Estudantil (Sprint 2)
// ============================================================================

const toastEl = document.getElementById('toast-feedback');
let toastTimeout = null;

function mostrarMensagem(texto, tipo = 'success') {
  toastEl.textContent = texto;
  toastEl.className = `toast ${tipo}`;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 4500);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erro na comunicação com o servidor.');
  }
  return data;
}

// ============================================================================
// 1. NAVEGAÇÃO ENTRE ABAS
// ============================================================================
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ============================================================================
// 2. MÁSCARAS DE CPF, RG E CNPJ
// ============================================================================
function aplicarMascaraCPF(valor) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function aplicarMascaraRG(valor) {
  const limpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

function aplicarMascaraCNPJ(valor) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

document.getElementById('aluno-cpf').addEventListener('input', (e) => {
  e.target.value = aplicarMascaraCPF(e.target.value);
});

document.getElementById('aluno-rg').addEventListener('input', (e) => {
  e.target.value = aplicarMascaraRG(e.target.value);
});

document.getElementById('empresa-cnpj').addEventListener('input', (e) => {
  e.target.value = aplicarMascaraCNPJ(e.target.value);
});

// ============================================================================
// 3. CARREGAMENTO DAS INSTITUIÇÕES DE ENSINO PRÉ-CADASTRADAS
// ============================================================================
const selectInstituicao = document.getElementById('aluno-instituicao');

async function carregarInstituicoes() {
  try {
    const instituicoes = await apiRequest('/api/instituicoes');
    selectInstituicao.innerHTML = '<option value="">Selecione a instituição...</option>';
    for (const inst of instituicoes) {
      const opt = document.createElement('option');
      opt.value = inst.id;
      opt.textContent = inst.nome;
      selectInstituicao.appendChild(opt);
    }
  } catch (err) {
    mostrarMensagem(err.message, 'error');
  }
}

// ============================================================================
// 4. CRUD DE ALUNOS (US01 e US03)
// ============================================================================
const formAluno = document.getElementById('form-aluno');
const tabelaAlunosBody = document.getElementById('tabela-alunos-body');
const btnCancelarAluno = document.getElementById('btn-cancelar-aluno');
const btnSalvarAluno = document.getElementById('btn-salvar-aluno');
const formAlunoTitulo = document.getElementById('form-aluno-titulo');
const badgeModoAluno = document.getElementById('badge-modo-aluno');
const labelAlunoSenha = document.getElementById('label-aluno-senha');
const inputAlunoSenha = document.getElementById('aluno-senha');

let listaAlunosCache = [];

async function carregarAlunos() {
  try {
    const alunos = await apiRequest('/api/alunos');
    listaAlunosCache = alunos;

    if (alunos.length === 0) {
      tabelaAlunosBody.innerHTML =
        '<tr><td colspan="6" class="empty-row">Nenhum aluno cadastrado até o momento.</td></tr>';
      return;
    }

    tabelaAlunosBody.innerHTML = alunos
      .map(
        (aluno) => `
        <tr>
          <td>#${aluno.id}</td>
          <td>
            <strong>${escapeHtml(aluno.nome)}</strong>
            <span class="subtext">${escapeHtml(aluno.email)}</span>
            <span class="subtext">${escapeHtml(aluno.endereco)}</span>
          </td>
          <td>
            <span>${escapeHtml(aluno.cpf)}</span>
            <span class="subtext">RG: ${escapeHtml(aluno.rg || 'Não informado')}</span>
          </td>
          <td>
            <strong>${escapeHtml(aluno.instituicao ? aluno.instituicao.nome : '-')}</strong>
            <span class="subtext">${escapeHtml(aluno.curso)}</span>
          </td>
          <td><code>${escapeHtml(aluno.login)}</code></td>
          <td>
            <div class="actions-cell">
              <button type="button" class="btn btn-sm btn-edit" data-editar-aluno="${aluno.id}">Editar</button>
              <button type="button" class="btn btn-sm btn-delete" data-excluir-aluno="${aluno.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    mostrarMensagem(err.message, 'error');
  }
}

function resetarFormularioAluno() {
  formAluno.reset();
  document.getElementById('aluno-id').value = '';
  formAlunoTitulo.textContent = 'Cadastrar Novo Aluno';
  badgeModoAluno.textContent = 'Modo Criação';
  badgeModoAluno.className = 'badge badge-info';
  btnSalvarAluno.textContent = 'Cadastrar Aluno';
  btnCancelarAluno.classList.add('hidden');
  inputAlunoSenha.required = true;
  labelAlunoSenha.textContent = 'Senha *';
  inputAlunoSenha.placeholder = 'Informe a senha';
}

function iniciarEdicaoAluno(id) {
  const aluno = listaAlunosCache.find((a) => a.id === Number(id));
  if (!aluno) return;

  document.getElementById('aluno-id').value = aluno.id;
  document.getElementById('aluno-nome').value = aluno.nome;
  document.getElementById('aluno-cpf').value = aluno.cpf;
  document.getElementById('aluno-rg').value = aluno.rg || '';
  document.getElementById('aluno-email').value = aluno.email;
  document.getElementById('aluno-endereco').value = aluno.endereco;
  document.getElementById('aluno-instituicao').value = aluno.instituicaoId;
  document.getElementById('aluno-curso').value = aluno.curso;
  document.getElementById('aluno-login').value = aluno.login;
  inputAlunoSenha.value = '';
  inputAlunoSenha.required = false;
  labelAlunoSenha.textContent = 'Nova Senha (opcional)';
  inputAlunoSenha.placeholder = 'Deixe em branco para manter a atual';

  formAlunoTitulo.textContent = `Editando Aluno #${aluno.id}`;
  badgeModoAluno.textContent = 'Modo Edição';
  badgeModoAluno.className = 'badge badge-warning';
  btnSalvarAluno.textContent = 'Salvar Alterações';
  btnCancelarAluno.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

formAluno.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idEdicao = document.getElementById('aluno-id').value;

  const payload = {
    nome: document.getElementById('aluno-nome').value,
    cpf: document.getElementById('aluno-cpf').value,
    rg: document.getElementById('aluno-rg').value,
    email: document.getElementById('aluno-email').value,
    endereco: document.getElementById('aluno-endereco').value,
    instituicaoId: Number(document.getElementById('aluno-instituicao').value),
    curso: document.getElementById('aluno-curso').value,
    login: document.getElementById('aluno-login').value,
    senha: inputAlunoSenha.value,
  };

  try {
    if (idEdicao) {
      await apiRequest(`/api/alunos/${idEdicao}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mostrarMensagem('Dados do aluno atualizados com sucesso!');
    } else {
      await apiRequest('/api/alunos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      mostrarMensagem('Aluno cadastrado com sucesso!');
    }
    resetarFormularioAluno();
    await carregarAlunos();
  } catch (err) {
    mostrarMensagem(err.message, 'error');
  }
});

btnCancelarAluno.addEventListener('click', resetarFormularioAluno);
document.getElementById('btn-recarregar-alunos').addEventListener('click', carregarAlunos);

tabelaAlunosBody.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('[data-editar-aluno]');
  if (btnEditar) {
    iniciarEdicaoAluno(btnEditar.dataset.editarAluno);
    return;
  }

  const btnExcluir = e.target.closest('[data-excluir-aluno]');
  if (btnExcluir) {
    const id = Number(btnExcluir.dataset.excluirAluno);
    const aluno = listaAlunosCache.find((a) => a.id === id);
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir o cadastro do aluno "${aluno ? aluno.nome : id}"?`
    );
    if (!confirmado) return;

    try {
      await apiRequest(`/api/alunos/${id}`, { method: 'DELETE' });
      mostrarMensagem('Cadastro do aluno excluído com sucesso!');
      if (document.getElementById('aluno-id').value === String(id)) {
        resetarFormularioAluno();
      }
      await carregarAlunos();
    } catch (err) {
      mostrarMensagem(err.message, 'error');
    }
  }
});

// ============================================================================
// 5. CRUD DE EMPRESAS PARCEIRAS (US09 e US10)
// ============================================================================
const formEmpresa = document.getElementById('form-empresa');
const tabelaEmpresasBody = document.getElementById('tabela-empresas-body');
const btnCancelarEmpresa = document.getElementById('btn-cancelar-empresa');
const btnSalvarEmpresa = document.getElementById('btn-salvar-empresa');
const formEmpresaTitulo = document.getElementById('form-empresa-titulo');
const badgeModoEmpresa = document.getElementById('badge-modo-empresa');
const labelEmpresaSenha = document.getElementById('label-empresa-senha');
const inputEmpresaSenha = document.getElementById('empresa-senha');

let listaEmpresasCache = [];

async function carregarEmpresas() {
  try {
    const empresas = await apiRequest('/api/empresas');
    listaEmpresasCache = empresas;

    if (empresas.length === 0) {
      tabelaEmpresasBody.innerHTML =
        '<tr><td colspan="6" class="empty-row">Nenhuma empresa parceira cadastrada até o momento.</td></tr>';
      return;
    }

    tabelaEmpresasBody.innerHTML = empresas
      .map(
        (emp) => `
        <tr>
          <td>#${emp.id}</td>
          <td>
            <strong>${escapeHtml(emp.nome)}</strong>
            <span class="subtext">${escapeHtml(emp.email)}</span>
          </td>
          <td><span>${escapeHtml(emp.cnpj)}</span></td>
          <td><span class="subtext">${escapeHtml(emp.descricao || 'Sem descrição informada')}</span></td>
          <td><code>${escapeHtml(emp.login)}</code></td>
          <td>
            <div class="actions-cell">
              <button type="button" class="btn btn-sm btn-edit" data-editar-empresa="${emp.id}">Editar</button>
              <button type="button" class="btn btn-sm btn-delete" data-excluir-empresa="${emp.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    mostrarMensagem(err.message, 'error');
  }
}

function resetarFormularioEmpresa() {
  formEmpresa.reset();
  document.getElementById('empresa-id').value = '';
  formEmpresaTitulo.textContent = 'Cadastrar Empresa Parceira';
  badgeModoEmpresa.textContent = 'Modo Criação';
  badgeModoEmpresa.className = 'badge badge-info';
  btnSalvarEmpresa.textContent = 'Cadastrar Empresa';
  btnCancelarEmpresa.classList.add('hidden');
  inputEmpresaSenha.required = true;
  labelEmpresaSenha.textContent = 'Senha *';
  inputEmpresaSenha.placeholder = 'Informe a senha';
}

function iniciarEdicaoEmpresa(id) {
  const emp = listaEmpresasCache.find((e) => e.id === Number(id));
  if (!emp) return;

  document.getElementById('empresa-id').value = emp.id;
  document.getElementById('empresa-nome').value = emp.nome;
  document.getElementById('empresa-cnpj').value = emp.cnpj;
  document.getElementById('empresa-email').value = emp.email;
  document.getElementById('empresa-descricao').value = emp.descricao || '';
  document.getElementById('empresa-login').value = emp.login;
  inputEmpresaSenha.value = '';
  inputEmpresaSenha.required = false;
  labelEmpresaSenha.textContent = 'Nova Senha (opcional)';
  inputEmpresaSenha.placeholder = 'Deixe em branco para manter a atual';

  formEmpresaTitulo.textContent = `Editando Empresa #${emp.id}`;
  badgeModoEmpresa.textContent = 'Modo Edição';
  badgeModoEmpresa.className = 'badge badge-warning';
  btnSalvarEmpresa.textContent = 'Salvar Alterações';
  btnCancelarEmpresa.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

formEmpresa.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idEdicao = document.getElementById('empresa-id').value;

  const payload = {
    nome: document.getElementById('empresa-nome').value,
    cnpj: document.getElementById('empresa-cnpj').value,
    email: document.getElementById('empresa-email').value,
    descricao: document.getElementById('empresa-descricao').value,
    login: document.getElementById('empresa-login').value,
    senha: inputEmpresaSenha.value,
  };

  try {
    if (idEdicao) {
      await apiRequest(`/api/empresas/${idEdicao}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mostrarMensagem('Dados da empresa parceira atualizados com sucesso!');
    } else {
      await apiRequest('/api/empresas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      mostrarMensagem('Empresa parceira cadastrada com sucesso!');
    }
    resetarFormularioEmpresa();
    await carregarEmpresas();
  } catch (err) {
    mostrarMensagem(err.message, 'error');
  }
});

btnCancelarEmpresa.addEventListener('click', resetarFormularioEmpresa);
document.getElementById('btn-recarregar-empresas').addEventListener('click', carregarEmpresas);

tabelaEmpresasBody.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('[data-editar-empresa]');
  if (btnEditar) {
    iniciarEdicaoEmpresa(btnEditar.dataset.editarEmpresa);
    return;
  }

  const btnExcluir = e.target.closest('[data-excluir-empresa]');
  if (btnExcluir) {
    const id = Number(btnExcluir.dataset.excluirEmpresa);
    const emp = listaEmpresasCache.find((item) => item.id === id);
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir a empresa parceira "${emp ? emp.nome : id}"?`
    );
    if (!confirmado) return;

    try {
      await apiRequest(`/api/empresas/${id}`, { method: 'DELETE' });
      mostrarMensagem('Empresa parceira excluída com sucesso!');
      if (document.getElementById('empresa-id').value === String(id)) {
        resetarFormularioEmpresa();
      }
      await carregarEmpresas();
    } catch (err) {
      mostrarMensagem(err.message, 'error');
    }
  }
});

// ============================================================================
// 6. AUTENTICAÇÃO DE USUÁRIO (US02)
// ============================================================================
const formLogin = document.getElementById('form-login');
const resultadoLogin = document.getElementById('resultado-login');

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = document.getElementById('login-usuario').value;
  const senha = document.getElementById('login-senha').value;

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, senha }),
    });
    mostrarMensagem(`Bem-vindo(a), ${res.usuario.nome} (${res.usuario.tipo})!`);
    const { saldoMoedas, ...dadosSemSaldo } = res.usuario;
    resultadoLogin.classList.remove('hidden');
    resultadoLogin.innerHTML = `
      <strong>✅ Autenticado como ${escapeHtml(res.usuario.tipo)}:</strong>
      <pre>${escapeHtml(JSON.stringify(dadosSemSaldo, null, 2))}</pre>
    `;
  } catch (err) {
    resultadoLogin.classList.add('hidden');
    mostrarMensagem(err.message, 'error');
  }
});

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inicialização da aplicação
carregarInstituicoes();
carregarAlunos();
carregarEmpresas();

