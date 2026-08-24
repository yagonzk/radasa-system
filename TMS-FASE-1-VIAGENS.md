# Radasa TMS — Fase 1: Núcleo de Viagens

## Implementado
- Viagem promovida a núcleo operacional do TMS.
- Numeração automática RAD-00001, RAD-00002...
- Status: Planejada, Carregando, Em trânsito, Entregue, Concluída e Cancelada.
- Vínculo opcional com Cliente e obrigatório com Motorista/Veículo nas novas viagens.
- Origem/UF, destino/UF, distância, saída, previsão de chegada e chegada real.
- Receita de frete e custos operacionais existentes.
- Indicadores automáticos: custo total, lucro, margem, custo/km e lucro/km.
- Dashboard local da aba Viagens com operação, receita, custos e resultado.
- Busca por código, placa, motorista, cliente, origem/destino e filtro por status.
- Banco preparado para vincular Romaneios, Abastecimentos e CIOT à Viagem.
- Nova tabela `viagem_despesas` preparada para custos extras por viagem.
- Migração preserva viagens antigas e tenta vincular automaticamente o veículo pela placa.

## Compatibilidade
Os registros antigos de `viagens` são preservados. Na migração, eles recebem numeração sequencial e status histórico `CONCLUIDA`. Novas viagens passam a iniciar como `PLANEJADA`.

## Próxima fase sugerida
Implementar o vínculo operacional pela interface: adicionar/remover Romaneios, Abastecimentos, CIOT e despesas dentro da ficha da viagem, criando uma timeline única da operação.

## Publicação
No terminal, na raiz do projeto:

```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

Para publicar no GitHub antes do deploy:

```powershell
git add .
git commit -m "feat: inicia TMS completo com nucleo de viagens"
git push origin main
```
