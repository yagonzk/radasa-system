# SEFAZ V33.4 — Loop permanente + importação automática de abastecimentos

- O Agente SEFAZ permanece em loop enquanto estiver aberto/rodando no Windows.
- A cada 30 segundos ele atualiza o heartbeat e reprocessa localmente NF-e completas já recebidas que foram classificadas como ABASTECIMENTO e ainda estão NOVO/PENDENTE/ERRO.
- Quando uma NF-e de combustível puder ser vinculada a posto e veículo, ela é lançada automaticamente em Abastecimentos.
- Uma falha de vínculo/importação não para o agente e não bloqueia a próxima consulta SEFAZ.
- O agente tenta consultar a SEFAZ periodicamente e drena lotes em sequência quando `ultNSU < maxNSU`.
- Quando a SEFAZ exige espera (cStat 137, cStat 656 ou fila alcançada), o agente NÃO faz requisições durante 1 hora, mas continua vivo e processando a fila local. Ao liberar a janela, volta a consultar automaticamente.
- Isso evita transformar o loop em consultas agressivas que causariam `656 - Consumo Indevido`.
