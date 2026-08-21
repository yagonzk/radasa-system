# Radasa System v1.68 — Correção ao salvar pneus

## Problema
Ao salvar um novo pneu, o hook genérico adicionava imediatamente um registro otimista no estado da tela. Esse registro ainda não possuía as relações completas retornadas pelo backend (`eventos`, `fotos`, etc.). A aba de Pneus renderizava o histórico e tentava executar `.map()` em `eventos` antes da resposta da API, causando `Cannot read properties of undefined (reading 'map')`.

## Correção
- O recurso Pneus passa a aguardar a resposta real do backend antes de inserir/alterar o item no estado local.
- O hook CRUD genérico ganhou opção para desativar atualização otimista por recurso, sem alterar o comportamento dos demais módulos.
- A tela de Pneus também foi protegida para tratar `fotos` e `eventos` ausentes como listas vazias.
- Cadastro, edição e migration ARO da v1.67 foram preservados.

Sem migration nova.
