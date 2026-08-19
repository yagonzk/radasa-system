# Performance adicional no Cloudflare

A v1.54 reduz trabalho e payload do aplicativo sem exigir alteração de infraestrutura.

O projeto já possui suporte opcional a Cloudflare Hyperdrive no backend. Caso ainda exista latência alta no primeiro acesso após períodos de inatividade, o próximo passo recomendado é habilitar o Hyperdrive para a conexão PostgreSQL/Neon e preencher o binding já previsto no `wrangler.jsonc`.

Não foi ativado automaticamente nesta versão porque o ID/configuração do Hyperdrive pertence à conta Cloudflare do ambiente de produção.
