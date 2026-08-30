# CORREÇÃO CLOUDFLARE ALPN — V30.2

- Removida a opção `ALPNProtocols` da conexão `node:tls` usada na sincronização SEFAZ.
- Motivo: Cloudflare Workers retorna `ERR_OPTION_NOT_IMPLEMENTED` para `options.ALPNProtocols`.
- A requisição continua sendo montada explicitamente como HTTP/1.1 (`POST ... HTTP/1.1`), portanto não depende de negociação ALPN para usar HTTP/1.1.
- Mantidos logs detalhados `[sefaz-transport]` para diagnóstico da próxima etapa do handshake/resposta SEFAZ.
