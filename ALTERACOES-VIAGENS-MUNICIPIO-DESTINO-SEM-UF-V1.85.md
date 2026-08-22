# Radasa System v1.85 - Municipio Destino robusto no DAMDFE

## Correção
- Corrigida a leitura do campo **Cidade de Entrega** para manifestos em que o **Município Destino aparece sem a UF ao lado**.
- O parser agora localiza explicitamente o rótulo `Municipio Destino` e procura o valor correspondente, sem reutilizar o `Municipio Origem`.
- Suporta tanto a ordem lógica do PDF.js quanto a disposição visual em colunas do DAMDFE.
- Quando a UF não aparece ao lado do Município Destino, usa `UF Descareg.` do cabeçalho do manifesto.

## Manifesto Adriano usado na validação
- Placa: RAQ5F96
- Condutor: ADRIANO DE SOUZA PEREIRA
- Município Origem: Ipiranga do Norte / MT
- Município Destino: São José do Rio Claro
- UF Descareg.: MT
- Cidade de Entrega esperada: São José do Rio Claro

Também foi mantida a validação do manifesto anterior: Ipiranga do Norte / MT -> Colniza / MT.

Sem migration nova.
