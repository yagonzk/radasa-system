# Correção TypeScript V30.1

- Adicionada a função `decodeChunkedBody` usada pelo transporte TLS direto da SEFAZ.
- O decoder agora trata tamanho hexadecimal, extensões de chunk, CRLF e respostas incompletas com mensagens de diagnóstico.
- Corrige o erro TS2304 em `server/services/sefaz-dfe.service.ts`.
