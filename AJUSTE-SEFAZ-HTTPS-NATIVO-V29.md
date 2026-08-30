# Ajuste SEFAZ HTTPS nativo — V29

- Removido o parser HTTP manual sobre `node:tls` que gerava `Resposta HTTP inválida da SEFAZ`.
- A consulta da Distribuição DF-e agora usa `node:https.request`, com o certificado A1 (`pfx`) e a senha cadastrados na aba Empresa apresentados diretamente no handshake mTLS.
- O cliente HTTPS passa a cuidar de status HTTP, headers, chunked transfer e encerramento da conexão.
- Falhas de transporte/mTLS são gravadas em `sefazSyncState`, permitindo que o popup Status exiba a causa real da última tentativa.
- Respostas HTTP não-2xx incluem um trecho curto da resposta da SEFAZ para diagnóstico.
- Mantido o processamento em lotes de até 10 documentos e o Cron automático a cada 5 minutos.
