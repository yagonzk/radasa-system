# AJUSTE SEFAZ EM LOTES — V28

- Sincronização SEFAZ limitada a 10 documentos por execução.
- O NSU avança somente até o último documento efetivamente processado.
- Se houver mais documentos, eles ficam pendentes para a próxima execução.
- Cron automático continua a cada 5 minutos e processa apenas um lote por empresa em cada disparo.
- Botão Forçar atualização processa um lote imediatamente, sem tentar drenar toda a fila de uma vez.
- Frontend informa quando ainda existem documentos pendentes.
- Objetivo: evitar timeout/erro interno do servidor quando existe grande volume acumulado de NF-e.
