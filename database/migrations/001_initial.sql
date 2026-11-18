-- Estrutura inicial PostgreSQL. Não remove nem repovoa dados existentes.
CREATE TABLE IF NOT EXISTS instituicoes_ensino (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    endereco VARCHAR(255) NOT NULL
);

-- 1.2 Usuários (Superclasse - Estratégia JOINED / Tabela por Subclasse)
CREATE TABLE IF NOT EXISTS usuarios (
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
CREATE TABLE IF NOT EXISTS alunos (
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
CREATE TABLE IF NOT EXISTS professores (
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
CREATE TABLE IF NOT EXISTS empresas_parceiras (
    usuario_id BIGINT PRIMARY KEY,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    descricao TEXT,
    CONSTRAINT fk_empresa_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. VANTAGENS OFERECIDAS PELAS EMPRESAS PARCEIRAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vantagens (
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
CREATE TABLE IF NOT EXISTS transacoes (
    id BIGSERIAL PRIMARY KEY,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('TRANSFERENCIA', 'CREDITO', 'RESGATE'))
);

-- 4.2 Transferências de Moedas (Professor -> Aluno)
CREATE TABLE IF NOT EXISTS transferencias_moedas (
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
CREATE TABLE IF NOT EXISTS creditos_semestrais (
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
CREATE TABLE IF NOT EXISTS resgates_vantagens (
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
CREATE INDEX IF NOT EXISTS idx_alunos_instituicao ON alunos(instituicao_id);
CREATE INDEX IF NOT EXISTS idx_professores_instituicao ON professores(instituicao_id);
CREATE INDEX IF NOT EXISTS idx_vantagens_empresa ON vantagens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vantagens_ativa ON vantagens(ativa);
CREATE INDEX IF NOT EXISTS idx_transf_professor ON transferencias_moedas(professor_id);
CREATE INDEX IF NOT EXISTS idx_transf_aluno ON transferencias_moedas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_resgates_aluno ON resgates_vantagens(aluno_id);
CREATE INDEX IF NOT EXISTS idx_resgates_vantagem ON resgates_vantagens(vantagem_id);

-- ============================================================================
