# Moeda Estudantil

Aplicação com painéis de aluno, professor e empresa. HTML/CSS/JavaScript puro, Node.js 24, PostgreSQL 16 e Nodemailer.

Inclui autenticação com sessão, cadastro, créditos semestrais, envio de moedas com motivo, saldos/extratos, vantagens com fotos, resgates, cupons e emails. Permissões são verificadas no backend, além da navegação por perfil.

## Iniciar com Docker

    docker compose up --build -d

- Aplicação: http://localhost:3000
- Emails locais no Mailpit: http://localhost:8025
- PostgreSQL: localhost:5432

O entrypoint aplica as migrations antes de iniciar o servidor. Em uma base nova, as migrations 003 e 004 criam cinco instituições, sete alunos, cinco professores, cinco empresas e oito vantagens. Bancos existentes recebem a nova carga pela migration 004. Não há comando de seed obrigatório separado.

| Perfil | Login | Senha inicial |
| --- | --- | --- |
| Aluno | aluno.demo | Aluno@123456 |
| Professor | professor.demo | Professor@123456 |
| Empresa — cantina | empresa.demo | Empresa@123456 |
| Empresa — livraria | livraria.demo | Empresa@123456 |

As contas adicionais, vínculos e vantagens estão em [Dados de demonstração](docs/DADOS_DEMONSTRACAO.md). Todas usam as mesmas variáveis DEFAULT_*_PASSWORD por perfil. O aluno começa com zero moedas; o professor recebe 1.000 no semestre. As contas de professor/aluno padrão pertencem à PUC Minas.

Para definir outras senhas/emails iniciais, copiar .env.example para .env e preencher DEFAULT_ALUNO_PASSWORD, DEFAULT_PROFESSOR_PASSWORD, DEFAULT_EMPRESA_PASSWORD e DEFAULT_*_EMAIL antes da primeira migration 003. Alterar essas variáveis depois não redefine contas existentes; senha/email podem ser alterados em Minha conta.

Os emails @example.test são de demonstração. Mailpit permite conferir seu conteúdo localmente; para entrega externa, usar emails reais e SMTP autorizado.

Os volumes postgres_data e mailpit_data persistem os dados. docker compose down preserva volumes; não usar down -v para atualizar.

## Node no host

    npm ci
    docker compose up -d postgres mailpit

Copiar .env.example para .env e configurar DATABASE_URL.

    npm run db:migrate
    npm start

db:init e db:seed são aliases de migração/carga inicial sem reset. O SQL antigo database/init_postgres.sql é histórico, contém DROP TABLE e não deve ser executado sobre dados existentes.

## Professores e instituições

Instituições e professores são provisionados pela parceria. A migration cria instituições iniciais; outras podem ser inseridas administrativamente na tabela instituicoes_ensino.

Para importar professores, preparar equipe.professores.json com uma lista de objetos contendo nome, email, login, senha (mínimo 8), cpf, departamento e instituicaoId. Consultar os IDs em /api/instituicoes.

    npm run professores:importar -- equipe.professores.json

Pela imagem em execução, disponibilizar o JSON e executar o mesmo comando dentro do contêiner. Cada lote é transacional, valida instituições e credita o semestre. Repetir um professor com mesmo login/CPF não altera senha nem duplica cadastro. CPF, departamento e instituição são dados institucionais; edição desses vínculos é administrativa.

Arquivos *.professores.json são ignorados pelo Git e pelo contexto Docker.

## Emails com Nodemailer

Configuração completa, exemplos para Gmail/SES e conferência manual: [Envio de emails reais](docs/EMAIL.md). No Docker, alterar COMPOSE_SMTP_HOST e COMPOSE_SMTP_PORT além das credenciais SMTP para sair do Mailpit.

O Compose local usa Mailpit automaticamente. No Node do host, usar SMTP_HOST=127.0.0.1 e SMTP_PORT=1025, conforme .env.example.

Na publicação, definir SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_REQUIRE_TLS, SMTP_USER, SMTP_PASS e SMTP_FROM para seu provedor. Porta 465 normalmente usa SMTP_SECURE=true; 587 usa false com STARTTLS, preferencialmente SMTP_REQUIRE_TLS=true. Usar remetente autorizado pelo provedor.

A fila emails_pendentes é registrada junto da transação financeira. O servidor a processa a cada 15 segundos com novas tentativas; reinício não perde os registros. Cupom vai para aluno e empresa com o mesmo código. Há reenvio manual com intervalo de um minuto.

Créditos são sincronizados na inicialização, a cada minuto e nas operações do professor. O processamento pode ser chamado explicitamente:

    npm run jobs:once

Esse comando efetua créditos e envia emails pendentes; não é um teste.

## Sessões e permissões

Cookies HttpOnly/SameSite, expiração em sete dias, revogação no logout e proteção CSRF. Em HTTPS de produção, usar NODE_ENV=production e COOKIE_SECURE=true. APP_URL pode definir a origem HTTPS pública.

Cadastros iniciais e consulta de instituições são públicos. Transferências só por professor; resgates só por aluno; vantagens e conferência de cupons só pela empresa proprietária. Professor consulta alunos da própria instituição. A conta só pode ser alterada pelo titular.

Desativação preserva o histórico financeiro. Pausar vantagem mantém cupons já emitidos válidos.

## SQLite anterior

O backend usa somente PostgreSQL. Para importar o SQLite em um destino vazio, não iniciar a aplicação ou executar migrations comuns antes da importação, pois agora elas criam contas iniciais.

Com DATABASE_URL apontando ao destino vazio:

    npm run db:import:sqlite -- database/moeda_estudantil.db

O comando aplica somente a estrutura primeiro, importa e depois aplica a carga inicial. Recusa destino com dados e não altera a origem. Na imagem Docker, usar --entrypoint node database/import_sqlite.mjs com o SQLite montado somente para leitura e a aplicação parada. Credenciais antigas só funcionarão se o hash realmente corresponder à senha; a compatibilidade insegura anterior foi removida.

## Compilação e validação manual

    npm run build

Verifica sintaxe, importações e referências de elementos da interface, sem subir servidor, executar migrations, enviar emails ou rodar testes. Dockerfile executa essa verificação na construção.

Os testes funcionais desta implementação serão manuais, conforme solicitado. A suíte automatizada do MVP anterior permanece como histórico e não certifica os novos contratos de autenticação/API.

- [Matriz de requisitos implementados](docs/REQUISITOS.md)
- [Roteiro manual](docs/GUIA_MANUAL.md)
- [Verificações realizadas](docs/VALIDACAO.md)
- [AWS/Fargate](docs/AWS.md)
- [Auditoria anterior](docs/REQUISITOS_ANTES.md)

Documentação acadêmica: docs/Sprint 1/ e docs/Sprint-2/. O roteiro antigo em docs/roteiro.md corresponde ao MVP anterior.
