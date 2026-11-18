-- Os timestamps antigos eram gravados em UTC; os novos passam a manter o fuso.
ALTER TABLE usuarios ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE usuarios ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE transacoes ALTER COLUMN data_hora TYPE TIMESTAMPTZ USING data_hora AT TIME ZONE 'UTC';
ALTER TABLE vantagens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE professores ADD COLUMN inicio_creditos DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date);
UPDATE professores p SET inicio_creditos = (u.created_at AT TIME ZONE 'America/Sao_Paulo')::date FROM usuarios u WHERE u.id = p.usuario_id;

-- Dados antigos não são inventados; novas inserções/atualizações exigem RG.
ALTER TABLE alunos ADD CONSTRAINT alunos_rg_obrigatorio CHECK (rg IS NOT NULL AND length(btrim(rg)) >= 4) NOT VALID;
ALTER TABLE transferencias_moedas ADD CONSTRAINT transferencias_motivo_obrigatorio CHECK (length(btrim(motivo)) > 0) NOT VALID;
ALTER TABLE vantagens ADD CONSTRAINT vantagens_descricao_obrigatoria CHECK (length(btrim(descricao)) > 0) NOT VALID;
ALTER TABLE vantagens ADD CONSTRAINT vantagens_foto_obrigatoria CHECK (length(btrim(foto_url)) > 0) NOT VALID;
CREATE UNIQUE INDEX usuarios_email_normalizado ON usuarios (lower(email));
CREATE UNIQUE INDEX usuarios_login_normalizado ON usuarios (lower(login));

CREATE TABLE sessoes (
    token_hash CHAR(64) PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_em TIMESTAMPTZ NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessoes_usuario_idx ON sessoes(usuario_id);
CREATE INDEX sessoes_expiracao_idx ON sessoes(expira_em);

CREATE TABLE operacoes_idempotentes (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    chave UUID NOT NULL,
    acao VARCHAR(30) NOT NULL,
    assinatura CHAR(64) NOT NULL,
    resposta JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, chave)
);

CREATE TABLE fotos_vantagens (
    id UUID PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas_parceiras(usuario_id),
    conteudo BYTEA NOT NULL CHECK (octet_length(conteudo) BETWEEN 1 AND 2097152),
    mime VARCHAR(30) NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resgates_vantagens ADD COLUMN vantagem_nome VARCHAR(150);
ALTER TABLE resgates_vantagens ADD COLUMN empresa_nome VARCHAR(255);
ALTER TABLE resgates_vantagens ADD COLUMN confirmado_em TIMESTAMPTZ;
ALTER TABLE resgates_vantagens ADD COLUMN confirmado_por BIGINT REFERENCES usuarios(id);
ALTER TABLE resgates_vantagens ADD COLUMN ultimo_reenvio_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE emails_pendentes (
    id BIGSERIAL PRIMARY KEY,
    transacao_id BIGINT NOT NULL REFERENCES transacoes(id),
    chave VARCHAR(120) NOT NULL UNIQUE,
    destinatario VARCHAR(255) NOT NULL,
    assunto VARCHAR(255) NOT NULL,
    texto TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ENVIADO')),
    tentativas INTEGER NOT NULL DEFAULT 0,
    disponivel_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processando_ate TIMESTAMPTZ,
    ultimo_erro VARCHAR(100),
    enviado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX emails_pendentes_busca_idx ON emails_pendentes(disponivel_em, id) WHERE status = 'PENDENTE';
CREATE INDEX emails_transacao_idx ON emails_pendentes(transacao_id);
CREATE INDEX transferencias_professor_extrato ON transferencias_moedas(professor_id, transacao_id);
CREATE INDEX transferencias_aluno_extrato ON transferencias_moedas(aluno_id, transacao_id);
CREATE INDEX resgates_aluno_extrato ON resgates_vantagens(aluno_id, transacao_id);
