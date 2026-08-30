# V33.20 — Acerto de Viagem

- Removido o botão externo **Importar pedágios/chapas** do cabeçalho de Acerto de Viagem.
- O botão **Registrar acerto** agora abre a ficha imediatamente e não fica bloqueado por verificações preliminares de motoristas/placas enquanto os cadastros ainda estão carregando.
- As validações obrigatórias continuam ocorrendo ao salvar a ficha.
- O botão recebeu `type="button"` explicitamente para evitar comportamento de submit acidental.
- Se motoristas ou placas ainda não estiverem disponíveis, a ficha abre e o sistema apenas apresenta um aviso.

Não há alteração de banco de dados nesta versão.
