# ALTERAÇÕES — ROMANEIOS / VEÍCULOS V1.36

- Romaneios antigos agora puxam automaticamente o **modelo atual** do cadastro de veículos pela placa/ID.
- Ao abrir/listar Romaneios, registros antigos sem modelo são sincronizados e gravados no banco.
- Ao editar o modelo ou a placa em Cadastros > Veículos, todos os Romaneios vinculados são atualizados automaticamente.
- Romaneios legados que possuíam apenas a placa passam a receber também o `veiculoCodigo` do cadastro correspondente.
- Nenhuma migration nova é necessária.
