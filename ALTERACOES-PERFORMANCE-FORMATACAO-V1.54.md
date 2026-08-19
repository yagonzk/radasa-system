# Radasa System v1.54 — Performance e formatação

## Objetivo
Reduzir o tempo percebido de carregamento das principais listagens (Cadastros, Romaneios e Abastecimentos) e corrigir o aperto/sobreposição dos cards da mini dashboard de Abastecimentos em resoluções menores.

## Performance

### Cache de coleções com stale-while-revalidate
- Cadastros e listagens operacionais passam a reaproveitar o último snapshot válido da sessão.
- Ao voltar para uma página ou recarregar a mesma aba, o snapshot pode ser exibido imediatamente enquanto a API revalida os dados em segundo plano.
- TTL de recursos pesados (Abastecimentos/Romaneios/etc.): 30 segundos.
- TTL de cadastros: 2 minutos.
- Requisições simultâneas para o mesmo recurso compartilham a mesma Promise e não duplicam consultas.
- Logout/troca de token limpa o cache da sessão.

### Cadastros
- Ao abrir Cadastros, a aba visível continua sendo priorizada.
- Após 250 ms, os demais cadastros são pré-carregados em background para acelerar a troca entre Clientes, Produtos, Veículos, Motoristas, Chapas, Locais e Empresa.

### Abastecimentos
- A listagem deixou de executar a sincronização histórica de postos antes de responder.
- PDF e XML armazenados deixam de ser enviados em base64 na listagem geral.
- A listagem recebe apenas flags `pdfStored`/`xmlStored`.
- PDF/XML são carregados sob demanda ao visualizar, baixar ou editar o abastecimento.
- Isso reduz significativamente o tamanho da resposta quando existem muitos documentos armazenados.

### Romaneios
- A listagem deixou de consultar novamente toda a tabela de veículos apenas para enriquecer placa/modelo.
- O enriquecimento usa a coleção de veículos que o frontend já possui.
- A leitura completa de um romaneio específico continua preservando o comportamento anterior quando necessária.

## Formatação — mini dashboard de Abastecimentos
- Cards receberam `min-width: 0` e controle de overflow.
- Ícone de ocultar/exibir valor foi movido para a linha do título, evitando sobreposição com o valor monetário.
- Valores usam tamanho responsivo e truncamento seguro com o valor completo disponível no `title`.
- Títulos podem quebrar linha sem empurrar outros elementos para fora do card.
- Mantidos os 6 indicadores e a disposição responsiva existente.

## Banco de dados
- Nenhuma migration nova nesta versão.
