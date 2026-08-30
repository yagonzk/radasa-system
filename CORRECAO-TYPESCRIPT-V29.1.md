# Correção TypeScript V29.1

Corrigidos os 4 erros reportados pelo `pnpm run check`:

- `req.params.id` normalizado para `string` em `sefaz-dfe.controller.ts`.
- `clientCodes` tipado explicitamente como `string[]` em `manifestos.service.ts`.
- `productCodes` tipado explicitamente como `string[]` em `manifestos.service.ts`.
- Callback de produtos da NF-e ajustado para lidar com a tipagem inferida do campo `combustivel` em `sefaz-dfe.service.ts`.

Nenhuma migration nova foi criada.
