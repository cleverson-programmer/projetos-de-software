import { Usuario } from '../../src/models/Usuario.js';
import { password, email as validateEmail } from '../../src/utils/validation.js';
import { calendario, creditarNoCliente } from '../../src/services/CreditoService.js';

export async function up(client) {
  const instituicoes = [
    ['PUC Minas - Campus Coração Eucarístico', 'Av. Dom José Gaspar, 500 - Belo Horizonte/MG'],
    ['Universidade Federal de Minas Gerais (UFMG)', 'Av. Antônio Carlos, 6627 - Belo Horizonte/MG'],
    ['CEFET-MG - Campus Nova Suíça', 'Av. Amazonas, 5253 - Belo Horizonte/MG'],
  ];
  for (const [nome, endereco] of instituicoes) {
    await client.query('INSERT INTO instituicoes_ensino (nome, endereco) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING', [nome, endereco]);
  }
  const instituicao = (await client.query('SELECT id FROM instituicoes_ensino WHERE nome = $1', [instituicoes[0][0]])).rows[0].id;

  async function usuario(nome, email, login, senha, tipo) {
    const result = await client.query(
      'INSERT INTO usuarios (nome, email, login, senha_hash, tipo) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id, tipo',
      [nome, validateEmail(email), login, Usuario.gerarHashSenha(password(senha)), tipo]
    );
    const row = result.rows[0] || (await client.query('SELECT id, tipo FROM usuarios WHERE lower(login) = $1', [login])).rows[0];
    if (!row) throw new Error('Email da conta inicial já está associado a outro login: ' + login);
    if (row.tipo !== tipo) throw new Error('Login inicial já pertence a outro perfil: ' + login);
    return row.id;
  }
  const aluno = await usuario('Aluno Demonstração', process.env.DEFAULT_ALUNO_EMAIL || 'aluno.demo@example.test', 'aluno.demo', process.env.DEFAULT_ALUNO_PASSWORD || 'Aluno@123456', 'ALUNO');
  await client.query(
    'INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, instituicao_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (usuario_id) DO NOTHING',
    [aluno, '529.982.247-25', 'MG-12.345.678', 'Rua Demonstração, 100 - Belo Horizonte/MG', 'Engenharia de Software', instituicao]
  );
  const professor = await usuario('Professor Demonstração', process.env.DEFAULT_PROFESSOR_EMAIL || 'professor.demo@example.test', 'professor.demo', process.env.DEFAULT_PROFESSOR_PASSWORD || 'Professor@123456', 'PROFESSOR');
  await client.query(
    'INSERT INTO professores (usuario_id, cpf, departamento, instituicao_id, inicio_creditos) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (usuario_id) DO NOTHING',
    [professor, '111.444.777-35', 'Engenharia de Software', instituicao, calendario().data]
  );
  const empresa = await usuario('Cantina Universitária Demo', process.env.DEFAULT_EMPRESA_EMAIL || 'cantina.demo@example.test', 'empresa.demo', process.env.DEFAULT_EMPRESA_PASSWORD || 'Empresa@123456', 'EMPRESA');
  await client.query('INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES ($1, $2, $3) ON CONFLICT (usuario_id) DO NOTHING',
    [empresa, '11.222.333/0001-81', 'Lanches, refeições e benefícios para estudantes.']);
  const livraria = await usuario('Livraria Universitária Demo', process.env.DEFAULT_LIVRARIA_EMAIL || 'livraria.demo@example.test', 'livraria.demo', process.env.DEFAULT_EMPRESA_PASSWORD || 'Empresa@123456', 'EMPRESA');
  await client.query('INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES ($1, $2, $3) ON CONFLICT (usuario_id) DO NOTHING',
    [livraria, '04.252.011/0001-10', 'Livros e materiais de estudo.']);

  for (const data of [
    [empresa, 'Combo de lanche', 'Um lanche acompanhado de suco na cantina.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', 100],
    [livraria, 'Desconto em livros', 'Cupom de desconto em livros de tecnologia na livraria.', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600', 200],
  ]) {
    // Os parâmetros reutilizados no SELECT e no filtro precisam do mesmo tipo explícito.
    await client.query(`
      INSERT INTO vantagens (empresa_id, nome, descricao, foto_url, custo_moedas)
      SELECT $1::bigint, $2::varchar(150), $3::text, $4::varchar(500), $5::integer
      WHERE NOT EXISTS (
        SELECT 1 FROM vantagens WHERE empresa_id = $1::bigint AND nome = $2::varchar(150)
      )
    `, data);
  }
  await creditarNoCliente(client);
}
