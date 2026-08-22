# Radasa System v1.90 — Fiscal automático pela aba Romaneios

## Correção da abordagem
A análise Cliente × Produto × Frete não depende mais da Tabela Comercial manual
criada na v1.89.

Agora todos os dados vêm diretamente de `Manifesto` / `ManifestoProduto`, isto é,
a mesma base exibida na aba **Romaneios**.

## Dados lidos automaticamente
Por cliente/produto:
- Cliente;
- Produto;
- Quantidade;
- Valor unitário;
- Valor total;
- Tipo de cobrança;
- Pago / a receber;
- Romaneio;
- Nota Fiscal / Série;
- Placa.

## Separação automática
### Cliente
Itens `Receber c/ Cliente`:
- Quantidade Cliente;
- Valor Unitário Cliente;
- Frete Cliente;
- Recebido;
- A Receber.

### Lebrinha
Itens `Acertar c/ Lebrinha` + `Bonificação - Lebrinha`:
- Quantidade Lebrinha;
- Valor Unitário Lebrinha;
- Acertar Lebrinha;
- Bonificação;
- Total Lebrinha.

## Comparação
O Fiscal calcula automaticamente:
- Diferença unitária Cliente × Lebrinha;
- Diferença total Cliente × Lebrinha;
- Percentual de diferença.

## Conferência
Foi adicionada uma tabela de conferência linha a linha com os mesmos registros
existentes nos Romaneios, permitindo verificar de onde cada número veio.

## Exportação
O XLSX agora possui:
- Resumo automático;
- Cliente x Produto;
- Linhas dos Romaneios.

## Banco
Nenhuma migration nova na v1.90.

A tabela histórica criada na v1.89 foi mantida no banco por compatibilidade, mas
não é mais necessária nem utilizada pela interface desta análise automática.
