# AJUSTE SEFAZ — TRANSPORTE DIRETO V30

## Motivo
A V29.1 usava `node:https` com `pfx`/`passphrase`. No Cloudflare Workers essas opções TLS do cliente HTTP não são suportadas; o módulo é implementado sobre `fetch`. Isso impedia que o certificado A1 cadastrado na Empresa fosse efetivamente apresentado como esperado e o Ambiente Nacional retornava HTTP 520.

## Alterações
- Mantido o endpoint oficial do Ambiente Nacional: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`.
- Mantido o método SOAP `nfeDistDFeInteresse`.
- Removido `node:https` da consulta DF-e.
- Retornada a conexão direta via `node:tls`, usando o PFX e a senha cadastrados na Empresa.
- Forçado ALPN para `http/1.1` para evitar negociação incompatível com o parser HTTP direto.
- Parser HTTP reforçado para HTTP/1.x e `Transfer-Encoding: chunked`.
- Tratamento tanto de `end` quanto de `close`.
- Logs agora mostram host, path, protocolo TLS, ALPN, status HTTP e tamanho da resposta.
- Erros sem bytes HTTP agora informam se o handshake TLS foi concluído e se o certificado do servidor foi autorizado.

## Diagnóstico
Após publicar, executar `npx wrangler tail --format pretty` e usar **Abastecimentos > Status > Forçar atualização**.
