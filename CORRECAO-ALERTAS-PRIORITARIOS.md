# Correção — Alertas prioritários

- Dashboard e Central de Alertas continuam usando a mesma API `/dashboard/alertas`.
- CNH sem número, categoria ou validade agora gera alerta.
- Veículo sem RENAVAM, chassi, validade do CRLV, vencimento do IPVA ou licenciamento agora gera alerta.
- Vencimentos em até 30 dias continuam gerando alerta.
- Documentos vencidos continuam com prioridade máxima.
- Alertas de manutenção também são incorporados.
- Corrigido também o índice Prisma duplicado de `grupoParcelamento` existente no pacote anterior.

Não há nova migration.
