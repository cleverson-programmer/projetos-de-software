# Publicação com AWS Fargate

## Arquitetura

Publicar um contêiner Node.js que serve frontend/API. PostgreSQL fica externo à tarefa, por exemplo RDS PostgreSQL 16. Sessões, fotos, filas de emails e dados financeiros ficam no PostgreSQL; não dependem do disco temporário do Fargate.

Para aplicação e banco no mesmo host, uma EC2 com Docker Compose e EBS é uma alternativa. Para Fargate, usar banco externo.

## Caminho com ECS Express Mode

1. Criar repositório privado ECR, autenticar Docker e publicar a imagem construída com docker build --platform linux/amd64 -t moeda-estudantil .
2. Criar PostgreSQL na VPC acessível pelo ECS. Em RDS, liberar 5432 somente do security group da aplicação e configurar backup.
3. No Secrets Manager, guardar DATABASE_URL e credenciais SMTP. Para RDS, configurar TLS com CA oficial e validação de certificado.
4. Definir DEFAULT_ALUNO_PASSWORD, DEFAULT_PROFESSOR_PASSWORD, DEFAULT_EMPRESA_PASSWORD e, se necessário, DEFAULT_*_EMAIL antes da primeira execução da migration 003. Os padrões estão no README e não são redefinidos em reinicializações.
5. Criar serviço ECS Express Mode apontando para a imagem/porta 3000 e health check /health. Fornecer task execution role e infrastructure role. Conferir VPC, acesso ao banco e às APIs ECR/Secrets Manager/CloudWatch; sub-redes privadas precisam de NAT ou endpoints adequados.
6. Configurar NODE_ENV=production, COOKIE_SECURE=true, APP_TIMEZONE=America/Sao_Paulo e APP_URL com a URL HTTPS pública.
7. Configurar SMTP_HOST/PORT/USER/PASS/FROM e TLS para o provedor real. Mailpit é somente a caixa de conferência local do Compose, não serviço de entrega externa.
8. O entrypoint aplica migrations e carga inicial antes do Node. Não precisa executar seed separado. Advisory lock serializa migrations de réplicas concorrentes; as contas existentes não são reinicializadas.
9. Manter ao menos uma tarefa ativa para processar créditos e emails. O servidor verifica créditos a cada minuto e emails a cada 15 segundos. Após indisponibilidade, retoma créditos não registrados e emails pendentes. jobs:once também permite execução por tarefa agendada.
10. Verificar /health e logs no CloudWatch. Atualizar publicando nova tag e revisando o serviço.

As migrations precisam de permissão DDL. Para separar permissões em produção, executar migração em tarefa própria e iniciar o servidor com entrypoint sobrescrito para node src/server.js.

O deploy não foi executado por esta implementação.

## TLS do banco

node-postgres aceita parâmetros TLS em DATABASE_URL. Preferir sslmode=verify-full.

Para RDS, incluir a CA pública oficial na imagem, por exemplo com COPY rds-ca.pem /app/rds-ca.pem antes de USER node, e usar sslmode=verify-full&sslrootcert=/app/rds-ca.pem na URL. Credenciais permanecem em secrets. Não desabilitar verificação de certificado.

## Persistência e atualização

- Fotos são BYTEA no PostgreSQL; múltiplas réplicas compartilham os mesmos dados.
- Sessões são persistidas, com cookie HttpOnly e CSRF. Não há necessidade de sessão fixa no balanceador.
- Transferências/resgates usam transações e bloqueios; requisições repetidas são controladas por Idempotency-Key.
- Emails têm fila persistida e claim com SKIP LOCKED/lease entre réplicas. SMTP pode reenviar mensagem após falha de confirmação, mas não reaplica operações financeiras.
- Não executar o SQL histórico database/init_postgres.sql, que contém DROP TABLE.
- Não remover volumes de bancos locais para atualizar.
- Importação SQLite para um destino vazio deve ocorrer antes da carga inicial, com o importador do README.

## Custos e validação

ECS Express Mode não cobra tarifa própria; Fargate, balanceador, logs, tráfego, RDS, Secrets Manager e eventual NAT têm custos. Não é hospedagem permanentemente gratuita.

A verificação desta entrega é de compilação/construção. Validação funcional é manual, conforme GUIA_MANUAL.md; nenhuma conta AWS ou recurso de produção foi configurado.

## Documentação oficial

- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
- https://nodemailer.com/smtp
