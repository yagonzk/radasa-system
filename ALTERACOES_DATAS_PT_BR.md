# Padronização brasileira de datas e filtros

Alterações aplicadas:

- Calendário configurado com locale `pt-BR`.
- Meses e dias da semana exibidos em português.
- Semana iniciando no domingo.
- Datas exibidas no formato `DD/MM/AAAA`.
- Valores internos continuam em `AAAA-MM-DD` para manter ordenação e comparação corretas.
- Corrigido o filtro de data dos manifestos, que comparava formatos diferentes.
- Datas ISO passam a preservar o dia original, evitando alteração por conversão de fuso.
- Números de gráficos formatados com locale `pt-BR`.
- Idioma do HTML alterado para `pt-BR`.
- Nome dos arquivos CSV exportados usa data brasileira com hífens.

## Instalação

```bash
pnpm install
pnpm dev
```

O `node_modules` não foi incluído no arquivo final porque o diretório enviado estava incompleto e dependências devem ser reinstaladas pelo gerenciador de pacotes.
