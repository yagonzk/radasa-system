# DRE Operacional — importação de extrato

Alterações:
- `DRE Gerencial` foi renomeado para **DRE Operacional**.
- O botão **Importar pedágios/chapas** foi removido da aba **Viagens**.
- O card **DRE Operacional** agora possui o botão **Importar extrato**.
- É possível selecionar um ou vários CSVs TruckPag.
- Os lançamentos reconhecidos são gravados diretamente no Financeiro:
  - Pedágio → categoria `Pedágios`;
  - Chapa → categoria `Chapas`.
- Os lançamentos entram como **DESPESA / PAGO**, com baixa automática na mesma data.
- O mesmo lançamento não é importado duas vezes: o sistema usa uma impressão digital do movimento.
- PIX de R$ 248,00 é ignorado conforme regra definida.
- Não há vínculo obrigatório com Viagem.
- Não há migration nova nesta alteração.

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```

## Git
```powershell
git add .
git commit -m "feat: move importacao TruckPag para DRE Operacional"
git push origin main
```
