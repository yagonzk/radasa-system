# ALTERAÇÕES — ABASTECIMENTOS V1.43

## Placa e modelo do veículo
- A coluna de veículo em Abastecimentos agora exibe **Placa / Modelo**.
- O modelo é sempre enriquecido a partir do cadastro atual de **Veículos**.
- Abastecimentos antigos ligados a um cadastro duplicado da mesma placa sem modelo passam a usar, na tela e nos filtros, o cadastro equivalente da placa que possui modelo.
- O filtro de **Placa / Modelo** foi corrigido para comparar placa/modelo normalizados, evitando falha por hífen, espaços e outros separadores.
- A lista do filtro contém apenas veículos realmente presentes nos abastecimentos e já mostra `PLACA - MODELO`.
- O relatório PDF também passou a exibir `Placa / Modelo`.
- A tela de detalhes mostra `Placa / Modelo`.
- Seletores de veículo no cadastro/importação evitam duplicar a mesma placa e priorizam o cadastro que possui modelo.
- A Média KM/L agrupa por placa normalizada, evitando separar a mesma placa quando houver registros históricos vinculados a IDs de veículo duplicados.

## Banco de dados
- Nenhuma migration nova.
- Nenhum abastecimento é apagado ou recriado.
