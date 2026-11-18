# Roteiro de validação manual

Este roteiro não foi executado automaticamente. Usar uma base de demonstração, com as migrations aplicadas e Mailpit acessível em http://localhost:8025.

## 1. Contas iniciais e permissões

- Executar docker compose up --build -d e abrir http://localhost:3000.
- Entrar com professor.demo / Professor@123456. Conferir instituição, departamento e crédito de 1.000 moedas no extrato.
- Sair e entrar com aluno.demo / Aluno@123456. Conferir instituição, curso, saldo zero, catálogo e cupons.
- Entrar com empresa.demo / Empresa@123456. Conferir Minhas vantagens e Cupons recebidos. Repetir com livraria.demo.
- Professor não tem resgate/gestão de vantagens; aluno não tem envio; empresa não tem envio/resgate.
- Tentar alterar identificadores de outros cadastros pela API: deve retornar 403/404, sem alterar dados.
- APIs privadas sem cookie retornam 401; mutações com cookie sem X-CSRF-Token retornam 403.
- Logout deve impedir novos acessos às APIs da sessão anterior.

## 2. Cadastros

- Cadastrar aluno informando todos os campos, inclusive RG, instituição e curso. Conferir entrada automática na própria área.
- Omitir RG, usar email inválido, repetir login/email/CPF: cadastro deve ser recusado.
- Cadastrar empresa com CNPJ e credenciais; conferir área de vantagens.
- Não existe registro público de professor. Usar o importador institucional descrito no README.
- Trocar email/senha em Minha conta. Senha nova exige a atual. Outras sessões devem ser revogadas após a troca.
- Professor visualiza seus dados institucionais, mas não modifica CPF/departamento/instituição pela própria conta.

## 3. Moedas e reconhecimento

- No professor.demo, enviar 150 moedas ao aluno.demo com um motivo.
- Conferir saldo do professor em 850 e registro de envio com o motivo.
- Entrar no aluno.demo: saldo 150 e recebimento no extrato.
- Em Mailpit, conferir o email ao aluno com professor, 150 moedas e a mensagem.
- Tentar enviar mais que o saldo, zero, negativo, valor fracionado ou motivo só com espaços: operação deve ser recusada sem débito.
- A lista contém somente alunos da instituição do professor.
- Repetir manualmente uma requisição financeira com o mesmo Idempotency-Key e corpo: deve retornar o mesmo lançamento, sem novo débito/crédito.
- Reusar a chave com outro conteúdo deve retornar 409.

## 4. Crédito semestral acumulável

- Reiniciar o serviço ou executar jobs:once mais de uma vez no mesmo semestre: não deve adicionar outro crédito.
- Créditos anteriores ficam no extrato e moedas não utilizadas não são zeradas.
- A virada de semestre usa janeiro/julho em America/Sao_Paulo. Para avaliar recuperação de períodos passados, utilizar uma base descartável e o início de elegibilidade dos professores, sem alterar o histórico de produção.
- Professores importados recebem o crédito do semestre de ingresso.

## 5. Vantagens e fotos

- Na empresa.demo, criar vantagem com nome, descrição, custo inteiro positivo e foto JPEG/PNG/WebP de até 2 MB.
- Conferir a foto depois de atualizar a página/reiniciar a aplicação; ela está no PostgreSQL.
- Repetir usando URL HTTPS de uma foto real.
- Omitir descrição/foto ou usar custo inválido: cadastro deve ser recusado.
- Alterar preço/nome e pausar/reativar uma vantagem.
- A empresa não pode editar vantagens ou conferir cupons de outra empresa.

## 6. Resgate e cupons

- Após o envio de 150 moedas, aluno.demo resgata Combo de lanche (100 moedas).
- Conferir confirmação, saldo 50, débito no extrato e cupom único.
- Em Mailpit, comparar os emails do aluno e da cantina: ambos devem conter exatamente o mesmo código.
- Não permitir resgate com saldo insuficiente.
- Abrir confirmação do resgate, alterar o preço na empresa em outra sessão e confirmar: deve pedir atualização, sem cobrar o novo preço.
- Na empresa.demo, procurar o código, conferir aluno/vantagem e confirmar a utilização presencial.
- Conferir estado Utilizado no aluno. Confirmar novamente não deve cobrar ou alterar saldo.
- Pausar/editar a vantagem depois do resgate não altera o nome/valor do cupom emitido.
- Solicitar reenvio depois de um minuto; código e saldo devem permanecer iguais.

## 7. Falhas SMTP e persistência

- Configurar SMTP incorreto em uma base local, realizar envio/resgate e conferir que a movimentação financeira é registrada uma única vez.
- A interface informa processamento de email; emails_pendentes mantém a solicitação para nova tentativa.
- Corrigir SMTP, reiniciar e aguardar processamento. Não deve ocorrer novo débito/resgate.
- É possível que uma falha depois da aceitação SMTP resulte em outra cópia do email, com o mesmo código; isso não repete a movimentação.

## 8. Histórico e desativação

- Desativar conta com senha correta. Login posterior deve ser recusado.
- Históricos/saldos/cupons não são apagados. Vantagens de empresa desativada deixam de aceitar novos resgates.
- Contas desativadas continuam reservando seus identificadores únicos; reativação é administrativa.
- Reiniciar sem remover volumes: contas, senhas alteradas, fotos, saldos e cupons devem permanecer.
