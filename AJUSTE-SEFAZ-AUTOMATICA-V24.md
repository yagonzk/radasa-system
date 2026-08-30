# SEFAZ automática V24

- Removida a subaba **Documentos Fiscais** do menu Fiscal e a rota correspondente no frontend.
- Removida a dependência da interface de atualização manual de NSU.
- Adicionado Cron Trigger do Cloudflare a cada 15 minutos.
- O cron percorre empresas ativas com certificado A1 e senha cadastrados na aba Empresa.
- A consulta usa o certificado A1 armazenado na empresa; em Cloudflare a conexão TLS é aberta diretamente para o Web Service da SEFAZ.
- NF-e reconhecida como abastecimento continua sendo enviada diretamente para Abastecimentos, com a chave da NF-e usada para impedir duplicidade.
- O NSU continua sendo mantido apenas internamente no banco.
