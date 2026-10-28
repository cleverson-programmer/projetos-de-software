-- ============================================================================
-- Sistema de Moeda Estudantil - Script DDL + Seed Inicial (PostgreSQL)
-- Disciplina: Laboratório de Projeto de Software - PUC Minas (Sprint 2)
-- ============================================================================

-- Limpeza opcional caso reexecutado manualmente no DBeaver
DROP TABLE IF EXISTS resgates_vantagens CASCADE;
DROP TABLE IF EXISTS creditos_semestrais CASCADE;
DROP TABLE IF EXISTS transferencias_moedas CASCADE;
DROP TABLE IF EXISTS transacoes CASCADE;
DROP TABLE IF EXISTS vantagens CASCADE;
DROP TABLE IF EXISTS empresas_parceiras CASCADE;
DROP TABLE IF EXISTS professores CASCADE;
DROP TABLE IF EXISTS alunos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS instituicoes_ensino CASCADE;

-- ============================================================================
-- 1. TABELAS PRINCIPAIS E ENTIDADES FORTES
-- ============================================================================

-- 1.1 Instituições de Ensino (pré-cadastradas no sistema)
CREATE TABLE instituicoes_ensino (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    endereco VARCHAR(255) NOT NULL
);

-- 1.2 Usuários (Superclasse - Estratégia JOINED / Tabela por Subclasse)
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ALUNO', 'PROFESSOR', 'EMPRESA')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. ESPECIALIZAÇÕES DE USUÁRIO (HERANÇA JOINED)
-- ============================================================================

-- 2.1 Alunos
CREATE TABLE alunos (
    usuario_id BIGINT PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(20) NULL,
    endereco VARCHAR(255) NOT NULL,
    curso VARCHAR(100) NOT NULL,
    saldo_moedas INTEGER NOT NULL DEFAULT 0 CHECK (saldo_moedas >= 0),
    instituicao_id BIGINT NOT NULL,
    CONSTRAINT fk_aluno_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_aluno_instituicao
        FOREIGN KEY (instituicao_id) REFERENCES instituicoes_ensino(id) ON DELETE RESTRICT
);

-- 2.2 Professores (pré-cadastrados via parceria com a instituição)
CREATE TABLE professores (
    usuario_id BIGINT PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    departamento VARCHAR(100) NOT NULL,
    saldo_moedas INTEGER NOT NULL DEFAULT 0 CHECK (saldo_moedas >= 0),
    instituicao_id BIGINT NOT NULL,
    CONSTRAINT fk_professor_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_professor_instituicao
        FOREIGN KEY (instituicao_id) REFERENCES instituicoes_ensino(id) ON DELETE RESTRICT
);

-- 2.3 Empresas Parceiras
CREATE TABLE empresas_parceiras (
    usuario_id BIGINT PRIMARY KEY,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    descricao TEXT,
    CONSTRAINT fk_empresa_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. VANTAGENS OFERECIDAS PELAS EMPRESAS PARCEIRAS
-- ============================================================================

CREATE TABLE vantagens (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL,
    foto_url VARCHAR(500) NOT NULL,
    custo_moedas INTEGER NOT NULL CHECK (custo_moedas > 0),
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vantagem_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas_parceiras(usuario_id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. TRANSAÇÕES E ESPECIALIZAÇÕES (HISTÓRICO / EXTRATO)
-- ============================================================================

-- 4.1 Transações (Superclasse)
CREATE TABLE transacoes (
    id BIGSERIAL PRIMARY KEY,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('TRANSFERENCIA', 'CREDITO', 'RESGATE'))
);

-- 4.2 Transferências de Moedas (Professor -> Aluno)
CREATE TABLE transferencias_moedas (
    transacao_id BIGINT PRIMARY KEY,
    professor_id BIGINT NOT NULL,
    aluno_id BIGINT NOT NULL,
    motivo TEXT NOT NULL,
    CONSTRAINT fk_transf_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_transf_professor
        FOREIGN KEY (professor_id) REFERENCES professores(usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_transf_aluno
        FOREIGN KEY (aluno_id) REFERENCES alunos(usuario_id) ON DELETE RESTRICT
);

-- 4.3 Créditos Semestrais (Sistema -> Professor, 1.000 moedas por semestre)
CREATE TABLE creditos_semestrais (
    transacao_id BIGINT PRIMARY KEY,
    professor_id BIGINT NOT NULL,
    semestre VARCHAR(20) NOT NULL,
    CONSTRAINT fk_credito_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_credito_professor
        FOREIGN KEY (professor_id) REFERENCES professores(usuario_id) ON DELETE CASCADE,
    CONSTRAINT uq_professor_semestre
        UNIQUE (professor_id, semestre)
);

-- 4.4 Resgates de Vantagens (Aluno -> Vantagem com geração de cupom)
CREATE TABLE resgates_vantagens (
    transacao_id BIGINT PRIMARY KEY,
    aluno_id BIGINT NOT NULL,
    vantagem_id BIGINT NOT NULL,
    codigo_cupom VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT fk_resgate_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_resgate_aluno
        FOREIGN KEY (aluno_id) REFERENCES alunos(usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_resgate_vantagem
        FOREIGN KEY (vantagem_id) REFERENCES vantagens(id) ON DELETE RESTRICT
);

-- ============================================================================
-- 5. ÍNDICES PARA PERFORMANCE DE CONSULTAS E EXTRATOS
-- ============================================================================
CREATE INDEX idx_alunos_instituicao ON alunos(instituicao_id);
CREATE INDEX idx_professores_instituicao ON professores(instituicao_id);
CREATE INDEX idx_vantagens_empresa ON vantagens(empresa_id);
CREATE INDEX idx_vantagens_ativa ON vantagens(ativa);
CREATE INDEX idx_transf_professor ON transferencias_moedas(professor_id);
CREATE INDEX idx_transf_aluno ON transferencias_moedas(aluno_id);
CREATE INDEX idx_resgates_aluno ON resgates_vantagens(aluno_id);
CREATE INDEX idx_resgates_vantagem ON resgates_vantagens(vantagem_id);

-- ============================================================================
-- 6. CARGA INICIAL DE DADOS (SEED PARA TESTES E VISUALIZAÇÃO NO DBEAVER)
-- ============================================================================

-- 6.1 Instituições de Ensino Pré-Cadastradas
INSERT INTO instituicoes_ensino (id, nome, endereco) VALUES
    (1, 'PUC Minas - Campus Coração Eucarístico', 'Av. Dom José Gaspar, 500 - Coração Eucarístico, Belo Horizonte - MG'),
    (2, 'PUC Minas - Unidade Praça da Liberdade', 'Av. Brasil, 2023 - Funcionários, Belo Horizonte - MG'),
    (3, 'Universidade Federal de Minas Gerais (UFMG)', 'Av. Pres. Antônio Carlos, 6627 - Pampulha, Belo Horizonte - MG'),
    (4, 'CEFET-MG - Campus Nova Suíça', 'Av. Amazonas, 5253 - Nova Suíça, Belo Horizonte - MG');

SELECT setval('instituicoes_ensino_id_seq', (SELECT MAX(id) FROM instituicoes_ensino));

-- 6.2 Usuários (Senha padrão de teste: "123456" em hash PBKDF2-SHA256, 600000 iterações)
INSERT INTO usuarios (id, nome, email, login, senha_hash, tipo) VALUES
    -- Professores pré-cadastrados
    (1, 'Profa. Milena Menezes Adão', 'milena.adao@pucminas.br', 'milena.adao', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'PROFESSOR'),
    (2, 'Prof. Marco Rodrigo Costa', 'marco.costa@pucminas.br', 'marco.costa', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'PROFESSOR'),
    -- Alunos
    (3, 'Kaio Silva', 'kaio.silva@sga.pucminas.br', 'kaio.silva', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'ALUNO'),
    (4, 'Rafael Lopes de Souza', 'rafael.lopes@sga.pucminas.br', 'rafael.lopes', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'ALUNO'),
    -- Empresas Parceiras
    (5, 'Cantina Universitária Gourmet', 'contato@cantinagourmet.com.br', 'cantina.gourmet', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'EMPRESA'),
    (6, 'Livraria & Papelaria TechBook', 'parceria@techbook.com.br', 'techbook', 'pbkdf2$600000$4944336b2db3bcbc90bb2b3723fa94af$ca7fd99fe4a353c90ef01d23e3fa8c58f6aad0c561f7a6fa82d73727699ec62ccf1560f1cf965743aa8ac5ffb3d273b373feabcc28d21a18e5f3c11a2938086d', 'EMPRESA');

SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios));

-- 6.3 Professores
INSERT INTO professores (usuario_id, cpf, departamento, saldo_moedas, instituicao_id) VALUES
    (1, '529.982.247-25', 'Engenharia de Software', 750, 1),
    (2, '111.444.777-35', 'Ciência da Computação', 1000, 2);

-- 6.4 Alunos
INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, saldo_moedas, instituicao_id) VALUES
    (3, '390.533.447-05', 'MG-12.345.678', 'Rua Padre Eustáquio, 1200 - Belo Horizonte, MG', 'Engenharia de Software', 150, 1),
    (4, '123.456.789-09', 'MG-87.654.321', 'Av. Contorno, 4500 - Belo Horizonte, MG', 'Engenharia de Software', 0, 1);

-- 6.5 Empresas Parceiras
INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES
    (5, '12.345.678/0001-95', 'Restaurante e lanchonete universitária com descontos especiais em refeições e lanches no campus.'),
    (6, '11.222.333/0001-81', 'Livraria técnica, cursos online e materiais de informática e papelaria para estudantes.');

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

