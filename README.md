# 🪙 Sistema de Moeda Estudantil

**Disciplina:** Laboratório de Projeto de Software — PUC Minas (2026/2)  
**Professora:** Profa. Milena Menezes Adão  

---

## 📋 Sobre o Projeto

Sistema para estimular o reconhecimento do mérito estudantil através de uma moeda virtual distribuída por professores aos seus alunos e trocada por produtos e descontos em empresas parceiras.

---

## 🗂️ Entregas por Sprint

### Sprint 1 (`Lab03S01`)
Documentação e modelagem UML disponíveis em [`docs/Sprint 1/`](./docs/Sprint%201/):
- Diagrama de Casos de Uso
- Histórias do Usuário
- Diagrama de Classes
- Diagrama de Componentes

### Sprint 2 (`Lab03S02`)
- **Modelo Entidade-Relacionamento (ER):** [`docs/Sprint-2/MODELO_ER.md`](./docs/Sprint-2/MODELO_ER.md) e [`docs/Sprint-2/Diagrama ER.png`](./docs/Sprint-2/Diagrama%20ER.png).
- **Banco de Dados Relacional:** scripts SQL e banco pré-populado em [`database/`](./database/) (`moeda_estudantil.db` para SQLite e `init_postgres.sql` para PostgreSQL).
- **Padrão DAO:** [`src/dao/`](./src/dao/) e [`src/models/`](./src/models/), com transações atômicas.

### Sprint 3 (`Lab03S03`) — Versão Atual
- **Autenticação por token** (login, senha e perfil) em todas as rotas, exceto login e cadastros públicos de aluno e empresa.
- **Professores pré-cadastrados** (nome, CPF, departamento e instituição), com importação por arquivo JSON.
- **Crédito semestral** de 1.000 moedas por professor, acumulativo e sem duplicidade no mesmo semestre.
- **Envio de moedas** do professor ao aluno, com saldo suficiente e motivo obrigatório.
- **Vantagens** cadastradas pelas empresas (nome, descrição, foto por URL e custo em moedas) e **resgate** pelo aluno, com código de cupom.
- **E-mails** (nodemailer): aviso ao aluno que recebe moedas, cupom ao aluno e conferência ao parceiro, ambos com o mesmo código.
- **Extrato** de professor, aluno e empresa.
- **Validação dos dígitos** de CPF e CNPJ.
- **Front-end** em [`public/`](./public/) com telas por perfil (aluno, professor e empresa).
- **Arquitetura MVC + Service + DAO:** [`src/controllers/`](./src/controllers/), [`src/services/`](./src/services/), [`src/dao/`](./src/dao/), [`src/models/`](./src/models/), rotas em [`src/routes.js`](./src/routes.js) e servidor em [`src/server.js`](./src/server.js).

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** v22.5+ (usa o módulo nativo `node:sqlite`).
- Dependência npm: `nodemailer` (envio de e-mails).

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente (opcional)
Copie [`.env.example`](./.env.example) para `.env` na raiz do projeto e ajuste os valores. Variáveis já definidas no ambiente do sistema têm prioridade sobre o `.env`. Sem `.env`, o servidor sobe com os padrões abaixo.

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta HTTP do servidor | `3000` |
| `DB_PATH` | Arquivo do banco SQLite (relativo à raiz ou absoluto) | `database/moeda_estudantil.db` |
| `AUTH_SECRET` | Segredo que assina os tokens de login | gerado a cada início (os logins caem ao reiniciar; o servidor avisa no console) |
| `SMTP_HOST` | Servidor SMTP. Vazio = e-mail simulado | vazio |
| `SMTP_PORT` | Porta SMTP | `587` |
| `SMTP_SECURE` | TLS direto (`true`/`false`) | `true` só se a porta for 465 |
| `SMTP_USER` / `SMTP_PASS` | Credenciais SMTP (deixe `SMTP_USER` vazio se não houver autenticação) | vazio |
| `MAIL_FROM` | Remetente dos e-mails | `Moeda Estudantil <nao-responder@exemplo.com>` |

### 3. Iniciar o servidor (Back-end + Front-end)
```bash
npm start
```
Acesse no navegador: **`http://localhost:3000`**

Ao subir, o servidor abre o banco (aplica o schema em banco novo e migra as senhas do seed) e executa o crédito semestral pendente.

### 4. Rodar os testes
Os testes não usam framework; são scripts com `node:assert`. Sem `DB_PATH`, eles trabalham numa cópia temporária do banco, que é apagada ao final.
```bash
npm run test:dao
npm run test:servicos
```

### 5. Recriar o banco (opcional)
```bash
npm run db:init
```
> ⚠️ **Atenção:** este comando apaga e recria o arquivo do banco (`DB_PATH` ou `database/moeda_estudantil.db`) com os dados iniciais. Todos os dados cadastrados são perdidos.

---

## 👤 Contas de Exemplo (seed)

Todas usam a senha **`123456`**.

| Perfil | Login |
|---|---|
| Professor | `milena.adao`, `marco.costa` |
| Aluno | `kaio.silva`, `rafael.lopes` |
| Empresa | `cantina.gourmet`, `techbook` |

As senhas do seed ficam armazenadas com PBKDF2. Bancos antigos, com o hash legado do seed, são migrados automaticamente na abertura do banco, sem alterar a senha de login.

---

## 🔌 API REST

Todas as rotas usam JSON. Exceto as marcadas como públicas, exigem o cabeçalho `Authorization: Bearer <token>`, obtido em `POST /api/auth/login`. Erros voltam como `{ "error": "mensagem" }`. As rotas estão definidas em [`src/routes.js`](./src/routes.js).

| Método e rota | Perfil | Descrição |
|---|---|---|
| `POST /api/auth/login` | público | Login; devolve `token` e `usuario` |
| `GET /api/auth/me` | qualquer autenticado | Usuário da sessão |
| `GET /api/instituicoes` | público | Lista as instituições de ensino |
| `POST /api/alunos` | público | Cadastro de aluno |
| `GET /api/alunos/destinatarios` | PROFESSOR | Alunos que podem receber moedas |
| `GET /api/alunos/:id` | ALUNO (próprio) | Consulta o próprio cadastro |
| `PUT /api/alunos/:id` | ALUNO (próprio) | Atualiza o próprio cadastro |
| `DELETE /api/alunos/:id` | ALUNO (próprio) | Exclui a própria conta (409 se houver histórico) |
| `POST /api/empresas` | público | Cadastro de empresa parceira |
| `GET /api/empresas/:id` | EMPRESA (própria) | Consulta o próprio cadastro |
| `PUT /api/empresas/:id` | EMPRESA (própria) | Atualiza o próprio cadastro |
| `DELETE /api/empresas/:id` | EMPRESA (própria) | Exclui a própria conta (409 se alguma vantagem tiver resgate) |
| `GET /api/professores/me` | PROFESSOR | Dados e saldo do professor |
| `GET /api/vantagens` | ALUNO | Vantagens ativas (filtro opcional `?empresaId=`) |
| `GET /api/vantagens/minhas` | EMPRESA | Vantagens da empresa, ativas e inativas |
| `POST /api/vantagens` | EMPRESA | Cadastra vantagem (`nome`, `descricao`, `fotoUrl`, `custoMoedas`) |
| `PUT /api/vantagens/:id` | EMPRESA (dona) | Edita vantagem |
| `PATCH /api/vantagens/:id/ativa` | EMPRESA (dona) | Ativa ou desativa (`{ "ativa": true }`) |
| `DELETE /api/vantagens/:id` | EMPRESA (dona) | Exclui vantagem (409 se já houve resgate; desative-a) |
| `POST /api/vantagens/:id/resgatar` | ALUNO | Resgata a vantagem: debita o saldo, gera o código e envia os e-mails |
| `POST /api/transacoes/enviar-moedas` | PROFESSOR | Envia moedas (`alunoId`, `quantidade`, `motivo` obrigatório) |
| `GET /api/extrato` | qualquer autenticado | Saldo e transações do perfil logado (a empresa vê só os resgates recebidos) |
| `POST /api/creditos-semestrais/executar` | PROFESSOR | Executa o crédito do semestre para todos os professores pendentes (idempotente) |

Não há listagem pública de alunos ou empresas.

---

## 💰 Crédito Semestral

Cada professor recebe **1.000 moedas por semestre**, somadas ao saldo atual. Semestres: `AAAA/1` (janeiro a junho) e `AAAA/2` (julho a dezembro). Um professor nunca é creditado duas vezes no mesmo semestre.

O crédito acontece de três formas:
- **Automática:** quando o servidor sobe e a cada hora enquanto ele estiver ligado (cobre a virada do semestre). Na subida, o console mostra `[Crédito semestral] AAAA/S: ...`.
- **Manual:** botão "Executar crédito semestral" no painel do professor, ou `POST /api/creditos-semestrais/executar`.
- **Na importação de professores** (próxima seção).

---

## 🧑‍🏫 Importar Professores

As instituições enviam a lista de professores na parceria. Para cadastrá-los:
```bash
npm run professores:importar -- database/professores_exemplo.json
```
O arquivo é um array JSON. Campos obrigatórios: `nome`, `email`, `login`, `departamento`, `cpf` (CPF válido) e `instituicaoId` (id de uma instituição pré-cadastrada). Opcional: `senha`; sem ela, o sistema gera uma senha inicial.
```json
[
  {
    "nome": "Prof. Henrique Duarte Lima",
    "email": "henrique.lima@pucminas.br",
    "login": "henrique.lima",
    "cpf": "987.654.321-00",
    "departamento": "Sistemas de Informação",
    "instituicaoId": 1
  }
]
```
Um exemplo completo está em [`database/professores_exemplo.json`](./database/professores_exemplo.json). O comando imprime o login e a senha inicial de cada professor importado e `[ERRO]` para os itens que falharem (os itens válidos são importados mesmo assim; o comando termina com código 1 se algum falhar). Os professores importados já recebem o crédito do semestre atual.

---

## ✉️ E-mails

Os e-mails são enviados com nodemailer quando `SMTP_HOST` está configurado. Sem `SMTP_HOST`, o sistema roda em **modo simulado**: nada é enviado e cada e-mail aparece no console como uma linha `[EMAIL-SIMULADO] {json}` (com `to`, `subject` e `text`).

Falha no envio nunca desfaz a operação. A resposta de enviar moedas e de resgatar traz as flags `emailEnviado` (ou `emailAlunoEnviado` e `emailEmpresaEnviado`), e o front-end mostra um aviso quando alguma é `false`.

---

## ⚠️ Limitações Conhecidas

- A foto da vantagem é informada por **URL `http(s)`**; não há upload de arquivo. O front-end só exibe imagens `https` (imagens `http` caem em "Sem imagem").
- O limitador de tentativas de login fica em memória e zera ao reiniciar o servidor.
- Os tokens duram 8 horas e não há logout no servidor. Sem `AUTH_SECRET`, eles também caem a cada reinício.
- A resposta de enviar moedas e de resgatar espera a tentativa de envio do e-mail; com um SMTP lento, pode levar até cerca de 10 segundos.
- Contas seed antigas mantêm os CPFs/CNPJs de bancos já existentes, mesmo que não passem na validação de dígitos. Bancos criados com `npm run db:init` usam documentos válidos.
- O envio por SMTP real não foi exercitado nos testes automatizados (apenas o modo simulado).
