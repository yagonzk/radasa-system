# Radasa System V33.53 — Ajustes em Manutenções da Frota

## Ordem de Serviço
- Problema relatado / motivo deixou de ser obrigatório no frontend e no backend.
- Removidos da criação da OS os campos: Peças adicionais, Mão de obra adicional e Outros custos.
- A seção Custos agora exibe somente Desconto e Total da OS.
- O total da OS é calculado pela soma dos itens adicionados menos o desconto.
- O resumo de custos da visualização da OS também exibe somente Desconto e Total OS.
- O rótulo "Unit." dos itens foi alterado para "Valor unit.".

## Fornecedor / Oficina
- O seletor simples foi substituído por um combobox pesquisável.
- É possível digitar nome fantasia, razão social, cidade ou UF para filtrar fornecedores.
- Mantida a opção de deixar a OS sem fornecedor/oficina.
- O comportamento segue o padrão de pesquisa utilizado em Romaneios.

## Compatibilidade
- Nenhuma migration foi criada.
- Os campos antigos de custo continuam no banco para preservar OS já existentes.
