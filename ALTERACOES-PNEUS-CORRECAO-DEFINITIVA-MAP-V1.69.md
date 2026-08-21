# Radasa System v1.69 — Correção definitiva do erro ao salvar pneu

O stack do erro apontava `Array.flatMap` seguido de leitura de `.map`. A tela de Pneus
ainda montava o histórico usando `items.flatMap(... eventos.map(...))`.

Correções:
- removido completamente o `flatMap` do histórico de Pneus;
- histórico agora é montado por iteração segura e aceita registros antigos sem `eventos`;
- toda entidade Pneu vinda de API/cache é normalizada antes de chegar à página;
- `fotos`, `eventos`, `recapagens`, `consertos`, `medicoesSulco`, `calibragens` e `inspecoes` sempre viram arrays;
- campos antigos ausentes recebem valores seguros;
- fotos do formulário também são protegidas contra valor indefinido;
- cadastro continua aguardando a resposta real do backend antes de inserir o registro.

Sem migration nova nesta versão. A migration de ARO da v1.67 continua no histórico.
