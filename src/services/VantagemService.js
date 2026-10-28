import { VantagemDAO } from '../dao/VantagemDAO.js';
import { EmpresaParceiraDAO } from '../dao/EmpresaParceiraDAO.js';
import { criarErro } from '../utils/erros.js';
import { inteiroPositivo } from '../utils/validacao.js';

export class VantagemService {
  constructor(vantagemDAO = new VantagemDAO(), empresaDAO = new EmpresaParceiraDAO()) {
    this.vantagemDAO = vantagemDAO;
    this.empresaDAO = empresaDAO;
  }

  /**
   * Catálogo do aluno: somente vantagens ativas, opcionalmente filtradas por empresa.
   * @param {{ empresaId?: string | number | null }} [filtro]
   */
  listarAtivas({ empresaId } = {}) {
    if (empresaId === undefined || empresaId === null || empresaId === '') {
      return this.vantagemDAO.findAtivas();
    }
    const id = inteiroPositivo(empresaId);
    if (id === null) {
      throw criarErro(400, 'O filtro "empresaId" deve ser um número inteiro maior que zero.');
    }
    return this.vantagemDAO.findAtivas({ empresaId: id });
  }

  /** Todas as vantagens (ativas e inativas) da empresa autenticada. */
  listarDaEmpresa(empresaId) {
    return this.vantagemDAO.findByEmpresa(empresaId);
  }

  cadastrar(empresaId, dados = {}) {
    const empresa = this.#carregarEmpresa(empresaId);
    const nova = empresa.cadastrarVantagem(dados); // valida nome, descrição, fotoUrl e custo (400)
    return this.vantagemDAO.create({
      empresaId: empresa.id,
      nome: nova.nome,
      descricao: nova.descricao,
      fotoUrl: nova.fotoUrl,
      custoMoedas: nova.custoMoedas,
    });
  }

  atualizar(empresaId, vantagemId, dados = {}) {
    const { empresa, existente } = this.#carregarVantagemDaEmpresa(empresaId, vantagemId);
    empresa.vantagens = [existente];
    const editada = empresa.editarVantagem(existente.id, dados); // valida os dados (400)
    return this.vantagemDAO.update(existente.id, editada);
  }

  alterarAtiva(empresaId, vantagemId, ativa) {
    if (typeof ativa !== 'boolean') {
      throw criarErro(400, 'O campo "ativa" deve ser verdadeiro ou falso.');
    }
    const { existente } = this.#carregarVantagemDaEmpresa(empresaId, vantagemId);
    return this.vantagemDAO.setAtiva(existente.id, ativa);
  }

  excluir(empresaId, vantagemId) {
    const { existente } = this.#carregarVantagemDaEmpresa(empresaId, vantagemId);
    if (this.vantagemDAO.contarResgates(existente.id) > 0) {
      throw criarErro(409, 'Esta vantagem possui resgates e não pode ser excluída; desative a vantagem.');
    }
    return this.vantagemDAO.delete(existente.id);
  }

  #carregarEmpresa(empresaId) {
    const empresa = this.empresaDAO.findById(empresaId);
    if (!empresa) {
      throw criarErro(404, 'Empresa parceira não encontrada.');
    }
    return empresa;
  }

  /** 404 se a vantagem não existe; 403 se pertence a outra empresa. */
  #carregarVantagemDaEmpresa(empresaId, vantagemId) {
    const empresa = this.#carregarEmpresa(empresaId);
    const id = inteiroPositivo(vantagemId);
    const existente = id === null ? null : this.vantagemDAO.findById(id);
    if (!existente) {
      throw criarErro(404, 'Vantagem não encontrada.');
    }
    if (existente.empresaId !== empresa.id) {
      throw criarErro(403, 'Esta vantagem pertence a outra empresa.');
    }
    return { empresa, existente };
  }
}
