// ============================================================================
// Perfil EMPRESA PARCEIRA: Meu Perfil, Minhas Vantagens e Resgates Recebidos.
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
import { aplicarMascaraCNPJ, ativarMascara } from '../mascaras.js';

// ---------------------------------------------------------------------------
// Renderização (pura)
// ---------------------------------------------------------------------------

export function renderPerfilEmpresa(empresa) {
  return `
    <div class="card form-card perfil-card">
      <div class="card-header"><h2>Meu Perfil</h2></div>
      <form id="form-perfil-empresa" autocomplete="off">
        <div class="form-group">
          <label for="perfil-nome">Razão social / nome fantasia *</label>
          <input type="text" id="perfil-nome" required value="${escapeHtml(empresa.nome)}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="perfil-cnpj">CNPJ *</label>
            <input type="text" id="perfil-cnpj" required maxlength="18" value="${escapeHtml(empresa.cnpj)}" />
          </div>
          <div class="form-group">
            <label for="perfil-email">E-mail corporativo *</label>
            <input type="email" id="perfil-email" required value="${escapeHtml(empresa.email)}" />
          </div>
        </div>
        <div class="form-group">
          <label for="perfil-descricao">Descrição da parceria / atuação</label>
          <textarea id="perfil-descricao" rows="3">${escapeHtml(empresa.descricao || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="perfil-login">Login *</label>
            <input type="text" id="perfil-login" required value="${escapeHtml(empresa.login)}" />
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

export function renderFormVantagem(vantagem = null) {
  const editando = Boolean(vantagem);
  return `
    <div class="card form-card">
      <div class="card-header">
        <h2 id="vantagem-form-titulo">${editando ? `Editando: ${escapeHtml(vantagem.nome)}` : 'Cadastrar vantagem'}</h2>
        <span class="badge ${editando ? 'badge-warning' : 'badge-info'}">${editando ? 'Modo Edição' : 'Modo Criação'}</span>
      </div>
      <form id="form-vantagem" autocomplete="off">
        <input type="hidden" id="vantagem-id" value="${editando ? Number(vantagem.id) : ''}" />
        <div class="form-group">
          <label for="vantagem-nome">Nome *</label>
          <input type="text" id="vantagem-nome" required maxlength="150" value="${escapeHtml(vantagem?.nome || '')}" placeholder="Ex.: 20% de desconto no almoço" />
        </div>
        <div class="form-group">
          <label for="vantagem-descricao">Descrição *</label>
          <textarea id="vantagem-descricao" required rows="3">${escapeHtml(vantagem?.descricao || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="vantagem-foto-url">URL da foto do produto *</label>
          <input type="url" id="vantagem-foto-url" required maxlength="500" value="${escapeHtml(vantagem?.fotoUrl || '')}" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label for="vantagem-custo">Custo em moedas *</label>
          <input type="number" id="vantagem-custo" required min="1" step="1" inputmode="numeric" value="${editando ? Number(vantagem.custoMoedas) : ''}" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="btn-salvar-vantagem">${editando ? 'Salvar alterações' : 'Cadastrar vantagem'}</button>
          <button type="button" class="btn btn-secondary${editando ? '' : ' hidden'}" id="btn-cancelar-vantagem">Cancelar edição</button>
        </div>
      </form>
    </div>`;
}

function cardVantagemEmpresa(v) {
  const id = Number(v.id);
  const ativa = v.ativa === true;
  return `
    <article class="card vantagem-card${ativa ? '' : ' vantagem-inativa'}">
      ${renderFoto(v.fotoUrl, v.nome)}
      <div class="vantagem-corpo">
        <h3>${escapeHtml(v.nome)}</h3>
        <p class="vantagem-desc">${escapeHtml(v.descricao)}</p>
      </div>
      <div class="vantagem-rodape">
        <span class="badge-coins">${escapeHtml(formatarMoedas(v.custoMoedas))}</span>
        <span class="badge ${ativa ? 'badge-ativa' : 'badge-inativa'}">${ativa ? 'Ativa' : 'Inativa'}</span>
      </div>
      <div class="actions-cell vantagem-acoes">
        <button type="button" class="btn btn-sm btn-edit" data-editar-vantagem="${id}">Editar</button>
        <button type="button" class="btn btn-sm btn-outline" data-alternar-vantagem="${id}">${ativa ? 'Desativar' : 'Ativar'}</button>
        <button type="button" class="btn btn-sm btn-delete" data-excluir-vantagem="${id}">Excluir</button>
      </div>
    </article>`;
}

export function renderListaVantagens(vantagens) {
  if (!vantagens.length) {
    return renderEstadoVazio('Você ainda não cadastrou nenhuma vantagem.');
  }
  return `<div class="cards-grid">${vantagens.map(cardVantagemEmpresa).join('')}</div>`;
}

export function renderResgatesRecebidos(extrato) {
  const resgates = extrato.transacoes || [];
  const tabela = resgates.length
    ? `<div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Data</th><th>Código do cupom</th><th>Vantagem</th><th>Aluno</th><th>Moedas</th></tr></thead>
          <tbody>${resgates
            .map(
              (r) => `
            <tr>
              <td>${escapeHtml(formatarData(r.dataHora))}</td>
              <td><code class="codigo-inline">${escapeHtml(r.codigoCupom)}</code></td>
              <td>${escapeHtml(r.vantagemNome)}</td>
              <td>${escapeHtml(r.alunoNome)}</td>
              <td class="col-valor">${renderValor(r.quantidade, true)}</td>
            </tr>`
            )
            .join('')}</tbody>
        </table>
      </div>`
    : renderEstadoVazio('Nenhum resgate recebido até o momento.');

  return `
    <div class="card">
      <div class="card-header"><h2>Resgates recebidos</h2></div>
      <p class="helper-text">Use o código do cupom para conferir a troca presencial com o aluno.</p>
      ${tabela}
    </div>`;
}

// ---------------------------------------------------------------------------
// Comportamento (só roda dentro das abas, depois do login)
// ---------------------------------------------------------------------------

function montarPerfil(ctx) {
  return async (painel, { vigente }) => {
    const idEmpresa = ctx.usuario.id;
    const empresa = await apiRequest(`/api/empresas/${idEmpresa}`);
    if (!vigente()) return;
    painel.innerHTML = renderPerfilEmpresa(empresa);

    ativarMascara(painel.querySelector('#perfil-cnpj'), aplicarMascaraCNPJ);
    const valor = (id) => painel.querySelector(`#${id}`).value;

    painel.querySelector('#form-perfil-empresa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = painel.querySelector('#btn-salvar-perfil');
      botao.disabled = true;
      try {
        const atualizada = await apiRequest(`/api/empresas/${idEmpresa}`, {
          method: 'PUT',
          body: {
            nome: valor('perfil-nome'),
            cnpj: valor('perfil-cnpj'),
            email: valor('perfil-email'),
            descricao: valor('perfil-descricao'),
            login: valor('perfil-login'),
            senha: valor('perfil-senha'),
          },
        });
        painel.querySelector('#perfil-senha').value = '';
        ctx.atualizarUsuario({ nome: atualizada.nome, email: atualizada.email, login: atualizada.login });
        mostrarMensagem('Dados da empresa atualizados com sucesso!');
      } catch (erro) {
        mostrarErro(erro);
      } finally {
        botao.disabled = false;
      }
    });

    painel.querySelector('#btn-excluir-conta').addEventListener('click', async () => {
      if (!window.confirm('Tem certeza que deseja excluir a conta da empresa? Esta ação não pode ser desfeita.')) return;
      try {
        await apiRequest(`/api/empresas/${idEmpresa}`, { method: 'DELETE' });
        ctx.sair();
        mostrarMensagem('A conta da empresa foi excluída.');
      } catch (erro) {
        mostrarErro(erro);
      }
    });
  };
}

function montarVantagens() {
  return async (painel, { vigente }) => {
    let vantagens = await apiRequest('/api/vantagens/minhas');
    if (!vigente()) return;

    painel.innerHTML = `<div id="vantagem-form-area"></div><div id="vantagens-lista"></div>`;
    const areaForm = painel.querySelector('#vantagem-form-area');
    const lista = painel.querySelector('#vantagens-lista');

    const desenharLista = () => {
      lista.innerHTML = renderListaVantagens(vantagens);
    };

    const recarregar = async () => {
      vantagens = await apiRequest('/api/vantagens/minhas');
      desenharLista();
    };

    const desenharForm = (vantagem = null) => {
      areaForm.innerHTML = renderFormVantagem(vantagem);
      const form = areaForm.querySelector('#form-vantagem');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdicao = areaForm.querySelector('#vantagem-id').value;
        const botao = areaForm.querySelector('#btn-salvar-vantagem');
        botao.disabled = true;
        try {
          await apiRequest(idEdicao ? `/api/vantagens/${Number(idEdicao)}` : '/api/vantagens', {
            method: idEdicao ? 'PUT' : 'POST',
            body: {
              nome: areaForm.querySelector('#vantagem-nome').value,
              descricao: areaForm.querySelector('#vantagem-descricao').value,
              fotoUrl: areaForm.querySelector('#vantagem-foto-url').value,
              custoMoedas: Number(areaForm.querySelector('#vantagem-custo').value),
            },
          });
          mostrarMensagem(idEdicao ? 'Vantagem atualizada com sucesso!' : 'Vantagem cadastrada com sucesso!');
          desenharForm();
          await recarregar();
        } catch (erro) {
          mostrarErro(erro);
          botao.disabled = false;
        }
      });

      areaForm.querySelector('#btn-cancelar-vantagem').addEventListener('click', () => desenharForm());
    };

    desenharForm();
    desenharLista();

    lista.addEventListener('click', async (e) => {
      const editar = e.target.closest('[data-editar-vantagem]');
      if (editar) {
        const v = vantagens.find((x) => x.id === Number(editar.dataset.editarVantagem));
        if (v) {
          desenharForm(v);
          areaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      const alternar = e.target.closest('[data-alternar-vantagem]');
      if (alternar) {
        const v = vantagens.find((x) => x.id === Number(alternar.dataset.alternarVantagem));
        if (!v) return;
        alternar.disabled = true;
        try {
          await apiRequest(`/api/vantagens/${v.id}/ativa`, { method: 'PATCH', body: { ativa: !v.ativa } });
          mostrarMensagem(v.ativa ? 'Vantagem desativada.' : 'Vantagem ativada.');
          await recarregar();
        } catch (erro) {
          mostrarErro(erro);
          alternar.disabled = false;
        }
        return;
      }

      const excluir = e.target.closest('[data-excluir-vantagem]');
      if (excluir) {
        const v = vantagens.find((x) => x.id === Number(excluir.dataset.excluirVantagem));
        if (!v) return;
        if (!window.confirm(`Excluir a vantagem "${v.nome}"?`)) return;
        try {
          await apiRequest(`/api/vantagens/${v.id}`, { method: 'DELETE' });
          mostrarMensagem('Vantagem excluída com sucesso!');
          await recarregar();
        } catch (erro) {
          mostrarErro(erro);
        }
      }
    });
  };
}

function montarResgates() {
  return async (painel, { vigente }) => {
    const extrato = await apiRequest('/api/extrato');
    if (!vigente()) return;
    painel.innerHTML = renderResgatesRecebidos(extrato);
  };
}

export function abasEmpresa(ctx) {
  return [
    { id: 'perfil', rotulo: 'Meu Perfil', montar: montarPerfil(ctx) },
    { id: 'vantagens', rotulo: 'Minhas Vantagens', montar: montarVantagens() },
    { id: 'resgates', rotulo: 'Resgates Recebidos', montar: montarResgates() },
  ];
}
