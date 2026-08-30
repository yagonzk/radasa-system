# Correção da importação XLSX - erro 503

- Importação de romaneios via XLSX agora grava em lotes de 5 romaneios.
- Erros transitórios 502/503/504 são repetidos automaticamente até 4 vezes com espera progressiva.
- Se um lote continuar falhando, somente aquele lote é marcado como pendente; a importação continua.
- Há uma pausa curta entre lotes para reduzir rajadas contra Cloudflare/Neon.
- A barra de progresso continua mostrando quantos romaneios já foram processados.
