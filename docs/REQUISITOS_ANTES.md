# Verificação da descrição do sistema

Revisão de 18/11/2026. Escopo: conferir regras e telas, migrar persistência para PostgreSQL. A migração não implementa os módulos de negócio ausentes.

"Modelado" significa existir tabela ou método de entidade; não equivale a regra executada no backend e disponível na interface.

| Requisito | Situação | Evidência / lacuna |
| --- | --- | --- |
| Aluno informar nome, email, CPF, RG, endereço, instituição e curso | Parcial | Formulário e AlunoService; RG é opcional na tela, serviço e banco, embora solicitado na descrição. |
| Seleção de instituição previamente cadastrada | Implementado no MVP | GET /api/instituicoes, select e validação da existência. Instituições reais precisam de provisionamento; seed é demonstração. |
| Professores previamente cadastrados pela instituição | Parcial | Tabela professores e seed; sem processo de importação da lista ou administração. |
| Professor com nome, CPF, departamento e instituição explícita | Modelado, sem tela | Colunas presentes; login retorna apenas Usuario sem departamento/instituição. Não há ProfessorDAO ou painel. |
| Crédito semestral de 1.000 moedas | Não implementado | creditos_semestrais contém exemplos; não há serviço, endpoint ou agendamento. |
| Acúmulo com saldo anterior e um crédito por semestre | Não implementado | UNIQUE(professor_id, semestre) ajuda, mas falta somar o crédito ao saldo em transação idempotente. |
| Professor selecionar aluno, quantidade e motivo obrigatório | Não implementado | Tabela transferencias_moedas, sem formulário/endpoint/serviço. NOT NULL não rejeita motivo vazio. |
| Transferência somente com saldo suficiente | Não implementado | CHECK não negativo não substitui validação, bloqueio de contas e débito/crédito atômicos. |
| Email ao aluno ao receber moedas | Não implementado | Nenhum envio ou integração de email. |
| Professor consultar saldo e extrato de envios | Não implementado | Sem endpoint ou painel. |
| Aluno consultar saldo e extrato de recebimentos/trocas | Não implementado | Saldo modelado; frontend de login remove saldoMoedas da apresentação. Sem extrato ou painel. |
| Cadastro de empresa com login/senha | Implementado como CRUD | API, service, DAO e formulário; sem sessão após login. |
| Empresa cadastrar vantagens com custo | Não implementado | Tabela vantagens, sem DAO, serviço, API ou tela. |
| Descrição e foto obrigatórias da vantagem | Apenas modelado | descricao e foto_url NOT NULL; sem fluxo de cadastro/validação de foto ou URL. |
| Aluno visualizar, selecionar e resgatar vantagem | Não implementado | Somente tabelas e seed. |
| Resgate descontar saldo e validar saldo suficiente | Não implementado | Sem operação transacional ou proteção contra resgates simultâneos. |
| Gerar código de cupom único | Não implementado | codigo_cupom UNIQUE; código de exemplo fixo não é geração pelo sistema. |
| Email de cupom ao aluno | Não implementado | Sem envio. |
| Email ao parceiro com o mesmo código | Não implementado | Sem envio ou reenvio em caso de falha. |
| Login/senha para os três perfis | Parcial | POST /api/auth/login valida credenciais e devolve tipo; sem sessão/token, logout ou usuário autenticado. |
| Autenticação obrigatória nas funcionalidades | Não implementado | CRUDs públicos. Cadastro inicial deve continuar público; operações de conta exigem identidade. |
| Permissão por perfil e titularidade dos dados | Não implementado | tipo contém ALUNO/PROFESSOR/EMPRESA, sem controle no backend. Esconder botões não resolve. |

## Telas e perfis

Há três abas públicas: CRUD de alunos, CRUD de empresas e teste de autenticação. Login apenas apresenta os dados da resposta. Não existe área autenticada nem navegação por perfil.

| Perfil | Telas/ações ainda necessárias |
| --- | --- |
| Aluno | Painel de saldo, extrato, catálogo, resgate e cupons. |
| Professor | Instituição/departamento, saldo, extrato, formulário de envio com motivo. |
| Empresa | Gestão de vantagens (foto, descrição, custo) e conferência dos cupons. |
| Todos | Sessão, logout e bloqueio de acesso sem login ou a contas de terceiros. |

## Achados adicionais

- Usuario.autenticar aceita 123456 para qualquer hash com prefixo $2b$10$ sem verificar BCrypt, além de fallback em texto puro. Não é autenticação adequada para exposição pública. Cadastros novos usam PBKDF2; o novo seed também gera PBKDF2 real.
- Exclusão de aluno/empresa remove histórico financeiro vinculado. Comportamento anterior preservado na migração; rever antes de operar moedas reais.
- Transferências/resgates precisam de SELECT FOR UPDATE, validação de perfil/titularidade, atualização de saldos e histórico na mesma transação.
- Crédito semestral precisa de tarefa idempotente por professor/semestre.
- Emails devem ter registro de saída pendente e retentativas, sem duplicar moedas/cupons quando o envio falhar.

## Após a migração

CRUDs e login existentes usam PostgreSQL com pool, consultas parametrizadas e transações. As lacunas acima continuam abertas. Existência de tabelas não certifica conformidade com a descrição.
