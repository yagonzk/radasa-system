# V33.29 - Correção TypeScript SEFAZ

Corrige o erro TS2322 em `server/services/sefaz-dfe.service.ts` ao atribuir `imported.abastecimentoId` a uma variável tipada como `string | null`.

Alteração:

```ts
abastecimentoId = imported.abastecimentoId ?? null;
```

Sem alteração de banco de dados e sem migration.
