# V18 — Motorista independente da placa na viagem

- Selecionar ou trocar a placa em **Viagens** não altera mais o motorista selecionado.
- Qualquer motorista ativo pode ser escolhido para qualquer placa em uma viagem.
- O vínculo `motoristaId` existente em **Cadastros > Veículos** continua disponível apenas como informação/padrão operacional e não restringe a viagem.
- Ao ler manifesto, o sistema prioriza o motorista identificado no próprio documento; só usa o motorista cadastrado no veículo como fallback.
- Mensagens da leitura de manifesto foram ajustadas para não mandar o usuário vincular motorista à placa.
