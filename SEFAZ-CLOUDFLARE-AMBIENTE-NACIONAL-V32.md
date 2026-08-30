# SEFAZ automática no Cloudflare — V32

Esta versão usa o Web Service oficial **NFeDistribuicaoDFe** do Ambiente Nacional:

- Endpoint: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- Operação: `nfeDistDFeInteresse` / `distNSU`
- Transporte no Cloudflare: binding mTLS `SEFAZ_MTLS`
- Processamento: até 10 documentos por execução
- Scheduler: Worker acorda a cada 5 minutos
- Proteção SEFAZ: após `cStat 137` ou `656`, nenhuma nova chamada é enviada por 1 hora
- Destino: NF-e identificada como combustível é lançada diretamente em **Abastecimentos**

## Importante sobre o certificado

O certificado A1 continua cadastrado na aba Empresa para controle administrativo/validade, mas o Cloudflare Worker precisa de uma cópia do mesmo certificado em um **mTLS binding**, pois Workers não conseguem criar dinamicamente um binding mTLS a partir do PFX guardado no banco.

## Configuração do binding

Converta o PFX para PEM localmente (não envie senha/chave privada para terceiros):

```powershell
openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem
openssl pkcs12 -in certificado.pfx -nocerts -nodes -out key.pem
```

Envie para a Cloudflare:

```powershell
npx wrangler mtls-certificate upload --cert cert.pem --key key.pem --name radasa-sefaz
```

Copie o `certificate_id` retornado e adicione em `wrangler.jsonc`:

```jsonc
"mtls_certificates": [
  { "binding": "SEFAZ_MTLS", "certificate_id": "SEU_CERTIFICATE_ID" }
],
```

Depois publique normalmente.

## Status / Forçar atualização

O botão **Status** mostra a próxima janela real. O botão **Forçar atualização** executa imediatamente somente se a janela da SEFAZ permitir; após 137/656 ele informa o tempo restante em vez de gerar consumo indevido.
