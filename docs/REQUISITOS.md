# Requisitos implementados — Moeda Estudantil

Implementação concluída no código em 18/11/2026. A auditoria anterior foi preservada em REQUISITOS_ANTES.md.

A validação funcional será manual, conforme solicitado. "Implementado" nesta matriz identifica código e interface existentes, não um resultado de teste automatizado.

| Requisito | Implementação |
| --- | --- |
| Cadastro de aluno com nome, email, CPF, RG, endereço, instituição e curso | Formulário de cadastro e ContaService com validação de todos os campos. RG obrigatório; CPF normalizado. |
| Instituições previamente cadastradas e selecionáveis | Migration 003 cria instituições; API pública /api/instituicoes alimenta os selects. |
| Professores previamente cadastrados pela instituição | Professor padrão na migration e provisionamento de listas JSON pelo comando professores:importar. Não há cadastro público de professor. |
| Professor com nome, CPF, departamento e instituição explícita | Dados persistidos; instituição/departamento visíveis no painel e cadastro. Campos institucionais gerenciados pelo provisionamento. |
| 1.000 moedas a cada semestre | CreditoService cria crédito e lançamento e soma 1.000 ao saldo na mesma transação. |
| Acúmulo de saldo e prevenção de crédito repetido | Saldo anterior é preservado. Bloqueio de linha e UNIQUE(professor_id, semestre) impedem duplicação entre réplicas. |
| Recuperar semestres durante indisponibilidade | Sincronização percorre os semestres desde inicio_creditos; inicialização, rotina periódica e operações do professor executam a sincronização. |
| Professor escolher aluno, quantidade e motivo obrigatório | Tela Enviar moedas; MoedaService exige aluno ativo da mesma instituição, quantidade inteira positiva e motivo não vazio. |
| Saldo suficiente e débito/crédito atômicos | Bloqueios FOR UPDATE e transação abrangem saldos, histórico, motivo, idempotência e email. Saldo insuficiente não gera envio. |
| Email ao aluno quando receber moedas | Nodemailer + emails_pendentes; mensagem contém professor, quantidade e motivo. |
| Professor consultar saldo e extrato de envios | Painel e Extrato, incluindo créditos semestrais e envios. |
| Aluno consultar saldo e recebimentos/trocas | Painel e Extrato, com histórico paginado e saldo consultado no mesmo snapshot das movimentações. |
| Cadastro de empresa com login e senha | Cadastro próprio; área autenticada de empresa e edição da própria conta. |
| Empresa cadastrar/editar vantagens e custo | Tela Minhas vantagens, editor e VantagemService; somente a empresa proprietária pode alterar. |
| Descrição e foto obrigatórias | Upload JPEG/PNG/WebP de até 2 MB ou URL HTTPS, descrição não vazia e custo inteiro positivo. Uploads ficam no PostgreSQL. |
| Aluno selecionar vantagem e resgatar | Catálogo, busca e confirmação do resgate. Somente aluno pode resgatar. |
| Desconto do saldo no resgate | Bloqueio de vantagem/aluno, validação de saldo, histórico e débito na mesma transação. |
| Proteção contra mudança de preço na confirmação | custoEsperado é comparado ao preço bloqueado; divergência pede atualização sem cobrar. |
| Código único para conferência presencial | Código aleatório ME- com 128 bits, restrição UNIQUE e tela de cupons. |
| Email de cupom para o aluno | Registro na mesma transação do resgate; Nodemailer processa o envio. |
| Email para o parceiro com o mesmo código | Segunda mensagem registra o mesmo cupom, aluno, vantagem e quantidade. |
| Empresa conferir utilização presencial | Busca por código restrita à empresa emissora; confirmação idempotente de utilização. |
| Login/senha para os três perfis | Login real, hashes scrypt novos, verificação real de BCrypt/PBKDF2 anteriores, sessão persistida com expiração e logout. |
| Autenticação obrigatória | Somente login, cadastros iniciais e consulta de instituições são públicos; demais APIs exigem sessão ativa. |
| Permissões por perfil e titularidade | Backend valida o perfil e o proprietário; rotas antigas também restringem o acesso ao próprio cadastro. |
| Painéis por perfil | Aluno: saldo, vantagens, cupons, extrato, conta. Professor: instituição/departamento, envio, saldo, extrato, conta. Empresa: vantagens, cupons e conta. |

## Decisões de negócio

- Semestres: janeiro–junho e julho–dezembro, no fuso APP_TIMEZONE (padrão America/Sao_Paulo).
- Professores distribuem para alunos da própria instituição.
- A conta do professor recebe créditos desde o semestre de ingresso; créditos já registrados não são repetidos.
- Quantidades e custos são inteiros positivos; saldos nunca ficam negativos.
- Transferência/resgate exigem Idempotency-Key UUID. Repetir a mesma chave/conteúdo devolve o resultado anterior; outro conteúdo é recusado.
- Desativar uma vantagem impede novos resgates; cupons emitidos mantêm nome, parceiro e preço do momento do resgate.
- Confirmação presencial só marca utilização: não desconta moedas outra vez.
- Desativar uma conta preserva saldos e histórico e revoga sessões. Empresas desativadas deixam de oferecer novas vantagens.
- Cadastros antigos sem RG podem entrar para completá-lo, mas não recebem nem resgatam moedas enquanto estiverem incompletos.
- Emails são persistidos antes do envio. Falha SMTP não reverte moedas, não perde a solicitação e não repete o débito.
- A entrega SMTP usa retentativas e lease entre réplicas. Como SMTP não oferece transação conjunta com PostgreSQL, uma falha após aceitação pode reenviar a mensagem; mantém o mesmo código e Message-ID, sem duplicar operações financeiras.
- Reenvio do cupom pode ser solicitado pelo aluno titular ou pela empresa emissora, com intervalo de um minuto.

## Carga inicial de publicação

Migration 003 é executada automaticamente pelo entrypoint Docker, inclusive em produção. Cria instituições, aluno.demo, professor.demo, empresa.demo e livraria.demo, além de duas vantagens. O professor recebe o crédito semestral pelo serviço de crédito, sem saldo fictício separado do histórico.

Senhas e emails iniciais podem ser definidos por DEFAULT_* antes da primeira execução. Contas existentes não têm senha, saldo ou dados redefinidos ao reiniciar.

## Configuração necessária

Envio real de email depende de SMTP_HOST/PORT/USER/PASS/FROM do provedor. No Compose local, Mailpit recebe os emails para conferência manual em http://localhost:8025.

Consulte GUIA_MANUAL.md, README.md e AWS.md.
