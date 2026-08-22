# Radasa System v1.82 — Motorista vinculado à placa

## Cadastros > Veículos
- Adicionado campo **Motorista vinculado** no cadastro e edição de cada placa.
- O cadastro exige a seleção de um motorista.
- A listagem de veículos mostra uma nova coluna **Motorista vinculado**.
- A pesquisa de veículos também encontra pelo nome do motorista.
- Veículos antigos permanecem compatíveis; até serem editados, podem aparecer como **Não vinculado**.

## Viagens > Ler romaneio
- Ao identificar a placa do romaneio, o sistema procura primeiro o motorista vinculado àquela placa.
- Se o motorista vinculado estiver ativo, ele é preenchido automaticamente no pop-up de Registrar Viagem.
- O vínculo da placa tem prioridade sobre a tentativa de reconhecer o nome do motorista pelo OCR.
- Se não houver vínculo válido, o OCR continua sendo usado como fallback.
- Ao selecionar uma placa manualmente no cadastro de Viagem, o motorista vinculado também é selecionado automaticamente.

## Banco
Nova coluna opcional `veiculos.motoristaId`, relacionada a `motoristas.id` com `ON DELETE SET NULL`.
A migration é idempotente e preserva os veículos já existentes.
