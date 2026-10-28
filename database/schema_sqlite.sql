-- ============================================================================
-- Sistema de Moeda Estudantil - Script DDL + Seed Inicial (SQLite)
-- Disciplina: Laboratório de Projeto de Software - PUC Minas (Sprint 2)
-- ============================================================================

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS resgates_vantagens;
DROP TABLE IF EXISTS creditos_semestrais;
DROP TABLE IF EXISTS transferencias_moedas;
DROP TABLE IF EXISTS transacoes;
DROP TABLE IF EXISTS vantagens;
DROP TABLE IF EXISTS empresas_parceiras;
DROP TABLE IF EXISTS professores;
DROP TABLE IF EXISTS alunos;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS instituicoes_ensino;

-- 1.1 Instituições de Ensino (pré-cadastradas no sistema)
CREATE TABLE instituicoes_ensino (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(255) NOT NULL UNIQUE,
    endereco VARCHAR(255) NOT NULL
);

-- 1.2 Usuários (Superclasse - Estratégia JOINED / Tabela por Subclasse)
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ALUNO', 'PROFESSOR', 'EMPRESA')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2.1 Alunos
CREATE TABLE alunos (
    usuario_id INTEGER PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(20) NULL,
    endereco VARCHAR(255) NOT NULL,
    curso VARCHAR(100) NOT NULL,
    saldo_moedas INTEGER NOT NULL DEFAULT 0 CHECK (saldo_moedas >= 0),
    instituicao_id INTEGER NOT NULL,
    CONSTRAINT fk_aluno_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_aluno_instituicao
        FOREIGN KEY (instituicao_id) REFERENCES instituicoes_ensino(id) ON DELETE RESTRICT
);

-- 2.2 Professores
CREATE TABLE professores (
    usuario_id INTEGER PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    departamento VARCHAR(100) NOT NULL,
    saldo_moedas INTEGER NOT NULL DEFAULT 0 CHECK (saldo_moedas >= 0),
    instituicao_id INTEGER NOT NULL,
    CONSTRAINT fk_professor_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_professor_instituicao
        FOREIGN KEY (instituicao_id) REFERENCES instituicoes_ensino(id) ON DELETE RESTRICT
);

-- 2.3 Empresas Parceiras
CREATE TABLE empresas_parceiras (
    usuario_id INTEGER PRIMARY KEY,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    descricao TEXT,
    CONSTRAINT fk_empresa_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 3. Vantagens
CREATE TABLE vantagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL,
    foto_url VARCHAR(500) NOT NULL,
    custo_moedas INTEGER NOT NULL CHECK (custo_moedas > 0),
    ativa BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vantagem_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas_parceiras(usuario_id) ON DELETE CASCADE
);

-- 4.1 Transações (Superclasse)
CREATE TABLE transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('TRANSFERENCIA', 'CREDITO', 'RESGATE'))
);

-- 4.2 Transferências de Moedas
CREATE TABLE transferencias_moedas (
    transacao_id INTEGER PRIMARY KEY,
    professor_id INTEGER NOT NULL,
    aluno_id INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    CONSTRAINT fk_transf_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_transf_professor
        FOREIGN KEY (professor_id) REFERENCES professores(usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_transf_aluno
        FOREIGN KEY (aluno_id) REFERENCES alunos(usuario_id) ON DELETE RESTRICT
);

-- 4.3 Créditos Semestrais
CREATE TABLE creditos_semestrais (
    transacao_id INTEGER PRIMARY KEY,
    professor_id INTEGER NOT NULL,
    semestre VARCHAR(20) NOT NULL,
    CONSTRAINT fk_credito_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_credito_professor
        FOREIGN KEY (professor_id) REFERENCES professores(usuario_id) ON DELETE CASCADE,
    CONSTRAINT uq_professor_semestre
        UNIQUE (professor_id, semestre)
);

-- 4.4 Resgates de Vantagens
CREATE TABLE resgates_vantagens (
    transacao_id INTEGER PRIMARY KEY,
    aluno_id INTEGER NOT NULL,
    vantagem_id INTEGER NOT NULL,
    codigo_cupom VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT fk_resgate_transacao
        FOREIGN KEY (transacao_id) REFERENCES transacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_resgate_aluno
        FOREIGN KEY (aluno_id) REFERENCES alunos(usuario_id) ON DELETE RESTRICT,
    CONSTRAINT fk_resgate_vantagem
        FOREIGN KEY (vantagem_id) REFERENCES vantagens(id) ON DELETE RESTRICT
);

-- Índices
CREATE INDEX idx_alunos_instituicao ON alunos(instituicao_id);
CREATE INDEX idx_professores_instituicao ON professores(instituicao_id);
CREATE INDEX idx_vantagens_empresa ON vantagens(empresa_id);
CREATE INDEX idx_vantagens_ativa ON vantagens(ativa);
CREATE INDEX idx_transf_professor ON transferencias_moedas(professor_id);
CREATE INDEX idx_transf_aluno ON transferencias_moedas(aluno_id);
CREATE INDEX idx_resgates_aluno ON resgates_vantagens(aluno_id);
CREATE INDEX idx_resgates_vantagem ON resgates_vantagens(vantagem_id);

-- Seed Inicial
INSERT INTO instituicoes_ensino (id, nome, endereco) VALUES
    (1, 'PUC Minas - Campus Coração Eucarístico', 'Av. Dom José Gaspar, 500 - Coração Eucarístico, Belo Horizonte - MG'),
    (2, 'PUC Minas - Unidade Praça da Liberdade', 'Av. Brasil, 2023 - Funcionários, Belo Horizonte - MG'),
    (3, 'Universidade Federal de Minas Gerais (UFMG)', 'Av. Pres. Antônio Carlos, 6627 - Pampulha, Belo Horizonte - MG'),
    (4, 'CEFET-MG - Campus Nova Suíça', 'Av. Amazonas, 5253 - Nova Suíça, Belo Horizonte - MG');

INSERT INTO usuarios (id, nome, email, login, senha_hash, tipo) VALUES
    (1, 'Profa. Milena Menezes Adão', 'milena.adao@pucminas.br', 'milena.adao', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'PROFESSOR'),
    (2, 'Prof. Marco Rodrigo Costa', 'marco.costa@pucminas.br', 'marco.costa', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'PROFESSOR'),
    (3, 'Kaio Silva', 'kaio.silva@sga.pucminas.br', 'kaio.silva', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'ALUNO'),
    (4, 'Rafael Lopes de Souza', 'rafael.lopes@sga.pucminas.br', 'rafael.lopes', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'ALUNO'),
    (5, 'Cantina Universitária Gourmet', 'contato@cantinagourmet.com.br', 'cantina.gourmet', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'EMPRESA'),
    (6, 'Livraria & Papelaria TechBook', 'parceria@techbook.com.br', 'techbook', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', 'EMPRESA');

INSERT INTO professores (usuario_id, cpf, departamento, saldo_moedas, instituicao_id) VALUES
    (1, '529.982.247-25', 'Engenharia de Software', 750, 1),
    (2, '111.444.777-35', 'Ciência da Computação', 1000, 2);

INSERT INTO alunos (usuario_id, cpf, rg, endereco, curso, saldo_moedas, instituicao_id) VALUES
    (3, '390.533.447-05', 'MG-12.345.678', 'Rua Padre Eustáquio, 1200 - Belo Horizonte, MG', 'Engenharia de Software', 150, 1),
    (4, '123.456.789-09', 'MG-87.654.321', 'Av. Contorno, 4500 - Belo Horizonte, MG', 'Engenharia de Software', 0, 1);

INSERT INTO empresas_parceiras (usuario_id, cnpj, descricao) VALUES
    (5, '12.345.678/0001-95', 'Restaurante e lanchonete universitária com descontos especiais em refeições e lanches no campus.'),
    (6, '11.222.333/0001-81', 'Livraria técnica, cursos online e materiais de informática e papelaria para estudantes.');

INSERT INTO vantagens (id, empresa_id, nome, descricao, foto_url, custo_moedas, ativa) VALUES
    (1, 5, 'Combo Lanche + Suco Natural', 'Vale 1 hambúrguer artesanal + suco natural de 500ml na Cantina Universitária.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', 100, 1),
    (2, 5, '50% de Desconto no Almoço Executivo', 'Desconto de 50% no buffet livre ou prato executivo de segunda a sexta-feira.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600', 150, 1),
    (3, 6, 'Voucher R$ 50 em Livros de Tecnologia', 'Cupom de R$ 50,00 para compra de qualquer livro de Engenharia de Software ou Programação.', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600', 300, 1);

INSERT INTO transacoes (id, data_hora, quantidade, tipo) VALUES
    (1, '2026-08-01 08:00:00', 1000, 'CREDITO'),
    (2, '2026-08-01 08:00:00', 1000, 'CREDITO'),
    (3, '2026-10-15 19:30:00', 250, 'TRANSFERENCIA'),
    (4, '2026-10-18 12:15:00', 100, 'RESGATE');

INSERT INTO creditos_semestrais (transacao_id, professor_id, semestre) VALUES
    (1, 1, '2026/2'),
    (2, 2, '2026/2');

INSERT INTO transferencias_moedas (transacao_id, professor_id, aluno_id, motivo) VALUES
    (3, 1, 3, 'Excelente participação nas entregas de modelagem UML da Sprint 1.');

INSERT INTO resgates_vantagens (transacao_id, aluno_id, vantagem_id, codigo_cupom) VALUES
    (4, 3, 1, 'CUPOM-2026-A8F9K2');

