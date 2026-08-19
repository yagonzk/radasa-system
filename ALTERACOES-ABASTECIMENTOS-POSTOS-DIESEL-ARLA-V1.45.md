# Radasa System v1.45 — Postos corretos + Diesel/ARLA

## Postos das notas
- O vínculo do posto passou a usar prioritariamente o CNPJ exato do emitente da NF-e.
- Quando há CNPJ no XML/PDF, não existe mais associação aproximada por palavras do nome do posto.
- Se o posto ainda não existir no cadastro, ele é criado com os dados do emitente da nota.
- A listagem de Abastecimentos executa uma correção segura dos registros antigos, reassociando cada abastecimento ao posto correspondente ao CNPJ/nome do emitente já salvo na NF-e.
- A interface também exibe o emitente correto imediatamente, mesmo antes de um novo carregamento da lista de clientes.

## Diesel e ARLA
- Produtos são classificados como Diesel, ARLA ou Outro.
- A soma operacional de litros considera somente Diesel/Diesel S10.
- ARLA é exibido separadamente e não entra no total de litros Diesel.
- ARLA não entra na média de KM/L.
- O custo médio por litro considera somente o valor e os litros de Diesel.
- Na importação XML/PDF, ARLA não pode ser sugerido como Diesel e Diesel não pode ser sugerido como ARLA.
- Relatório, conferência em massa e tabela mostram Diesel e ARLA separadamente.

## Banco de dados
- Não há migration nova.
- Nenhum abastecimento é apagado.
