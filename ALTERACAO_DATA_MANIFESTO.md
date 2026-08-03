# Campo Data do Manifesto

- Adicionado o campo obrigatório **Data do manifesto** em Novo Manifesto.
- Adicionado o mesmo campo em Editar Manifesto, preenchido com a data salva.
- A data é armazenada em `dataManifesto` no formato interno `AAAA-MM-DD`.
- A listagem, visualização e filtro de data usam a data do manifesto.
- Manifestos antigos continuam compatíveis usando `createdAt` como data de fallback.
