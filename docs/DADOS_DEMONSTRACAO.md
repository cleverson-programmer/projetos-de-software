# Dados de demonstração

A migration 004_dados_exemplo_adicionais.mjs acrescenta 6 alunos, 4 professores, 2 instituições e 3 empresas com 6 vantagens. A migration 003 continua criando os cadastros originais.

Em uma base nova, o conjunto das duas migrations cria 5 instituições, 7 alunos, 5 professores, 5 empresas e 8 vantagens. Uma base existente recebe somente a nova carga pendente.

## Aplicar

Na raiz do projeto:

```powershell
docker compose up -d --build
```

O entrypoint aplica as migrations antes de iniciar o servidor. Não é necessário apagar volumes ou executar seed separado. As migrations ficam registradas em schema_migrations e não são reaplicadas em cada inicialização.

A carga não redefine senhas, emails, saldos ou contas existentes. Um conflito de login com outro perfil/documento interrompe a migration inteira para preservar os cadastros; consultar o log e resolver o conflito antes de continuar.

## Instituições adicionais

| Instituição fictícia | Endereço de demonstração |
| --- | --- |
| Instituto Horizonte — Demonstração | Rua Horizonte, 100 - Contagem/MG |
| Faculdade Vale do Saber — Demonstração | Rua do Saber, 200 - Betim/MG |

As instituições PUC Minas, UFMG e CEFET-MG permanecem cadastradas. Os IDs são obtidos pelo nome no banco, sem depender de uma numeração fixa.

## Contas adicionais

| Perfil | Login | Instituição |
| --- | --- | --- |
| Aluno | ana.aluno.demo | PUC Minas |
| Aluno | bruno.aluno.demo | PUC Minas |
| Aluno | carla.aluno.demo | UFMG |
| Aluno | diego.aluno.demo | UFMG |
| Aluno | elisa.aluno.demo | Instituto Horizonte |
| Aluno | felipe.aluno.demo | Faculdade Vale do Saber |
| Professor | mariana.professor.demo | PUC Minas |
| Professor | rafael.professor.demo | UFMG |
| Professor | helena.professor.demo | Instituto Horizonte |
| Professor | lucas.professor.demo | Faculdade Vale do Saber |
| Empresa | cafe.demo | Não se aplica |
| Empresa | papelaria.demo | Não se aplica |
| Empresa | tecnologia.demo | Não se aplica |

Os emails seguem o formato login@example.test, por exemplo ana.aluno.demo@example.test. São endereços fictícios para o Mailpit. Para receber mensagens externas, cadastrar uma conta com email real ou alterar o email em Minha conta antes de realizar a operação.

As senhas são obtidas das mesmas variáveis já usadas na carga original:

| Perfil | Variável | Valor padrão |
| --- | --- | --- |
| Aluno | DEFAULT_ALUNO_PASSWORD | Aluno@123456 |
| Professor | DEFAULT_PROFESSOR_PASSWORD | Professor@123456 |
| Empresa | DEFAULT_EMPRESA_PASSWORD | Empresa@123456 |

Definir as variáveis antes da primeira aplicação da migration 004. Alterações posteriores não redefinem as senhas. As variáveis DEFAULT_*_EMAIL da migration 003 continuam exclusivas das quatro contas originais.

Todos os nomes, documentos e endereços adicionais são dados de demonstração.

## Vantagens adicionais

Todas possuem descrição, foto HTTPS e custo positivo.

| Empresa | Vantagem | Custo em moedas |
| --- | --- | --- |
| cafe.demo | Café com pão de queijo | 60 |
| cafe.demo | Combo café da manhã | 120 |
| papelaria.demo | Kit caderno e caneta | 90 |
| papelaria.demo | Impressão de 20 páginas | 50 |
| tecnologia.demo | Desconto de 10% em acessórios | 150 |
| tecnologia.demo | Oficina de introdução à programação | 250 |

As fotos ilustrativas são URLs externas do Unsplash e dependem da disponibilidade desse serviço. A empresa pode substituí-las pela interface.

## Regras de saldo

- Alunos entram com saldo zero; não há moedas ou resgates artificiais na carga.
- Cada professor novo recebe 1.000 moedas do semestre de entrada, com lançamento no extrato e controle de duplicidade pelo serviço de créditos.
- Reiniciar a aplicação não cria outro crédito no mesmo semestre.
- Professores enviam somente aos alunos da própria instituição. Por exemplo, rafael.professor.demo pode enviar a Carla e Diego.
- Empresas oferecem vantagens e confirmam cupons; não possuem carteira de moedas.
- A carga não cria transferências, resgates ou emails. Para conferir um fluxo manualmente, entrar como professor, enviar moedas a um aluno e resgatar uma vantagem com esse aluno.
