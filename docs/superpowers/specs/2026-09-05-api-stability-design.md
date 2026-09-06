# Estabilidade de API e Acerto de Viagem — Design

## Objetivo
Reduzir quedas sob rajadas de requisições, principalmente em edições repetidas de Acerto de Viagem, sem alterar regras de negócio de abastecimentos, comissão ou DRE.

## Decisões
- Manter Prisma Client por request no Cloudflare Worker. O Hyperdrive fará pooling de origem quando configurado; não compartilhar sockets de `pg` globalmente entre requests.
- Reduzir o pool local para evitar fan-out de conexões quando o fallback `DATABASE_URL` direto for usado.
- Serializar atualizações da mesma viagem no PostgreSQL com `SELECT ... FOR UPDATE` dentro de transação curta.
- Adicionar `editVersion` em `Viagem`; o cliente envia a versão lida e uma gravação stale recebe HTTP 409.
- Sincronizar vínculos de abastecimento por diferença: preservar existentes, remover apenas retirados e criar apenas novos.
- Resolver comissão e abastecimentos dentro da mesma transação da viagem, reduzindo janela de corrida.
- Retornar a viagem completa pela própria transação, evitando refetch após update.
- Adicionar request ID e mutation ID aos logs e resposta para diagnóstico.
- Tratar falhas transitórias de Postgres/Prisma como 503 com `Retry-After`, não como 500 genérico.
- Aplicar burst protection somente em mutações; GETs permanecem fora desse limitador.
- Limitar concorrência do `/api/bootstrap` para evitar uma rajada de consultas paralelas ao abrir telas.
- Retry automático apenas para GET em falhas transitórias. Nunca repetir PUT/POST/DELETE automaticamente.
- Manter suporte a Hyperdrive e documentar ativação; não inserir um ID inexistente no `wrangler.jsonc`.

## Hyperdrive
A aplicação já aceita `HYPERDRIVE.connectionString`. A versão adicionará diagnóstico explícito quando produção Cloudflare estiver usando fallback direto e documentação/comandos para ativar o binding com um ID real. O projeto não deve inventar ou hardcodear um ID de Hyperdrive.

## Compatibilidade
- `editVersion` começa em 1 para registros existentes.
- Clientes antigos que não enviarem `editVersion` continuam funcionando; o lock de linha ainda protege a transação.
- Nenhuma regra de DRE é alterada.
- Abastecimentos e comissão continuam participando apenas do custo do Acerto conforme regras já definidas.
