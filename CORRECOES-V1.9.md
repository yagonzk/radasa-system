# Radasa v1.9 — CSV por romaneio e resumo de vasilhames

## CSV por romaneio
- Todo romaneio cadastrado agora possui ação **Baixar CSV**, independentemente de existir PDF armazenado.
- O CSV usa `;` como separador e BOM UTF-8 para abrir corretamente no Excel em pt-BR.
- Cada linha representa um item do romaneio e inclui romaneio, data, cliente, produto, NF/série, quantidade, valores, cobrança, situação de pagamento, placa, modelo e transportadora.
- O botão existe tanto na tabela principal quanto na janela de inspeção do romaneio.

## Resumo por cobrança
- Para **Receber c/ Cliente**, **Acertar c/ Lebrinha** e **Bonificação - Lebrinha**, o total permanece monetário.
- Para **Vasilhame**, o total exibido passa a ser a soma de `quantidade`, não o valor monetário nem apenas a quantidade de linhas.
- Exemplo: um item Vasilhame com quantidade 400 aparece como **400 un.** no resumo.

## Banco de dados
- Nenhuma migration ou alteração de schema é necessária para esta versão.
