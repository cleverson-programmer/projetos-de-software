# Briefing para Apresentação em Slides

## Sistema de Moeda Estudantil

Este README deve ser usado como briefing por uma IA especializada na criação de slides.

## Regra principal: duração

A apresentação deverá durar aproximadamente **20 minutos**. O slide deve respeitar esse tempo, com conteúdo objetivo e sem excesso de detalhes.

Sugestão: criar **10 a 12 slides**, usando de 1 a 2 minutos por slide e reservando cerca de 2 minutos para conclusão e perguntas.

## Objetivo do projeto

O Sistema de Moeda Estudantil estimula o reconhecimento do mérito dos alunos por meio de uma moeda virtual. Professores podem distribuir moedas aos estudantes, que podem trocá-las por produtos, benefícios e descontos oferecidos por empresas parceiras.

O projeto é um MVP da Sprint 2 da disciplina de Laboratório de Projeto de Software da PUC Minas. O MVP apresenta cadastros de alunos e empresas parceiras, autenticação e persistência de dados.

## Conceitos de projeto de software

### Arquitetura em camadas

O sistema separa as responsabilidades da seguinte forma:

```text
Frontend -> API REST -> Controllers -> Services -> DAOs -> Models -> SQLite
```

- **Frontend:** exibe as telas e envia requisições.
- **Controllers:** recebem requisições e retornam respostas.
- **Services:** aplicam validações e regras de negócio.
- **DAOs:** executam operações no banco.
- **Models:** representam as entidades do sistema.
- **SQLite:** armazena os dados.

### MVC

O padrão MVC organiza o código em:

- **Model:** `Usuario`, `Aluno`, `EmpresaParceira` e `InstituicaoEnsino`.
- **View:** HTML, CSS e JavaScript em `public/`.
- **Controller:** classes em `src/controllers/` que recebem as requisições.

O objetivo é separar interface, dados e controle da aplicação.

### DAO

DAO significa Data Access Object. É o padrão usado para concentrar o acesso ao banco de dados em classes específicas, como `AlunoDAO` e `EmpresaParceiraDAO`.

Os DAOs possuem operações como `findAll`, `findById`, `create`, `update` e `delete`. Assim, o SQL não fica misturado com a interface ou com as regras de negócio.

### Services

Os Services concentram regras como:

- validação de campos obrigatórios;
- prevenção de e-mail e login duplicados;
- validação de RG, CPF e CNPJ;
- confirmação da instituição de ensino;
- validação do login e da senha.

### Herança

O projeto usa orientação a objetos e herança:

```text
Usuario
	-> Aluno
	-> EmpresaParceira
```

`Usuario` possui dados comuns de autenticação. `Aluno` e `EmpresaParceira` adicionam seus dados específicos. Isso reduz repetição e representa melhor o domínio.

### Transações e integridade

O cadastro de um aluno ou empresa altera a tabela `usuarios` e uma tabela específica. Essas operações usam transações: se tudo funcionar, ocorre `COMMIT`; se houver erro, ocorre `ROLLBACK`.

O banco também utiliza chaves estrangeiras e `ON DELETE CASCADE` para manter a integridade dos dados.

### Segurança

As senhas não são armazenadas em texto puro. O sistema utiliza hash com PBKDF2, SHA-256 e salt aleatório. No login, a senha informada é comparada com o hash armazenado.

## Documentos de modelagem do projeto

### Histórias de Usuário

Arquivo: `docs/Sprint 1/Histórias do Usuário.drawio.pdf`

As histórias de usuário descrevem as necessidades do sistema pela perspectiva dos usuários.

Exemplos:

- o aluno realiza cadastro;
- o usuário realiza login;
- a empresa parceira realiza cadastro;
- o sistema permite o uso da moeda estudantil.

Elas ajudam a transformar as necessidades dos usuários em funcionalidades do sistema.

### Diagrama de Casos de Uso

Arquivo: `docs/Sprint 1/Casos de Uso.drawio.pdf`

O diagrama de casos de uso mostra quem utiliza o sistema e quais ações cada usuário pode realizar.

Principais atores:

- aluno;
- professor;
- empresa parceira.

Principais ações:

- cadastrar usuário;
- realizar login;
- distribuir moedas;
- resgatar vantagens;
- consultar informações.

Ele apresenta o sistema do ponto de vista funcional, sem mostrar detalhes internos do código.

### Diagrama de Classes

Arquivo: `docs/Sprint 1/Diagrama de Classes.drawio.pdf`

O diagrama de classes mostra as principais entidades do sistema, seus atributos, métodos e relacionamentos.

A relação principal é:

```text
Usuario
	-> Aluno
	-> Professor
	-> EmpresaParceira
```

Esse diagrama serviu como base para os Models implementados em `src/models/`.

### Diagrama de Componentes

Arquivo: `docs/Sprint 1/Diagrama de Componentes.drawio.pdf`

O diagrama de componentes mostra como as partes técnicas da aplicação se relacionam.

O fluxo principal é:

```text
Frontend
	-> Servidor HTTP e API REST
	-> Controllers
	-> Services
	-> DAOs
	-> Banco de Dados
```

Esse diagrama ajuda a explicar a arquitetura em camadas e a separação de responsabilidades.

### Diagrama Entidade-Relacionamento

Arquivos:

- `docs/Sprint-2/MODELO_ER.md`;
- `docs/Sprint-2/Diagrama ER.png`.

O diagrama ER mostra como os dados são organizados no banco e como as tabelas se relacionam.

Principais tabelas:

- `usuarios`;
- `alunos`;
- `professores`;
- `empresas_parceiras`;
- `instituicoes_ensino`;
- `vantagens`;
- `transacoes`.

O modelo utiliza herança com tabelas relacionadas. A tabela `usuarios` armazena os dados comuns e as tabelas específicas armazenam os dados de cada tipo de usuário.

Também são utilizados:

- chaves primárias;
- chaves estrangeiras;
- restrições de unicidade;
- integridade referencial;
- transações;
- `ON DELETE CASCADE`.

### Relação entre os documentos

Os documentos representam diferentes etapas da análise e do projeto:

```text
Histórias de Usuário
	-> Casos de Uso
	-> Diagrama de Classes
	-> Diagrama de Componentes
	-> Modelo ER
	-> Implementação
```

As histórias mostram as necessidades, os casos de uso mostram as funcionalidades, o diagrama de classes mostra as entidades, o diagrama de componentes mostra a arquitetura e o modelo ER mostra a persistência dos dados.

## Roteiro dos slides

### Slide 1 — Título e objetivo

**Tempo: 1 minuto.** Apresentar o projeto, a disciplina e a finalidade da moeda estudantil.

### Slide 2 — Problema e proposta

**Tempo: 1,5 minuto.** Explicar o reconhecimento estudantil por moedas virtuais e apresentar alunos, professores e empresas parceiras.

### Slide 3 — Documentos de modelagem

**Tempo: 2 minutos.** Apresentar as histórias de usuário, os casos de uso, o diagrama de classes, o diagrama de componentes e o modelo ER.

Mostrar que cada documento representa uma visão diferente do projeto: necessidades, funcionalidades, entidades, arquitetura e dados.

### Slide 4 — Arquitetura geral

**Tempo: 1,5 minuto.** Mostrar o fluxo `Frontend -> API -> Controller -> Service -> DAO -> SQLite` e explicar a responsabilidade de cada camada.

### Slide 5 — MVC e organização do código

**Tempo: 1,5 minuto.** Relacionar Model, View e Controller aos diretórios `src/models/`, `public/` e `src/controllers/`.

### Slide 6 — Services e regras de negócio

**Tempo: 1,5 minuto.** Explicar validações, duplicidades e regras antes da gravação dos dados.

### Slide 7 — DAO e persistência

**Tempo: 1 minuto.** Explicar como os DAOs isolam o SQL e realizam o CRUD no SQLite.

### Slide 8 — Herança, transações e segurança

**Tempo: 1,5 minuto.** Apresentar `Usuario -> Aluno` e `Usuario -> EmpresaParceira`, transações `COMMIT`/`ROLLBACK` e hash de senhas.

### Slide 9 — Tela de alunos

**Tempo: 2 minutos.** Mostrar cadastro, edição, exclusão, listagem, máscaras de CPF/RG e seleção de instituição.

Fluxo:

```text
Formulário -> POST /api/alunos -> Service -> DAO -> SQLite
```

### Slide 10 — Tela de empresas parceiras

**Tempo: 1,5 minuto.** Mostrar cadastro, edição, exclusão e listagem de empresas, destacando CNPJ e descrição da parceria.

### Slide 11 — Tela de login

**Tempo: 1,5 minuto.** Mostrar a autenticação de usuários e o fluxo `AuthController -> AuthService -> UsuarioDAO`.

### Slide 12 — Design System e tecnologias

**Tempo: 1,5 minuto.** Apresentar o Design System próprio: tema escuro, cores padronizadas, cards, botões, badges, tabelas e responsividade.

### Slide 13 — Testes e conclusão

**Tempo: 1,5 minuto.** Apresentar os testes do DAO, resumir os benefícios da arquitetura e abrir espaço para perguntas.

## Tecnologias e motivo da escolha

| Tecnologia | Uso | Motivo |
|---|---|---|
| Node.js | Backend e servidor HTTP | Leve e permite usar JavaScript no servidor |
| JavaScript ES Modules | Organização do código | Facilita modularização e manutenção |
| HTML, CSS e JavaScript | Frontend | Simples e suficiente para o MVP |
| SQLite | Banco de dados | Leve, local e adequado para desenvolvimento |
| API REST | Comunicação entre frontend e backend | Usa operações HTTP padronizadas |
| `node:crypto` | Hash das senhas | Oferece recursos nativos de segurança |
| Docker Compose | Padronização do ambiente | Facilita a configuração de serviços |

## Arquivos importantes

- `src/server.js`: servidor HTTP, rotas e API REST.
- `src/controllers/`: entrada das requisições.
- `src/services/`: regras de negócio.
- `src/dao/`: acesso e persistência dos dados.
- `src/models/`: entidades e herança.
- `src/config/database.js`: conexão, Singleton e transações.
- `public/index.html`: estrutura das telas.
- `public/app.js`: interações e chamadas à API.
- `public/styles.css`: Design System e responsividade.
- `src/dao/test_dao.js`: testes da persistência.

## Orientações para a IA de slides

1. Criar uma apresentação de aproximadamente 20 minutos.
2. Usar entre 10 e 12 slides.
3. Usar linguagem simples, direta e acadêmica.
4. Usar pouco texto nos slides e colocar detalhes nas notas do apresentador.
5. Priorizar diagramas, fluxos e capturas das três telas.
6. Relacionar cada conceito a um arquivo ou funcionalidade real.
7. Não apresentar funcionalidades que não estejam implementadas no MVP.
8. Reservar tempo para conclusão e perguntas sem ultrapassar 20 minutos.

## Execução para capturas de tela

```bash
npm install
npm run db:init
npm start
```

Acesse `http://localhost:3000`.

Para executar os testes:

```bash
npm run test:dao
```
