# Radasa System v1.88 — Comissões automáticas pela aba Viagens

## Novo fechamento
Ao criar um novo fechamento de comissão:
1. selecione o motorista;
2. selecione Data Início e Data Fim;
3. o sistema busca automaticamente as viagens desse motorista no período;
4. cada Cidade de Entrega é comparada com **Cadastros > Locais**;
5. as viagens são agrupadas por local e a quantidade é preenchida automaticamente.

O preenchimento automático ocorre apenas em **Novo Fechamento**. A edição de fechamentos existentes preserva os dados já salvos.

## Regra fixa de comissão
- **Colniza:** R$ 350,00 por viagem;
- **qualquer município do Pará:** R$ 300,00 por viagem;
- **qualquer outro município:** R$ 275,00 por viagem.

## Cadastros > Locais
Foi adicionado o campo **UF**. O valor da comissão deixou de ser digitado manualmente e agora é calculado pela regra acima.

Para compatibilidade com locais antigos:
- locais que já estavam em R$ 300,00 são migrados como PA;
- Colniza é sempre R$ 350,00;
- os demais passam a R$ 275,00.

Se uma Cidade de Entrega da aba Viagens não estiver cadastrada em Locais, o fechamento mostra um aviso e não inclui essa viagem até o local ser cadastrado.

## Banco
Nova coluna opcional `locais.uf` e índice para UF.
