# Importação rápida de Romaneios 2026

Foi adicionada na aba **ROMANEIOS** a opção **Importar XLSX**.

Fluxo:
1. Abra ROMANEIOS.
2. Clique em **Importar XLSX**.
3. Selecione `ROMANEIOS_2026_IMPORTACAO_RAPIDA.xlsx`.
4. O sistema lê a aba `ROMANEIOS`, agrupa os itens pelo campo `Arquivo`, vincula placa cadastrada e procura clientes/produtos pelos códigos internos.
5. Clientes e produtos ausentes são criados automaticamente.
6. Os romaneios são enviados ao backend em lotes de 20, usando a validação de duplicidade já existente.

A planilha contém 2.601 itens extraídos de 204 PDFs digitais. Os 18 PDFs escaneados ficaram listados na aba `PENDENTES_OCR` e devem ser importados pelo leitor de PDF/OCR após a carga principal.

CT-e foi desconsiderado.
