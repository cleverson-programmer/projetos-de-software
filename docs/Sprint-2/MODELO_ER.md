# Sistema de Moeda Estudantil - Modelo Entidade-Relacionamento (ER)
**Disciplina:** Laboratório de Projeto de Software - PUC Minas (2026/2)  
**Entrega:** Sprint 2 (Lab03S02)

---

## 1. Visão Geral

O presente Modelo Entidade-Relacionamento foi concebido a partir dos modelos gerados na Sprint 1 (Diagrama de Classes, Histórias de Usuário e Casos de Uso), visando atender à persistência de dados relacional com integridade, normalização (3FN) e suporte à herança das entidades de usuários.

Adotou-se a estratégia de **Herança com Tabela por Subclasse (JOINED)**:
- A tabela `usuarios` centraliza a autenticação, integridade de credenciais (login e e-mail únicos), hash de senha e data de criação/atualização.
- As tabelas filhas `alunos`, `professores` e `empresas_parceiras` utilizam como Chave Primária a própria Chave Estrangeira (`usuario_id -> usuarios.id`), contendo seus atributos especializados.

---

## 2. Diagrama Entidade-Relacionamento

![Diagrama Entidade-Relacionamento](./Diagrama%20ER.png)

---

## 3. Dicionário de Dados

### 3.1 `instituicoes_ensino`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Identificador único |
| `nome` | VARCHAR(255) | NOT NULL, UNIQUE | Nome da instituição participante |
| `endereco` | VARCHAR(255) | NOT NULL | Endereço do campus |

### 3.2 `usuarios`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Identificador do usuário |
| `nome` | VARCHAR(255) | NOT NULL | Nome completo ou razão social |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | E-mail para contato e login |
| `login` | VARCHAR(100) | NOT NULL, UNIQUE | Nome de usuário único no sistema |
| `senha_hash` | VARCHAR(255) | NOT NULL | Hash seguro da senha (PBKDF2) |
| `tipo` | VARCHAR(20) | NOT NULL | `ALUNO`, `PROFESSOR` ou `EMPRESA` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data de cadastro |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última atualização |

### 3.3 `alunos`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `usuario_id` | BIGINT | PK, FK -> `usuarios(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `cpf` | VARCHAR(14) | NOT NULL, UNIQUE | CPF do estudante (validado) |
| `rg` | VARCHAR(20) | NULL | Registro Geral (opcional, formato `XX-99.999.999`) |
| `endereco` | VARCHAR(255) | NOT NULL | Endereço residencial do aluno |
| `curso` | VARCHAR(100) | NOT NULL | Curso de graduação matriculado |
| `saldo_moedas` | INTEGER | NOT NULL, DEFAULT 0 | Saldo atual de moedas estudantis |
| `instituicao_id` | BIGINT | NOT NULL, FK -> `instituicoes_ensino(id)` | Instituição vinculada |

### 3.4 `empresas_parceiras`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `usuario_id` | BIGINT | PK, FK -> `usuarios(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `cnpj` | VARCHAR(18) | NOT NULL, UNIQUE | CNPJ da empresa parceira |
| `descricao` | TEXT | NULL | Descrição da atuação / parceria |

### 3.5 `professores`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `usuario_id` | BIGINT | PK, FK -> `usuarios(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `cpf` | VARCHAR(14) | NOT NULL, UNIQUE | CPF do professor |
| `departamento` | VARCHAR(100) | NOT NULL | Departamento docente |
| `saldo_moedas` | INTEGER | NOT NULL, DEFAULT 0 | Saldo acumulado semestral |
| `instituicao_id` | BIGINT | NOT NULL, FK -> `instituicoes_ensino(id)` | Instituição vinculada |

### 3.6 `vantagens`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Identificador da vantagem |
| `empresa_id` | BIGINT | NOT NULL, FK -> `empresas_parceiras(usuario_id)` | Empresa que oferece |
| `nome` | VARCHAR(150) | NOT NULL | Título da vantagem |
| `descricao` | TEXT | NOT NULL | Detalhes da vantagem/desconto |
| `foto_url` | VARCHAR(500) | NOT NULL | URL da foto do produto |
| `custo_moedas` | INTEGER | NOT NULL, CHECK > 0 | Custo em moedas virtuais |
| `ativa` | BOOLEAN | NOT NULL, DEFAULT TRUE | Status da vantagem |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Data de cadastro |

### 3.7 `transacoes`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | BIGSERIAL | PK | Identificador único da transação |
| `data_hora` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Data e hora da transação |
| `quantidade` | INTEGER | NOT NULL, CHECK > 0 | Quantidade de moedas movimentadas |
| `tipo` | VARCHAR(20) | NOT NULL | `TRANSFERENCIA`, `CREDITO` ou `RESGATE` |

### 3.8 `transferencias_moedas`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `transacao_id` | BIGINT | PK, FK -> `transacoes(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `professor_id` | BIGINT | NOT NULL, FK -> `professores(usuario_id)` | Professor remetente |
| `aluno_id` | BIGINT | NOT NULL, FK -> `alunos(usuario_id)` | Aluno destinatário |
| `motivo` | TEXT | NOT NULL | Motivo do reconhecimento (obrigatório) |

### 3.9 `creditos_semestrais`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `transacao_id` | BIGINT | PK, FK -> `transacoes(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `professor_id` | BIGINT | NOT NULL, FK -> `professores(usuario_id)` | Professor beneficiado |
| `semestre` | VARCHAR(20) | NOT NULL, UNIQUE(`professor_id`, `semestre`) | Semestre letivo de referência (ex.: `2026/2`) |

### 3.10 `resgates_vantagens`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `transacao_id` | BIGINT | PK, FK -> `transacoes(id)` ON DELETE CASCADE | Chave primária e estrangeira |
| `aluno_id` | BIGINT | NOT NULL, FK -> `alunos(usuario_id)` | Aluno que realizou o resgate |
| `vantagem_id` | BIGINT | NOT NULL, FK -> `vantagens(id)` | Vantagem resgatada |
| `codigo_cupom` | VARCHAR(50) | NOT NULL, UNIQUE | Código único gerado para conferência |

---

## 4. Estratégia de Acesso ao Banco de Dados e Alinhamento com a Sprint 2
- **Modelo ER:** Atende integralmente às entidades e regras levantadas na Sprint 1.
- **Padrão de Persistência (DAO):** Implementado através do **Padrão DAO (Data Access Object)** em `src/dao/` combinado às classes de domínio em `src/models/` (`Usuario`, `InstituicaoEnsino`, `Aluno` e `EmpresaParceira`), utilizando transações atômicas (`withTransaction`) para manter a consistência na herança `JOINED` entre a superclasse `usuarios` e suas especializações.
- **CRUDs da Sprint 2:** Foco nas entidades `instituicoes_ensino`, `usuarios`, `alunos` e `empresas_parceiras`.
