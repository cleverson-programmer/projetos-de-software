# Envio de emails reais com Nodemailer

A aplicação já usa Nodemailer. Transferências geram uma notificação ao aluno; resgates geram um email ao aluno e outro à empresa, com o mesmo código do cupom.

O Mailpit do Docker apenas recebe mensagens para conferência em http://localhost:8025. Ele não entrega mensagens em caixas externas.

## O que configurar

É necessário um serviço SMTP, com host, porta, usuário, senha SMTP e remetente autorizado. Os destinatários também precisam ter emails reais. Os endereços @example.test e o remetente @moeda.local da configuração local são fictícios.

O serviço em src/services/EmailService.js já lê estas variáveis:

| Variável | Finalidade |
| --- | --- |
| SMTP_HOST | Host SMTP usado pelo Node executado no host ou diretamente no Fargate |
| SMTP_PORT | Porta SMTP |
| SMTP_SECURE | true na porta 465; false na 587 com STARTTLS |
| SMTP_REQUIRE_TLS | true para exigir STARTTLS na porta 587 |
| SMTP_USER | Usuário SMTP |
| SMTP_PASS | Senha SMTP ou senha de aplicativo aceita pelo provedor |
| SMTP_FROM | Nome e endereço do remetente autorizado |
| COMPOSE_SMTP_HOST | Substitui SMTP_HOST dentro do serviço app do Compose |
| COMPOSE_SMTP_PORT | Substitui SMTP_PORT dentro do serviço app do Compose |

A distinção entre SMTP_HOST e COMPOSE_SMTP_HOST é necessária no Compose atual: alterar apenas SMTP_HOST no .env mantém o contêiner apontando para o Mailpit.

Referência: [transporte SMTP e TLS do Nodemailer](https://nodemailer.com/smtp).

## Exemplo usando uma conta Gmail

Para esse método, ativar a verificação em duas etapas e gerar uma senha de aplicativo na conta Google, se a opção estiver disponível. A senha de app substitui a senha normal da conta nessa configuração. Contas de organizações ou com certas políticas podem não oferecer essa opção.

Referências: [senhas de app do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR) e [Gmail com Nodemailer](https://nodemailer.com/usage/using-gmail/).

No .env local, substituir somente as variáveis SMTP pelos seus dados:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
COMPOSE_SMTP_HOST=smtp.gmail.com
COMPOSE_SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=seuemail@gmail.com
SMTP_PASS=senha_de_app_gerada_no_google
SMTP_FROM="Moeda Estudantil <seuemail@gmail.com>"
```

Usar em SMTP_FROM o mesmo endereço autorizado da conta. O exemplo não configura nenhuma conta automaticamente. Manter credenciais apenas no .env local; no Fargate, injetá-las por Secrets Manager.

Depois de salvar, recriar o serviço para carregar o ambiente:

```powershell
docker compose up -d --force-recreate app
```

Um simples docker compose restart não atualiza as variáveis do contêiner.

Se o provedor utilizar porta 465, configurar SMTP_PORT=465 e COMPOSE_SMTP_PORT=465, SMTP_SECURE=true e SMTP_REQUIRE_TLS=false. Na 587, secure=false permite a negociação STARTTLS; requireTLS=true exige essa negociação.

## Amazon SES na AWS

Para usar SES com a mesma integração Nodemailer:

1. Escolher a região do SES e verificar o endereço remetente ou domínio nessa região.
2. Se usar domínio próprio, publicar os registros de verificação/DKIM indicados pelo SES no DNS. Seguir também as orientações de autenticação SPF/DMARC do provedor conforme o domínio e a configuração de MAIL FROM.
3. Gerar usuário e senha SMTP do SES na região selecionada. Não são a senha do console nem as mesmas credenciais de acesso à API AWS.
4. Usar o endpoint SMTP exibido pelo SES, por exemplo email-smtp.us-east-1.amazonaws.com para us-east-1, porta 587 com STARTTLS, as credenciais SMTP e um SMTP_FROM verificado.
5. Enquanto a conta estiver no sandbox, verificar também os destinatários. Solicitar acesso de produção para enviar a destinatários não verificados.
6. Garantir que a tarefa Fargate tenha resolução DNS e saída de rede para o endpoint SMTP na porta escolhida. Acesso apenas ao banco de dados não garante conectividade com o SMTP.

No Fargate, definir SMTP_HOST/SMTP_PORT diretamente na definição da tarefa e as credenciais como secrets. As variáveis COMPOSE_SMTP_* servem apenas para o Compose.

Referências oficiais: [envio SMTP com SES](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html), [verificação de identidades](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html), [DKIM](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html) e [saída do sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Conferir manualmente a entrega

Após configurar seu provedor:

1. Em Minha conta, atualizar o email de um aluno e de uma empresa para endereços reais sob seu controle, ou criar contas próprias pela interface. Os emails precisam ser distintos porque o cadastro exige unicidade.
2. Enviar moedas com um professor da mesma instituição: a notificação deve chegar ao aluno.
3. Resgatar uma vantagem com esse aluno: aluno e empresa devem receber o mesmo código. Conferir também a pasta de spam.
4. Acompanhar os logs com docker compose logs --tail=100 app. Falhas ficam na fila para nova tentativa; a operação financeira não é repetida.
5. O código EAUTH costuma indicar autenticação recusada; ECONNECTION/ETIMEDOUT exigem conferir host, porta e acesso de rede. A mensagem de erro e as regras do provedor determinam a causa.

A fila emails_pendentes é persistida junto da transação. O worker roda a cada 15 segundos e faz novas tentativas com espera crescente quando o SMTP falha. A marca ENVIADO indica aceite pelo servidor SMTP; a chegada à caixa de entrada depende também do processamento do provedor e do destinatário.

Para cupons já gerados, atualizar os emails e usar a opção de reenvio na interface, respeitando o intervalo de um minuto. Notificações de transferência já enfileiradas mantêm o destinatário registrado na operação.

Nenhuma credencial SMTP real foi adicionada ao repositório, nenhum provedor externo foi provisionado e nenhum email externo foi enviado nesta alteração.
