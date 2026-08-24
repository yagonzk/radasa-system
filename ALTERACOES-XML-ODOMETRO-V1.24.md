# Radasa System v1.24 — Leitura de odômetro XML

## Alteração

- Removida a palavra `SEQUENCIA` da lista de rótulos aceitos como odômetro na leitura de XML de abastecimento.
- Valores como `Sequencia: 1463530` não serão mais interpretados como quilometragem do veículo.
- Permanecem válidos rótulos como `KM`, `OD`, `ODOM`, `ODOMETRO`, `HOD`, `HODOM`, `HODOMETRO`, `HD`, `HO`, `HM`, `HORIMETRO` e `QUILOMETRAGEM`.
