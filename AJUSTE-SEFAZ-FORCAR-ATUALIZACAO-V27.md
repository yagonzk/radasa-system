# Ajuste SEFAZ - Forçar atualização V27

- Adicionado botão **Forçar atualização** ao lado de **Atualizar status** no popup de Status da SEFAZ.
- O novo botão chama `POST /api/sefaz/sincronizar`, executando a sincronização imediatamente sem aguardar o próximo Cron de 5 minutos.
- Após a execução, o popup recarrega automaticamente o status da SEFAZ.
- Durante a sincronização, os dois botões ficam temporariamente desabilitados para evitar execuções duplicadas.
- Em caso de sucesso ou erro, a interface exibe uma notificação com o resultado.
- O Cron automático de 5 minutos continua ativo normalmente.
