# ALTERAÇÕES — ABASTECIMENTO V1.27

## Cadastro automático de produto pelo XML
- Ao confirmar o lançamento de um abastecimento, se um produto do XML ainda não estiver cadastrado, o sistema cria o produto automaticamente.
- O cadastro usa o nome do produto informado no XML e prioriza o código do próprio XML; na ausência dele, usa código ANP, EAN, NCM ou um código interno gerado.
- O produto criado automaticamente recebe a categoria `Combustível` no cadastro de produtos usado pelos abastecimentos.
- A criação acontece somente quando o lançamento é efetivado, não durante a simples leitura/conferência do XML.
- A importação continua permitindo associação manual com um produto já existente antes de lançar.
- Importações paralelas usam trava transacional para evitar duplicidade quando dois XMLs trazem o mesmo produto ao mesmo tempo.
- A tela informa quando um produto não associado será cadastrado automaticamente ao lançar.
- O resumo final informa quantos produtos foram criados automaticamente.

## Banco de dados
- Nenhuma migration nova.
- Foram alteradas apenas as regras de importação e a interface de conferência dos abastecimentos.
