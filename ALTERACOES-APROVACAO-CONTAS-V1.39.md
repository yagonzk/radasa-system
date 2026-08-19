# ALTERAÇÕES — APROVAÇÃO DE CONTAS V1.39

## Fluxo de novas contas
- Contas criadas pela tela pública de **Criar conta** passam a ser gravadas como `active = false`.
- O cadastro público não realiza mais login automático.
- Após criar a conta, o usuário recebe a mensagem de que a solicitação foi enviada para aprovação.
- Uma conta pendente, mesmo com senha correta, recebe a mensagem **"Sua conta está aguardando aprovação do administrador."** e não entra no sistema.
- Contas já existentes permanecem com o estado atual; não há alteração automática nas contas já ativas.

## Nova aba administrativa
- Criada a aba **Aprovação de contas**.
- A aba aparece no menu lateral **somente para usuários com role ADMIN**.
- A API também exige role ADMIN, portanto acessar a URL manualmente não libera aprovação para outros perfis.
- A tela lista contas com `active = false`, mostrando nome, usuário, e-mail e data da solicitação.
- O administrador pode:
  - **Aprovar**: altera `active` para `true`, liberando o login imediatamente.
  - **Recusar**: remove a solicitação/conta pendente.

## Banco de dados
- Nenhuma migration foi criada.
- Foi reutilizado o campo `users.active` já existente para controlar aprovação, reduzindo o risco de divergência de migrations no banco Neon.
