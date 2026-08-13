# Correções v1.18 — Pedágios / erro 503

- Reduz a geometria enviada ao backend para no máximo 900 pontos.
- Localiza praças pela distância ao segmento da rota, preservando precisão mesmo com geometria compactada.
- Calcula as distâncias acumuladas da rota uma única vez em vez de recalcular para cada praça.
- Pré-filtra praças pelo corredor geográfico da rota antes dos cálculos pesados.
- Evita reconsolidar toda a base nacional O(n²) em cada requisição; apenas sobrepõe as correções manuais.
- No cálculo, consulta somente correções manuais do banco; registros automáticos materializados não são carregados sem necessidade.
- O endpoint `/api/pedagios/status` deixa de materializar centenas de registros no banco; a materialização continua disponível ao abrir o editor de pedágios.
- Aumenta o timeout específico do cálculo no cliente para 45 s, embora o objetivo principal seja reduzir bastante o tempo de processamento.

Essas mudanças atacam o `503` observado em rotas longas no Cloudflare Worker sem alterar o desenho completo da rota exibida no mapa.
