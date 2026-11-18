-- Somente demonstração; executado por seed.mjs apenas em banco vazio.
INSERT INTO instituicoes_ensino (id, nome, endereco) VALUES
    (1, 'PUC Minas - Campus Coração Eucarístico', 'Av. Dom José Gaspar, 500 - Coração Eucarístico, Belo Horizonte - MG'),
    (2, 'PUC Minas - Unidade Praça da Liberdade', 'Av. Brasil, 2023 - Funcionários, Belo Horizonte - MG'),
    (3, 'Universidade Federal de Minas Gerais (UFMG)', 'Av. Pres. Antônio Carlos, 6627 - Pampulha, Belo Horizonte - MG'),
    (4, 'CEFET-MG - Campus Nova Suíça', 'Av. Amazonas, 5253 - Nova Suíça, Belo Horizonte - MG');

SELECT setval('instituicoes_ensino_id_seq', (SELECT MAX(id) FROM instituicoes_ensino));

-- 6.2 Usuários (Senha padrão de teste: "123456" em hash BCrypt)
INSERT INTO usuarios (id, nome, email, login, senha_hash, tipo) VALUES
    -- Professores pré-cadastrados
    (1, 'Profa. Milena Menezes Adão', 'milena.adao@pucminas.br', 'milena.adao', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'PROFESSOR'),
    (2, 'Prof. Marco Rodrigo Costa', 'marco.costa@pucminas.br', 'marco.costa', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'PROFESSOR'),
    -- Alunos
    (3, 'Kaio Silva', 'kaio.silva@sga.pucminas.br', 'kaio.silva', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'ALUNO'),
    (4, 'Rafael Lopes de Souza', 'rafael.lopes@sga.pucminas.br', 'rafael.lopes', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'ALUNO'),
    -- Empresas Parceiras
    (5, 'Cantina Universitária Gourmet', 'contato@cantinagourmet.com.br', 'cantina.gourmet', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'EMPRESA'),
    (6, 'Livraria & Papelaria TechBook', 'parceria@techbook.com.br', 'techbook', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'EMPRESA');

SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));

-- 6.3 Professores
INSERT INTO professores (usuario_id, cpf, departamento, saldo_moedas, instituicao_id) VALUES
    (1, '111.222.333-44', 'Engenharia de Software', 750, 1),
    (2, '222.333.444-55', 'Ciência da Computação', 1000, 2);

-- 6.4 Alunos
INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, saldo_moedas, instituicao_id) VALUES
    (3, '333.444.555-66', 'MG-12.345.678', 'Rua Padre Eustáquio, 1200 - Belo Horizonte, MG', 'Engenharia de Software', 150, 1),
    (4, '444.555.666-77', 'MG-87.654.321', 'Av. Contorno, 4500 - Belo Horizonte, MG', 'Engenharia de Software', 0, 1);

-- 6.5 Empresas Parceiras
INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES
    (5, '12.345.678/0001-90', 'Restaurante e lanchonete universitária com descontos especiais em refeições e lanches no campus.'),
    (6, '98.765.432/0001-10', 'Livraria técnica, cursos online e materiais de informática e papelaria para estudantes.');

-- 6.6 Vantagens
INSERT INTO vantagens (id, empresa_id, nome, descricao, foto_url, custo_moedas, ativa) VALUES
    (1, 5, 'Combo Lanche + Suco Natural', 'Vale 1 hambúrguer artesanal + suco natural de 500ml na Cantina Universitária.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', 100, TRUE),
    (2, 5, '50% de Desconto no Almoço Executivo', 'Desconto de 50% no buffet livre ou prato executivo de segunda a sexta-feira.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600', 150, TRUE),
    (3, 6, 'Voucher R$ 50 em Livros de Tecnologia', 'Cupom de R$ 50,00 para compra de qualquer livro de Engenharia de Software ou Programação.', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600', 300, TRUE);

SELECT setval('vantagens_id_seq', (SELECT MAX(id) FROM vantagens));

-- 6.7 Transações de Exemplo (Créditos Semestrais, Transferência e Resgate)
INSERT INTO transacoes (id, data_hora, quantidade, tipo) VALUES
    (1, '2026-08-01 08:00:00', 1000, 'CREDITO'),
    (2, '2026-08-01 08:00:00', 1000, 'CREDITO'),
    (3, '2026-10-15 19:30:00', 250, 'TRANSFERENCIA'),
    (4, '2026-10-18 12:15:00', 100, 'RESGATE');

SELECT setval('transacoes_id_seq', (SELECT MAX(id) FROM transacoes));

INSERT INTO creditos_semestrais (transacao_id, professor_id, semestre) VALUES
    (1, 1, '2026/2'),
    (2, 2, '2026/2');

INSERT INTO transferencias_moedas (transacao_id, professor_id, aluno_id, motivo) VALUES
    (3, 1, 3, 'Excelente participação nas entregas de modelagem UML da Sprint 1.');

INSERT INTO resgates_vantagens (transacao_id, aluno_id, vantagem_id, codigo_cupom) VALUES
    (4, 3, 1, 'CUPOM-2026-A8F9K2');

