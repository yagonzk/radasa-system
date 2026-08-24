# Cadastros documentais — Motoristas, Veículos e Chapas

## Financeiro
- O botão do ranking volta a aparecer apenas como **Clientes**.
- Internamente continua usando os clientes dos Romaneios.

## Motoristas
Novos dados:
- RG, nascimento, telefone, e-mail, endereço, cidade/UF/CEP.
- Data de admissão e salário.
- Número da CNH, registro, categoria, validade e primeira habilitação.
- Validade do MOPP.
- Validade do exame toxicológico.
- Observações.

Alertas:
- CNH vencida ou vencendo em até 30 dias.
- MOPP vencido ou vencendo em até 30 dias.
- Exame toxicológico vencido ou vencendo em até 30 dias.

## Veículos
Novos dados:
- Marca, modelo, placa, RENAVAM, chassi.
- Ano de fabricação/modelo, cor e combustível.
- Proprietário e RNTRC/ANTT.
- Validade do CRLV.
- Vencimento e situação do IPVA.
- Vencimento do licenciamento.
- Validade do seguro.
- Observações.

Alertas:
- CRLV, IPVA, licenciamento e seguro vencidos ou vencendo em até 30 dias.

## Chapas
A tela agora permite cadastrar e editar:
- CPF.
- Telefone.
- Cidade.
- Chave PIX.
- Valor fixo.

## Migration
`20260824173000_add_documentos_motoristas_veiculos`

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## Git
```powershell
git add .
git commit -m "feat: completa documentos de motoristas veiculos e chapas"
git push origin main
```
