# Radasa System — Fases 8, 10, 11 e 13 integradas

## Fase 8 — BI e Relatórios avançados
- BI Gerencial com identidade visual preservada.
- Filtros pesquisáveis.
- Produtos originados dos Romaneios.
- Faturamento por quantidade do Romaneio × preço de venda.
- Preço padrão por produto e preço específico por cliente/vigência.
- Botão **Preços do BI**.
- Diagnóstico de dados: produtos sem preço, itens sem cliente, sem placa, sem produto e sem NF.
- Análises por Produto, Cliente e Veículo.
- Evolução mensal, consulta detalhada, XLSX e PDF.

## Fase 10 — Portal do Motorista
- Novo acesso **Operação > Portal Motorista**.
- Usuário pode ser vinculado a um motorista.
- Vencimentos de CNH, MOPP e toxicológico.
- Exibe somente as viagens do motorista vinculado.
- Origem, cidades intermediárias, destino, distância e status.
- Registro de saída, entrega, ocorrência e despesa.
- Despesa do motorista gera lançamento no Financeiro.
- Histórico de atividades.
- CIOTs e CT-es vinculados ao motorista.

## Fase 11 — Comercial / CRM
- Novo grupo **Comercial > CRM e Propostas**.
- Dashboard comercial.
- Propostas de frete.
- Frete proposto, custo estimado e margem prevista automática.
- Tabelas de frete padrão ou por cliente.
- Frete fixo, valor/km e vigência.
- Contratos por cliente, vigência, status e índice de reajuste.

## Fase 13 — Administração e Segurança
- Nova **Central administrativa**.
- Usuários, perfis e ativação.
- Vínculo usuário ↔ motorista.
- Permissões granulares por módulo.
- Navegação e backend respeitam permissões explícitas.
- ADMIN mantém acesso irrestrito.
- Usuários antigos sem permissões configuradas mantêm o comportamento anterior.
- Configurações gerais persistidas.
- Auditoria ampliada com detalhes das mutações, removendo campos de senha/sigilos.

## Migration
`20260824224000_fases_8_10_11_13`

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## GitHub
```powershell
git add .
git commit -m "feat: integra fases 8 10 11 e 13 do TMS"
git push origin main
```

## Primeira configuração
1. Entre com ADMIN.
2. Abra **Administração > Central administrativa**.
3. Vincule cada conta de motorista ao cadastro correto.
4. Configure permissões apenas quando quiser restringir um usuário.
5. No BI, preencha os produtos sem preço em **Preços do BI**.
6. Em **Comercial > CRM e Propostas**, cadastre propostas, tabelas e contratos.
