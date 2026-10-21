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

### Sprint 2 (`Lab03S02`) — MVP Atual
- **Modelo Entidade-Relacionamento (ER):** Disponível em [`docs/Sprint-2/MODELO_ER.md`](./docs/Sprint-2/MODELO_ER.md) e [`docs/Sprint-2/Diagrama ER.png`](./docs/Sprint-2/Diagrama%20ER.png).
- **Banco de Dados Relacional:** Scripts SQL e banco pré-populado em [`database/`](./database/) (`moeda_estudantil.db` para SQLite / DBeaver e `init_postgres.sql` para PostgreSQL via Docker).
- **Estratégia de Acesso a Dados (Padrão DAO):** Implementada em [`src/dao/`](./src/dao/) e [`src/models/`](./src/models/) com transações atômicas (`JOINED` inheritance entre `usuarios`, `alunos` e `empresas_parceiras`).
- **Back-end MVC + API REST:** Implementado em [`src/controllers/`](./src/controllers/), [`src/services/`](./src/services/) e [`src/server.js`](./src/server.js).
- **Front-end (CRUDs de Aluno e Empresa Parceira + Autenticação):** Interface web responsiva em [`public/`](./public/).

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** v22.5+ (utiliza o módulo nativo `node:sqlite`, sem necessidade de instalar dependências externas).

### 1. Inicializar / Resetar o Banco de Dados (Opcional)
O arquivo `database/moeda_estudantil.db` já está criado e populado. Caso queira recriá-lo do zero com os dados iniciais:
```bash
npm run db:init
```

### 2. Rodar os Testes da Camada DAO
```bash
npm run test:dao
```

### 3. Iniciar o Servidor MVC (Back-end + Front-end)
```bash
npm start
```
Acesse no navegador: **`http://localhost:3000`**
