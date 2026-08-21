# Radasa System v1.79 — Aba Viagens readicionada

A aba **Viagens** foi readicionada ao menu lateral e à navegação do sistema.

## Funcionalidades preservadas
A implementação utiliza a página e o backend de Viagens que já permaneciam no projeto:
- registrar viagem;
- editar viagem;
- excluir viagem;
- visualizar detalhes;
- filtrar por motorista, placa e período;
- informar frete;
- destino e distância;
- pedágio;
- diária;
- abastecimento;
- chapa;
- acompanhar total de custos, custo por KM e lucro bruto.

Os serviços, API `/api/viagens`, modelo Prisma e dados históricos já estavam preservados,
portanto não foi necessária migration nova.

Também foi corrigido o `colSpan` da mensagem de tabela vazia de 9 para 10 colunas.
