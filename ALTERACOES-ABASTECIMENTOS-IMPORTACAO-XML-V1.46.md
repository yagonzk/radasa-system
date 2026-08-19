# v1.46 — Correção da confirmação da importação XML de abastecimentos

- Corrige caso em que o XML aparecia como COMPLETO na conferência, mas não era gravado na aba Abastecimentos.
- A confirmação agora reaproveita diretamente o posto/cliente já validado na conferência quando o CNPJ do emitente confere.
- Remove advisory locks da resolução de posto para compatibilidade com conexões Neon/serverless/pooled.
- Mantém a resolução automática/criação do posto correto pelo CNPJ do emitente quando necessário.
- A interface passa a exibir a mensagem real devolvida pelo backend quando um item falhar na confirmação.
- Mantidas as regras da v1.45: Diesel/Diesel S10 entram nos litros e na média KM/L; ARLA fica separado.
- Sem migration nova.
