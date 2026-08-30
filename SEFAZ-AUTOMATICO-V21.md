# SEFAZ automática - V21

Esta versão adiciona `Fiscal > Documentos Fiscais` e integração com o serviço oficial `NFeDistribuicaoDFe` usando `distNSU` sequencial.

## O que foi implementado

- controle persistente de `ultNSU` e `maxNSU` por empresa;
- proteção contra novas consultas por 1 hora após `cStat 137` ou `656`;
- armazenamento do XML original retornado pela SEFAZ;
- deduplicação por chave de acesso;
- classificação automática em `ABASTECIMENTO`, `MANUTENCAO` ou `OUTRO`;
- importação automática em Abastecimentos quando o XML completo possui posto, placa/veículo e dados suficientes;
- documentos de manutenção/peças ficam na central fiscal para conferência;
- resumos `resNFe` ficam pendentes até que o documento completo esteja disponível;
- download do XML diretamente pela nova tela.

## Cloudflare Workers e certificado A1

O certificado A1 já cadastrado na Empresa continua válido para os módulos que rodam com Node/TLS. Porém, em produção no Cloudflare Workers, `https.Agent` não suporta opções TLS como `pfx` e `passphrase`. Por isso a chamada SEFAZ usa o binding mTLS `SEFAZ_MTLS` quando está no Worker.

O certificado precisa ser cadastrado uma única vez no Cloudflare usando `wrangler mtls-certificate upload`, e o `certificate_id` precisa ser ligado ao binding `SEFAZ_MTLS` no `wrangler.jsonc`. Veja `COMANDOS-ATUALIZACAO-SEFAZ-V21.txt`.

## NFS-e

NFS-e municipal não é distribuída pelo `NFeDistribuicaoDFe`. Esta versão cobre NF-e de combustível, peças e produtos de manutenção. Para serviços emitidos por NFS-e será necessário integrar o padrão nacional ou o provedor da prefeitura correspondente.
