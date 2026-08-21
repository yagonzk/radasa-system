# Radasa System v1.72 — Valor de compra em Reais

No cadastro/edição de pneus, o campo **Valor de compra** passa a trabalhar no padrão monetário brasileiro.

- aceita `1234,56`;
- aceita `1.234,56`;
- também aceita `1234.56` ao colar valores;
- ao sair do campo, exibe `R$ 1.234,56`;
- ao salvar, converte corretamente para o valor numérico usado pelo banco;
- ao editar um pneu existente, o valor já abre formatado em Reais.

Sem migration nova.
