# Radasa System v1.84 — Cidade de Entrega = Município Destino

- Corrigida a leitura do DAMDFE/MDF-e na aba **Viagens > Ler manifesto**.
- O campo **Cidade de Entrega** agora recebe exclusivamente o **Município Destino** do bloco **Origem/Destino**.
- O sistema não tenta mais substituir a cidade por nomes encontrados em clientes, endereços, Locais ou histórico.
- No manifesto de referência, a leitura correta é **Colniza / MT**.
- O Município Origem continua sendo usado somente para cálculo de distância.
- Demais campos (placa, motorista, frete e data) permanecem inalterados.

Sem migration nova.
