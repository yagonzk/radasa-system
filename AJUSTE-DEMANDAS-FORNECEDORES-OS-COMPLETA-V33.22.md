# V33.22 — Demandas no topo, Fornecedores e Ordem de Serviço completa

## Menu
- **Demandas** agora é uma aba principal, fora dos grupos/subabas.
- Fica posicionada **acima de Visão Geral** no menu lateral.

## Cadastros > Fornecedores
Nova subaba para cadastrar prestadores e fornecedores usados pela manutenção.

Campos disponíveis:
- Razão Social
- Nome Fantasia
- CNPJ/CPF
- Tipos de fornecedor (múltipla seleção)
- Telefone / WhatsApp
- E-mail
- Endereço
- Cidade / UF
- Contato responsável
- Observações
- Ativo / Inativo

Tipos iniciais:
- Oficina Mecânica
- Autopeças
- Borracharia
- Elétrica
- Funilaria/Pintura
- Solda
- Guincho
- Pneus
- Lubrificantes
- Outros

Fornecedores que já possuem histórico de OS não são apagados fisicamente: ao excluir, passam para **Inativo**, preservando o histórico.

## Frota e Manutenção — Ordem de Serviço completa
A OS deixou de ser um lançamento genérico e passou a suportar um fluxo completo de manutenção.

### Identificação
- Número interno automático da OS
- Número da OS do fornecedor/oficina
- Data de abertura
- Data de conclusão
- Tipo: Preventiva, Corretiva, Emergencial ou Outra
- Status
- Veículo
- Fornecedor cadastrado
- Responsável
- KM de entrada
- KM de saída

### Problema e execução
- Problema relatado / motivo da manutenção
- Serviço realizado / conclusão
- Observações

### Serviços e peças
A OS aceita quantos itens forem necessários, com:
- Tipo: Serviço, Peça ou Outro
- Descrição
- Quantidade
- Valor unitário
- Valor total calculado
- Vínculo opcional da peça com o Almoxarifado

Quando uma peça do Almoxarifado é usada, a saída de estoque é registrada automaticamente.

### Custos
- Peças
- Mão de obra
- Outros custos
- Desconto
- Total líquido calculado automaticamente

### Notas Fiscais
Uma mesma OS pode ter várias NFs, cada uma com:
- Número
- Série
- Chave de acesso
- Data de emissão
- Valor da NF
- Arquivo em PDF, XML, JPG, PNG ou WEBP

As notas podem ser anexadas na criação ou posteriormente ao abrir a OS.

### Outros anexos
Também é possível anexar:
- OS em papel
- Orçamento
- Fotos
- Comprovantes
- Outros documentos

### Consulta da OS
A tela detalhada exibe:
- Dados da OS
- Veículo e fornecedor
- Problema e serviço realizado
- Itens e custos
- Notas fiscais
- Outros anexos
- Download e exclusão de anexos
- Conclusão da OS

Ao concluir uma OS, o veículo volta para **Disponível** e o valor líquido da manutenção é integrado ao Financeiro como despesa de **Manutenção**.

## Banco de dados
Migration adicionada:
`prisma/migrations/20260829123000_fornecedores_os_completa/migration.sql`

Ela cria/atualiza:
- `fornecedores`
- `ordens_servico`
- `ordem_servico_itens`
- `ordem_servico_notas_fiscais`
- `ordem_servico_anexos`

## Publicação
Esta versão possui alteração de banco. Execute obrigatoriamente `npx prisma migrate deploy` antes/de forma conjunta à publicação.
