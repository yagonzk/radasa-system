# V33.13 — Simplificação da estrutura do TMS

## Objetivo
Reduzir repetição visual e excesso de áreas no menu sem remover funcionalidades já existentes.

## Nova arquitetura de navegação
- Visão Geral
- Operação: Demandas, Romaneios, Viagens, Abastecimentos e Rotas
- Frota: Veículos, Pneus e Manutenção
- Gestão: Financeiro, Comissões, Almoxarifado, CIOT e BI Gerencial
- Cadastros: Pessoas, Clientes e produtos, Localidades e Empresa
- Administração: Central administrativa, Aprovação de contas e Logs

## Cadastros
A tela de Cadastros deixou de repetir os mesmos grupos do menu lateral em vários cartões. Agora usa uma única barra de subabas: Motoristas, Chapas, Veículos, Clientes, Produtos, Localidades e Empresa.

## Dashboard
O título foi simplificado para “Visão Geral”, reforçando o papel de cockpit operacional do TMS. Nenhum indicador ou dado foi removido.

## Compatibilidade
Nenhuma rota antiga foi removida e nenhuma tabela do banco foi alterada. Portanto, não há migration nova nesta versão.
