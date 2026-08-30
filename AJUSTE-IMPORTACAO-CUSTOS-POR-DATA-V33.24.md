# V33.24 — Importação automática de Diária, Chapa e Pedágio por viagem

## O que mudou

Na aba **Acerto de Viagem** foi adicionada uma área de soltar arquivo, sem criar um novo botão no cabeçalho.

Ao soltar ou selecionar uma planilha XLSX/XLS/CSV, o sistema:

1. lê a data da viagem e a placa;
2. procura a viagem exatamente pela combinação **Data do manifesto + Placa**;
3. quando existir mais de uma viagem com a mesma data e placa, usa o **Motorista** para desempatar;
4. preenche automaticamente **Diária**, **Chapa** e **Pedágio**;
5. atualiza os cálculos de custo, custo/km e lucro bruto já existentes;
6. não soma o valor novamente ao reimportar a mesma planilha: os valores da planilha passam a representar o total daquela viagem;
7. placas com ou sem hífen são equivalentes (ex.: RAQ5F96 = RAQ-5F96);
8. linhas sem viagem correspondente ou ambíguas não são lançadas silenciosamente e entram na contagem de conferência.

## Colunas reconhecidas

Formato recomendado:

- `DATA_VIAGEM`
- `PLACA`
- `MOTORISTA`
- `DIARIA`
- `CHAPA`
- `PEDAGIO`

Também são aceitas variações usuais de maiúsculas/minúsculas e acentos para os campos de custo.

## Compatibilidade com TruckPag já importado

Se a viagem já tiver pedágio/chapa registrados em `viagem_despesas_extrato`, a importação calcula o valor manual necessário para que o total mostrado na tela seja exatamente o valor informado na planilha, evitando duplicação visual do custo.

## Banco de dados

Nenhuma migration nova é necessária para esta versão.
