# V33.10 — PDFs de CNH, toxicológico e CRLV

- Cadastro de Motoristas: upload de CNH em PDF e exame toxicológico em PDF.
- Cadastro de Veículos: upload de CRLV em PDF.
- Áreas aceitam arrastar e soltar ou clique para selecionar.
- Limite: 10 MB por PDF.
- Arquivos ficam persistidos no banco e não são enviados nas listagens; a API retorna apenas nome/flag e entrega o PDF sob demanda.
- É possível visualizar e remover o documento já cadastrado.
- Nova migration: `20260828131500_add_pdf_documentos_motoristas_veiculos`.
