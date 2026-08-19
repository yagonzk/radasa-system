# Radasa v1.8 — filtros de data e Vasilhame

## Filtros de data
- O calendário agora abre no mês da data já selecionada, em vez de voltar para o mês atual.
- Em filtros de intervalo, o campo **Até** abre no mesmo mês do campo **De** quando ainda estiver vazio.
- A correção é centralizada no `DatePicker`, portanto vale para Romaneios, Abastecimentos, Viagens e demais telas que usam o componente.

## Vasilhame
- Criado o tipo `Vasilhame` / enum PostgreSQL `VASILHAME`.
- A leitura de PDF reconhece descrições de vasilhame antes da regra de valor zero, evitando classificá-las como Bonificação - Lebrinha.
- O tipo aparece nos seletores, filtros e badges de Romaneios/Manifestos.
- `scripts/corrigir-vasilhames.sql` corrige itens já lançados com base no nome do produto cadastrado.

## Aplicação no banco existente
Execute uma vez, antes do deploy desta versão:

```powershell
pnpm run db:fix-vasilhames
```

O script é aditivo: adiciona o valor ao enum e atualiza somente a classificação dos itens de vasilhame. Não apaga tabelas, colunas ou registros.
