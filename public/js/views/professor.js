// ============================================================================
// Perfil PROFESSOR: Painel, Enviar Moedas e Extrato (envios + créditos semestrais).
// As funções render* são puras (dados -> HTML) e escapam todo dado de usuário.
// ============================================================================
import { apiRequest } from '../api.js';
import {
  escapeHtml,
  formatarData,
  formatarMoedas,
  mostrarErro,
  mostrarMensagem,
  renderEstadoVazio,
  renderValor,
} from '../util.js';

// ---------------------------------------------------------------------------
// Renderização (pura)
// ---------------------------------------------------------------------------

export function renderPainelProfessor(prof) {
  const inst = prof.instituicao || {};
  return `
    <div class="card perfil-card">
      <div class="card-header">
        <h2>Painel do Professor</h2>
        <span class="badge-coins" data-saldo-professor>${escapeHtml(formatarMoedas(prof.saldoMoedas))}</span>
      </div>
      <dl class="dados-lista">
        <div><dt>Nome</dt><dd>${escapeHtml(prof.nome)}</dd></div>
        <div><dt>CPF</dt><dd>${escapeHtml(prof.cpf)}</dd></div>
        <div><dt>Departamento</dt><dd>${escapeHtml(prof.departamento)}</dd></div>
        <div><dt>Instituição de ensino</dt><dd>${escapeHtml(inst.nome || '-')}<span class="subtext">${escapeHtml(inst.endereco || '')}</span></dd></div>
        <div><dt>E-mail</dt><dd>${escapeHtml(prof.email)}</dd></div>
        <div><dt>Login</dt><dd><code>${escapeHtml(prof.login)}</code></dd></div>
      </dl>
    </div>
    <div class="card">
      <div class="card-header"><h2>Crédito semestral</h2></div>
      <p class="helper-text">Cada professor recebe 1.000 moedas por semestre, somadas ao saldo atual. O crédito já é feito automaticamente; use o botão abaixo para conferir ou forçar a execução (não duplica).</p>
      <button type="button" class="btn btn-outline btn-sm" id="btn-credito-semestral">Executar crédito semestral</button>
      <div id="credito-resultado" class="resultado-bloco" role="status"></div>
    </div>`;
}

export function renderResultadoCredito(res) {
  const creditados = res.creditados || [];
  const lista = creditados.length
    ? `<ul class="lista-simples">${creditados
        .map(
          (c) =>
            `<li>${escapeHtml(c.nome)}: +${escapeHtml(formatarMoedas(c.quantidade))} (saldo: ${escapeHtml(formatarMoedas(c.saldoMoedas))})</li>`
        )
        .join('')}</ul>`
    : '';
  return `<p><strong>Semestre ${escapeHtml(res.semestre)}</strong></p><p>${escapeHtml(res.message)}</p>${lista}`;
}

export function renderFormEnviarMoedas(destinatarios, saldo) {
  const opcoes = destinatarios
    .map((d) => {
      const detalhe = [d.curso, d.instituicaoNome].filter(Boolean).join(' — ');
      return `<option value="${Number(d.id)}">${escapeHtml(d.nome)}${detalhe ? ` (${escapeHtml(detalhe)})` : ''}</option>`;
    })
    .join('');

  if (!destinatarios.length) {
    return `<div class="card"><div class="card-header"><h2>Enviar Moedas</h2></div>${renderEstadoVazio('Nenhum aluno cadastrado para receber moedas.')}</div>`;
  }

  return `
    <div class="card form-card">
      <div class="card-header">
        <h2>Enviar Moedas</h2>
        <span class="badge-coins" id="envio-saldo">Saldo: ${escapeHtml(formatarMoedas(saldo))}</span>
      </div>
      <form id="form-enviar-moedas" autocomplete="off">
        <div class="form-group">
          <label for="envio-aluno">Aluno *</label>
          <select id="envio-aluno" required>
            <option value="">Selecione o aluno...</option>
            ${opcoes}
          </select>
        </div>
        <div class="form-group">
          <label for="envio-quantidade">Quantidade de moedas *</label>
          <input type="number" id="envio-quantidade" required min="1" step="1" inputmode="numeric" />
        </div>
        <div class="form-group">
          <label for="envio-motivo">Motivo do reconhecimento *</label>
          <textarea id="envio-motivo" required rows="3" maxlength="1000" placeholder="Ex.: Participação excelente na aula de hoje"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="btn-enviar-moedas">Enviar moedas</button>
        </div>
      </form>
      <div id="envio-resultado" class="resultado-bloco" role="status"></div>
    </div>`;
}

export function renderResultadoEnvio(res) {
  const t = res.transacao || {};
  const email = res.emailEnviado
    ? 'O aluno foi notificado por e-mail.'
    : 'Não foi possível enviar o e-mail de notificação ao aluno (as moedas foram enviadas normalmente).';
  return `
    <p><strong>${escapeHtml(formatarMoedas(t.quantidade))}</strong> enviadas para <strong>${escapeHtml(t.alunoNome)}</strong>.</p>
    <p>Saldo restante: <strong>${escapeHtml(formatarMoedas(res.saldoProfessor))}</strong></p>
    <p class="hint">${escapeHtml(email)}</p>`;
}

function linhaExtratoProfessor(item) {
  if (item.tipo === 'CREDITO') {
    return `
      <tr>
        <td>${escapeHtml(formatarData(item.dataHora))}</td>
        <td><span class="badge badge-info">Crédito semestral</span></td>
        <td><strong>Semestre ${escapeHtml(item.semestre)}</strong></td>
        <td class="col-valor">${renderValor(item.quantidade, true)}</td>
      </tr>`;
  }
  return `
    <tr>
      <td>${escapeHtml(formatarData(item.dataHora))}</td>
      <td><span class="badge badge-warning">Envio</span></td>
      <td>
        <strong>${escapeHtml(item.alunoNome)}</strong>
        <span class="subtext">Motivo: ${escapeHtml(item.motivo)}</span>
      </td>
      <td class="col-valor">${renderValor(item.quantidade, false)}</td>
    </tr>`;
}

export function renderExtratoProfessor(extrato) {
  const transacoes = extrato.transacoes || [];
  const tabela = transacoes.length
    ? `<div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Data</th><th>Operação</th><th>Detalhes</th><th>Moedas</th></tr></thead>
          <tbody>${transacoes.map(linhaExtratoProfessor).join('')}</tbody>
        </table>
      </div>`
    : renderEstadoVazio('Nenhuma movimentação registrada.');

  return `
    <div class="card">
      <div class="card-header">
        <h2>Extrato</h2>
        <span class="badge-coins">Saldo: ${escapeHtml(formatarMoedas(extrato.saldoMoedas))}</span>
      </div>
      ${tabela}
    </div>`;
}

// ---------------------------------------------------------------------------
// Comportamento (só roda dentro das abas, depois do login)
// ---------------------------------------------------------------------------

function montarPainel(ctx) {
  return async (painel, { vigente }) => {
    const prof = await apiRequest('/api/professores/me');
    if (!vigente()) return;
    painel.innerHTML = renderPainelProfessor(prof);
    ctx.atualizarSaldo(prof.saldoMoedas);

    const botao = painel.querySelector('#btn-credito-semestral');
    const resultado = painel.querySelector('#credito-resultado');
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        const res = await apiRequest('/api/creditos-semestrais/executar', { method: 'POST' });
        resultado.innerHTML = renderResultadoCredito(res);
        mostrarMensagem(res.message);

        const atual = await apiRequest('/api/professores/me');
        ctx.atualizarSaldo(atual.saldoMoedas);
        const saldoEl = painel.querySelector('[data-saldo-professor]');
        if (saldoEl) saldoEl.textContent = formatarMoedas(atual.saldoMoedas);
      } catch (erro) {
        mostrarErro(erro);
      } finally {
        botao.disabled = false;
      }
    });
  };
}

function montarEnvio(ctx) {
  return async (painel, { vigente }) => {
    const [destinatarios, prof] = await Promise.all([
      apiRequest('/api/alunos/destinatarios'),
      apiRequest('/api/professores/me'),
    ]);
    if (!vigente()) return;
    painel.innerHTML = renderFormEnviarMoedas(destinatarios, prof.saldoMoedas);
    ctx.atualizarSaldo(prof.saldoMoedas);

    const form = painel.querySelector('#form-enviar-moedas');
    if (!form) return;
    const resultado = painel.querySelector('#envio-resultado');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = painel.querySelector('#btn-enviar-moedas');
      botao.disabled = true;
      try {
        const res = await apiRequest('/api/transacoes/enviar-moedas', {
          method: 'POST',
          body: {
            alunoId: Number(painel.querySelector('#envio-aluno').value),
            quantidade: Number(painel.querySelector('#envio-quantidade').value),
            motivo: painel.querySelector('#envio-motivo').value,
          },
        });
        ctx.atualizarSaldo(res.saldoProfessor);
        painel.querySelector('#envio-saldo').textContent = `Saldo: ${formatarMoedas(res.saldoProfessor)}`;
        resultado.innerHTML = renderResultadoEnvio(res);
        form.reset();
        mostrarMensagem(
          res.emailEnviado
            ? 'Moedas enviadas! O aluno foi notificado por e-mail.'
            : 'Moedas enviadas, mas o e-mail ao aluno não pôde ser enviado.',
          res.emailEnviado ? 'success' : 'warning'
        );
      } catch (erro) {
        mostrarErro(erro);
      } finally {
        botao.disabled = false;
      }
    });
  };
}

function montarExtrato(ctx) {
  return async (painel, { vigente }) => {
    const extrato = await apiRequest('/api/extrato');
    if (!vigente()) return;
    painel.innerHTML = renderExtratoProfessor(extrato);
    ctx.atualizarSaldo(extrato.saldoMoedas);
  };
}

export function abasProfessor(ctx) {
  return [
    { id: 'painel', rotulo: 'Painel', montar: montarPainel(ctx) },
    { id: 'enviar', rotulo: 'Enviar Moedas', montar: montarEnvio(ctx) },
    { id: 'extrato', rotulo: 'Extrato', montar: montarExtrato(ctx) },
  ];
}
