# Perfil, alteração de senha e logs

## Funcionalidades
- Clique no avatar do usuário na barra lateral para abrir o menu.
- **Alterar senha** exige senha atual, nova senha e confirmação.
- **Ver logs** lista username, e-mail, alteração e data/hora.
- Alterações de cadastro, viagens, manifestos, comissões e senha são registradas automaticamente.

## Atualizar o banco
Depois de substituir o projeto, execute:

```bash
pnpm db:generate
pnpm db:deploy
pnpm dev
```

A migration `20260803030000_add_audit_logs` cria a tabela necessária.
