// ============================================================================
// Perfil ALUNO: Meu Perfil, Extrato e Vantagens (resgate).
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
  renderFoto,
  renderValor,
} from '../util.js';
import { aplicarMascaraCPF, aplicarMascaraRG, ativarMascara } from '../mascaras.js';

// ---------------------------------------------------------------------------
// Renderização (pura)
// ---------------------------------------------------------------------------

export function renderPerfilAluno(aluno, instituicoes = []) {
  const opcoes = instituicoes
    .map((i) => {
      const selecionada = Number(i.id) === Number(aluno.instituicaoId) ? ' selected' : '';
      return `<option value="${Number(i.id)}"${selecionada}>${escapeHtml(i.nome)}</option>`;
    })
    .join('');

  return `
    <div class="card form-card perfil-card">
      <div class="card-header">
        <h2>Meu Perfil</h2>
        <span class="badge-coins">${escapeHtml(formatarMoedas(aluno.saldoMoedas))}</span>
      </div>
      <form id="form-perfil-aluno" autocomplete="off">
        <div class="form-group">
          <label for="perfil-nome">Nome completo *</label>
          <input type="text" id="perfil-nome" required value="${escapeHtml(aluno.nome)}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="perfil-cpf">CPF *</label>
            <input type="text" id="perfil-cpf" required maxlength="14" value="${escapeHtml(aluno.cpf)}" />
          </div>
          <div class="form-group">
            <label for="perfil-rg">RG (opcional)</label>
            <input type="text" id="perfil-rg" maxlength="13" placeholder="XX-99.999.999" value="${escapeHtml(aluno.rg || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label for="perfil-email">E-mail *</label>
          <input type="email" id="perfil-email" required value="${escapeHtml(aluno.email)}" />
        </div>
        <div class="form-group">
          <label for="perfil-endereco">Endereço *</label>
          <input type="text" id="perfil-endereco" required value="${escapeHtml(aluno.endereco)}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="perfil-instituicao">Instituição de ensino *</label>
            <select id="perfil-instituicao" required>${opcoes}</select>
          </div>
          <div class="form-group">
            <label for="perfil-curso">Curso *</label>
            <input type="text" id="perfil-curso" required value="${escapeHtml(aluno.curso)}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="perfil-login">Login *</label>
            <input type="text" id="perfil-login" required value="${escapeHtml(aluno.login)}" />
          </div>
          <div class="form-group">
            <label for="perfil-senha">Nova senha (opcional)</label>
            <input type="password" id="perfil-senha" autocomplete="new-password" placeholder="Deixe em branco para manter a atual" />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="btn-salvar-perfil">Salvar alterações</button>
          <button type="button" class="btn btn-delete" id="btn-excluir-conta">Excluir minha conta</button>
        </div>
      </form>
    </div>`;
}

function linhaExtratoAluno(item) {
  if (item.tipo === 'RESGATE') {
    return `
      <tr>
        <td>${escapeHtml(formatarData(item.dataHora))}</td>
        <td><span class="badge badge-warning">Resgate</span></td>
        <td>
          <strong>${escapeHtml(item.vantagemNome)}</strong>
          <span class="subtext">${escapeHtml(item.empresaNome)}</span>
          <span class="subtext">Cupom: <code>${escapeHtml(item.codigoCupom)}</code></span>
        </td>
        <td class="col-valor">${renderValor(item.quantidade, false)}</td>
      </tr>`;
  }
  return `
    <tr>
      <td>${escapeHtml(formatarData(item.dataHora))}</td>
      <td><span class="badge badge-info">Recebimento</span></td>
      <td>
        <strong>${escapeHtml(item.professorNome ? `Professor(a) ${item.professorNome}` : item.descricao)}</strong>
        <span class="subtext">Motivo: ${escapeHtml(item.motivo)}</span>
      </td>
      <td class="col-valor">${renderValor(item.quantidade, true)}</td>
    </tr>`;
}

export function renderExtratoAluno(extrato) {
  const transacoes = extrato.transacoes || [];
  const tabela = transacoes.length
    ? `<div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Data</th><th>Operação</th><th>Detalhes</th><th>Moedas</th></tr></thead>
          <tbody>${transacoes.map(linhaExtratoAluno).join('')}</tbody>
        </table>
      </div>`
    : renderEstadoVazio('Você ainda não recebeu nem trocou moedas.');

  return `
    <div class="card">
      <div class="card-header">
        <h2>Extrato</h2>
        <span class="badge-coins">Saldo: ${escapeHtml(formatarMoedas(extrato.saldoMoedas))}</span>
      </div>
      ${tabela}
    </div>`;
}

function cardVantagemAluno(v, saldo) {
  const custo = Number(v.custoMoedas);
  const suficiente = custo <= saldo;
  const id = Number(v.id);
  const aviso = suficiente
    ? ''
    : `<p class="hint hint-alerta" id="aviso-saldo-${id}">Saldo insuficiente: faltam ${escapeHtml(formatarMoedas(custo - saldo))}.</p>`;
  const botao = suficiente
    ? `<button type="button" class="btn btn-primary btn-sm" data-resgatar="${id}">Resgatar</button>`
    : `<button type="button" class="btn btn-primary btn-sm" data-resgatar="${id}" disabled aria-describedby="aviso-saldo-${id}">Resgatar</button>`;

  return `
    <article class="card vantagem-card">
      ${renderFoto(v.fotoUrl, v.nome)}
      <div class="vantagem-corpo">
        <h3>${escapeHtml(v.nome)}</h3>
        <span class="subtext">${escapeHtml(v.empresaNome)}</span>
        <p class="vantagem-desc">${escapeHtml(v.descricao)}</p>
      </div>
      <div class="vantagem-rodape">
        <span class="badge-coins">${escapeHtml(formatarMoedas(custo))}</span>
        ${botao}
      </div>
      ${aviso}
    </article>`;
}

export function renderVantagensAluno(vantagens, saldo) {
  const saldoNum = Number(saldo) || 0;
  const cabecalho = `<p class="saldo-linha">Seu saldo: <strong>${escapeHtml(formatarMoedas(saldoNum))}</strong></p>`;
  if (!vantagens.length) {
    return cabecalho + renderEstadoVazio('Nenhuma vantagem disponível no momento.');
  }
  return `${cabecalho}<div class="cards-grid">${vantagens.map((v) => cardVantagemAluno(v, saldoNum)).join('')}</div>`;
}

function textoEmail(enviado, destino) {
  return enviado
    ? `E-mail ${destino}: enviado.`
    : `E-mail ${destino}: não foi possível enviar (o resgate foi concluído normalmente).`;
}

export function renderResgateSucesso(res) {
  const v = res.vantagem || {};
  return `
    <div class="card resgate-sucesso" role="status">
      <h3>Vantagem resgatada!</h3>
      <p><strong>${escapeHtml(v.nome)}</strong> — ${escapeHtml(v.empresaNome)}</p>
      <p class="hint">Código do cupom (apresente na troca presencial):</p>
      <p class="codigo-cupom">${escapeHtml(res.codigo)}</p>
      <p>Novo saldo: <strong>${escapeHtml(formatarMoedas(res.novoSaldo))}</strong></p>
      <p class="hint">${escapeHtml(textoEmail(res.emailAlunoEnviado, 'com o cupom para você'))}</p>
      <p class="hint">${escapeHtml(textoEmail(res.emailEmpresaEnviado, 'de conferência para o parceiro'))}</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Comportamento (só roda dentro das abas, depois do login)
// ---------------------------------------------------------------------------

function montarPerfil(ctx) {
  return async (painel, { vigente }) => {
    const idAluno = ctx.usuario.id;
    const [aluno, instituicoes] = await Promise.all([
      apiRequest(`/api/alunos/${idAluno}`),
      apiRequest('/api/instituicoes'),
    ]);
    if (!vigente()) return;
    painel.innerHTML = renderPerfilAluno(aluno, instituicoes);
    ctx.atualizarSaldo(aluno.saldoMoedas);

    ativarMascara(painel.querySelector('#perfil-cpf'), aplicarMascaraCPF);
    ativarMascara(painel.querySelector('#perfil-rg'), aplicarMascaraRG);
    const valor = (id) => painel.querySelector(`#${id}`).value;

    painel.querySelector('#form-perfil-aluno').addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = painel.querySelector('#btn-salvar-perfil');
      botao.disabled = true;
      try {
        const atualizado = await apiRequest(`/api/alunos/${idAluno}`, {
          method: 'PUT',
          body: {
            nome: valor('perfil-nome'),
            cpf: valor('perfil-cpf'),
            rg: valor('perfil-rg'),
            email: valor('perfil-email'),
            endereco: valor('perfil-endereco'),
            instituicaoId: Number(valor('perfil-instituicao')),
            curso: valor('perfil-curso'),
            login: valor('perfil-login'),
            senha: valor('perfil-senha'),
          },
        });
        painel.querySelector('#perfil-senha').value = '';
        ctx.atualizarUsuario({ nome: atualizado.nome, email: atualizado.email, login: atualizado.login });
        mostrarMensagem('Dados atualizados com sucesso!');
      } catch (erro) {
        mostrarErro(erro);
      } finally {
        botao.disabled = false;
      }
    });

    painel.querySelector('#btn-excluir-conta').addEventListener('click', async () => {
      if (!window.confirm('Tem certeza que deseja excluir a sua conta? Esta ação não pode ser desfeita.')) return;
      try {
        await apiRequest(`/api/alunos/${idAluno}`, { method: 'DELETE' });
        ctx.sair();
        mostrarMensagem('Sua conta foi excluída.');
      } catch (erro) {
        mostrarErro(erro);
      }
    });
  };
}

function montarExtrato(ctx) {
  return async (painel, { vigente }) => {
    const extrato = await apiRequest('/api/extrato');
    if (!vigente()) return;
    painel.innerHTML = renderExtratoAluno(extrato);
    ctx.atualizarSaldo(extrato.saldoMoedas);
  };
}

function montarVantagens(ctx) {
  return async (painel, { vigente }) => {
    const [vantagens, { usuario }] = await Promise.all([apiRequest('/api/vantagens'), apiRequest('/api/auth/me')]);
    if (!vigente()) return;
    let saldo = Number(usuario.saldoMoedas) || 0;
    ctx.atualizarSaldo(saldo);

    painel.innerHTML = `
      <div id="resgate-resultado"></div>
      <div id="vantagens-lista"></div>`;
    const resultado = painel.querySelector('#resgate-resultado');
    const lista = painel.querySelector('#vantagens-lista');

    const desenhar = () => {
      lista.innerHTML = renderVantagensAluno(vantagens, saldo);
    };
    desenhar();

    lista.addEventListener('click', async (e) => {
      const botao = e.target.closest('[data-resgatar]');
      if (!botao || botao.disabled) return;
      botao.disabled = true;
      try {
        const res = await apiRequest(`/api/vantagens/${Number(botao.dataset.resgatar)}/resgatar`, { method: 'POST' });
        saldo = Number(res.novoSaldo);
        ctx.atualizarSaldo(saldo);
        resultado.innerHTML = renderResgateSucesso(res);
        const falhou = !res.emailAlunoEnviado || !res.emailEmpresaEnviado;
        mostrarMensagem(
          falhou
            ? 'Resgate concluído, mas um dos e-mails não pôde ser enviado. Guarde o código do cupom.'
            : 'Vantagem resgatada! O cupom foi enviado por e-mail.',
          falhou ? 'warning' : 'success'
        );
        resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (erro) {
        mostrarErro(erro);
      } finally {
        desenhar();
      }
    });
  };
}

export function abasAluno(ctx) {
  return [
    { id: 'perfil', rotulo: 'Meu Perfil', montar: montarPerfil(ctx) },
    { id: 'extrato', rotulo: 'Extrato', montar: montarExtrato(ctx) },
    { id: 'vantagens', rotulo: 'Vantagens', montar: montarVantagens(ctx) },
  ];
}
