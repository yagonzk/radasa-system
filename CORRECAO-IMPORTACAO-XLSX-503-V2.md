# Correção importação XLSX 503 V2

- Importação XLSX passou a enviar **1 romaneio por requisição**.
- Clientes e produtos faltantes são resolvidos/criados no servidor dentro da mesma chamada do romaneio.
- Removidos os centenas de POSTs prévios de clientes/produtos que geravam rajadas no Cloudflare/Neon.
- Retry automático (até 5 tentativas) para 429/502/503/504.
- Um erro não interrompe os demais romaneios.
- Ao final, apenas a lista de romaneios é recarregada, evitando quatro consultas grandes simultâneas.
