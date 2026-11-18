import { Usuario } from '../../src/models/Usuario.js';
import { email, password } from '../../src/utils/validation.js';
import { calendario, creditarNoCliente } from '../../src/services/CreditoService.js';

// Cadastros fictícios adicionais. A migration não cria envios, resgates ou emails.
export async function up(client) {
  const instituicoes = {
    puc: ['PUC Minas - Campus Coração Eucarístico', 'Av. Dom José Gaspar, 500 - Belo Horizonte/MG'],
    ufmg: ['Universidade Federal de Minas Gerais (UFMG)', 'Av. Antônio Carlos, 6627 - Belo Horizonte/MG'],
    horizonte: ['Instituto Horizonte — Demonstração', 'Rua Horizonte, 100 - Contagem/MG'],
    vale: ['Faculdade Vale do Saber — Demonstração', 'Rua do Saber, 200 - Betim/MG'],
  };
  const idsInstituicoes = {};
  for (const [chave, [nome, endereco]] of Object.entries(instituicoes)) {
    await client.query('INSERT INTO instituicoes_ensino (nome, endereco) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING', [nome, endereco]);
    idsInstituicoes[chave] = (await client.query('SELECT id FROM instituicoes_ensino WHERE nome = $1', [nome])).rows[0].id;
  }

  const senhas = {
    ALUNO: password(process.env.DEFAULT_ALUNO_PASSWORD || 'Aluno@123456'),
    PROFESSOR: password(process.env.DEFAULT_PROFESSOR_PASSWORD || 'Professor@123456'),
    EMPRESA: password(process.env.DEFAULT_EMPRESA_PASSWORD || 'Empresa@123456'),
  };
  async function usuario(dados, tipo) {
    const result = await client.query(
      'INSERT INTO usuarios (nome, email, login, senha_hash, tipo) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id',
      [dados.nome, email(dados.login + '@example.test'), dados.login, Usuario.gerarHashSenha(senhas[tipo]), tipo]
    );
    if (result.rowCount) return result.rows[0].id;
    const existente = (await client.query('SELECT id, tipo FROM usuarios WHERE lower(login) = $1', [dados.login])).rows[0];
    if (!existente || existente.tipo !== tipo) throw new Error('Conflito no cadastro de demonstração: ' + dados.login);
    const [tabela, documento] = {
      ALUNO: ['alunos', 'cpf'], PROFESSOR: ['professores', 'cpf'], EMPRESA: ['empresas_parceiras', 'cnpj'],
    }[tipo];
    // Identificadores SQL vêm exclusivamente do mapa fixo acima.
    const perfil = (await client.query('SELECT ' + documento + ' AS documento FROM ' + tabela + ' WHERE usuario_id = $1', [existente.id])).rows[0];
    if (!perfil || perfil.documento !== dados[documento]) throw new Error('Login de demonstração já pertence a outro cadastro: ' + dados.login);
    return existente.id; // Preserva nome, email, senha, saldo e situação da conta existente.
  }

  const alunos = [
    {
      "nome": "Ana Souza — Demo",
      "login": "ana.aluno.demo",
      "cpf": "900.000.001-75",
      "rg": "DEMO-AL-001",
      "endereco": "Rua das Acácias, 10 - Belo Horizonte/MG",
      "curso": "Engenharia de Software",
      "instituicao": "puc"
    },
    {
      "nome": "Bruno Lima — Demo",
      "login": "bruno.aluno.demo",
      "cpf": "900.000.002-56",
      "rg": "DEMO-AL-002",
      "endereco": "Rua das Acácias, 20 - Belo Horizonte/MG",
      "curso": "Ciência da Computação",
      "instituicao": "puc"
    },
    {
      "nome": "Carla Mendes — Demo",
      "login": "carla.aluno.demo",
      "cpf": "900.000.003-37",
      "rg": "DEMO-AL-003",
      "endereco": "Rua dos Ipês, 30 - Belo Horizonte/MG",
      "curso": "Sistemas de Informação",
      "instituicao": "ufmg"
    },
    {
      "nome": "Diego Santos — Demo",
      "login": "diego.aluno.demo",
      "cpf": "900.000.004-18",
      "rg": "DEMO-AL-004",
      "endereco": "Rua dos Ipês, 40 - Belo Horizonte/MG",
      "curso": "Engenharia de Produção",
      "instituicao": "ufmg"
    },
    {
      "nome": "Elisa Rocha — Demo",
      "login": "elisa.aluno.demo",
      "cpf": "900.000.005-07",
      "rg": "DEMO-AL-005",
      "endereco": "Rua Horizonte, 50 - Contagem/MG",
      "curso": "Análise e Desenvolvimento de Sistemas",
      "instituicao": "horizonte"
    },
    {
      "nome": "Felipe Alves — Demo",
      "login": "felipe.aluno.demo",
      "cpf": "900.000.006-80",
      "rg": "DEMO-AL-006",
      "endereco": "Rua do Saber, 60 - Betim/MG",
      "curso": "Administração",
      "instituicao": "vale"
    }
  ];
  for (const dados of alunos) {
    const id = await usuario(dados, 'ALUNO');
    await client.query(
      'INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, instituicao_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (usuario_id) DO NOTHING',
      [id, dados.cpf, dados.rg, dados.endereco, dados.curso, idsInstituicoes[dados.instituicao]]
    );
  }

  const professores = [
    {
      "nome": "Mariana Costa — Demo",
      "login": "mariana.professor.demo",
      "cpf": "900.000.007-60",
      "departamento": "Computação",
      "instituicao": "puc"
    },
    {
      "nome": "Rafael Oliveira — Demo",
      "login": "rafael.professor.demo",
      "cpf": "900.000.008-41",
      "departamento": "Engenharia e Tecnologia",
      "instituicao": "ufmg"
    },
    {
      "nome": "Helena Ribeiro — Demo",
      "login": "helena.professor.demo",
      "cpf": "900.000.009-22",
      "departamento": "Desenvolvimento de Sistemas",
      "instituicao": "horizonte"
    },
    {
      "nome": "Lucas Ferreira — Demo",
      "login": "lucas.professor.demo",
      "cpf": "900.000.010-66",
      "departamento": "Gestão e Negócios",
      "instituicao": "vale"
    }
  ];
  for (const dados of professores) {
    const id = await usuario(dados, 'PROFESSOR');
    await client.query(
      'INSERT INTO professores (usuario_id, cpf, departamento, instituicao_id, inicio_creditos) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (usuario_id) DO NOTHING',
      [id, dados.cpf, dados.departamento, idsInstituicoes[dados.instituicao], calendario().data]
    );
  }

  const empresas = [
    {
      "nome": "Café do Campus — Demo",
      "login": "cafe.demo",
      "cnpj": "90.000.001/0001-29",
      "descricao": "Cafés, lanches e combos para estudantes."
    },
    {
      "nome": "Papelaria Saber — Demo",
      "login": "papelaria.demo",
      "cnpj": "90.000.002/0001-73",
      "descricao": "Material escolar, cadernos e serviços de impressão."
    },
    {
      "nome": "Tecnologia Estudantil — Demo",
      "login": "tecnologia.demo",
      "cnpj": "90.000.003/0001-18",
      "descricao": "Acessórios de informática e oficinas de tecnologia."
    }
  ];
  const idsEmpresas = {};
  for (const dados of empresas) {
    const id = await usuario(dados, 'EMPRESA');
    idsEmpresas[dados.login] = id;
    await client.query(
      'INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES ($1, $2, $3) ON CONFLICT (usuario_id) DO NOTHING',
      [id, dados.cnpj, dados.descricao]
    );
  }

  const vantagens = [
    {
      "empresa": "cafe.demo",
      "nome": "Café com pão de queijo",
      "descricao": "Um café expresso e uma porção de pão de queijo para retirada no balcão.",
      "foto": "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600",
      "custo": 60
    },
    {
      "empresa": "cafe.demo",
      "nome": "Combo café da manhã",
      "descricao": "Um café, um sanduíche e uma fruta para começar o dia no campus.",
      "foto": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600",
      "custo": 120
    },
    {
      "empresa": "papelaria.demo",
      "nome": "Kit caderno e caneta",
      "descricao": "Um caderno universitário e uma caneta esferográfica, conforme disponibilidade na loja.",
      "foto": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600",
      "custo": 90
    },
    {
      "empresa": "papelaria.demo",
      "nome": "Impressão de 20 páginas",
      "descricao": "Impressão em preto e branco de até 20 páginas A4 de material acadêmico.",
      "foto": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600",
      "custo": 50
    },
    {
      "empresa": "tecnologia.demo",
      "nome": "Desconto de 10% em acessórios",
      "descricao": "Cupom de 10% de desconto em uma compra de acessórios de informática na loja física.",
      "foto": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
      "custo": 150
    },
    {
      "empresa": "tecnologia.demo",
      "nome": "Oficina de introdução à programação",
      "descricao": "Uma inscrição em oficina presencial de duas horas, com agendamento na loja.",
      "foto": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
      "custo": 250
    }
  ];
  for (const dados of vantagens) {
    const empresaId = idsEmpresas[dados.empresa];
    const existente = await client.query('SELECT id FROM vantagens WHERE empresa_id = $1 AND nome = $2', [empresaId, dados.nome]);
    if (existente.rowCount) continue;
    await client.query(
      'INSERT INTO vantagens (empresa_id, nome, descricao, foto_url, custo_moedas) VALUES ($1, $2, $3, $4, $5)',
      [empresaId, dados.nome, dados.descricao, dados.foto, dados.custo]
    );
  }
  // Usa o crédito semestral real e seu controle de duplicidade; alunos começam com zero.
  await creditarNoCliente(client);
}
