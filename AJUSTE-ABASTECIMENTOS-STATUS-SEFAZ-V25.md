# Ajuste Abastecimentos + Status SEFAZ V25

- Removido o botão externo `Importar XML/PDF` do cabeçalho de Abastecimentos.
- Adicionado botão `Status` no lugar.
- O botão `Status` abre um popup com:
  - situação da sincronização automática;
  - última verificação;
  - próxima verificação;
  - última NF-e importada em Abastecimentos;
  - situação e validade do certificado A1 da Empresa;
  - mensagem retornada pela SEFAZ.
- A rotina automática do Cloudflare foi alterada de 15 para 5 minutos (`*/5 * * * *`).
- A importação em massa de XML/PDF foi movida para dentro de `Novo Abastecimento`.
- Dentro de Novo Abastecimento continuam disponíveis tanto a importação individual quanto a importação em massa.
- O popup de status não exibe NSU ao usuário.
