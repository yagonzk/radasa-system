# Atualização da aba Romaneios

Esta versão substitui a tela **Manifestos** por **Romaneios**, preservando os registros existentes e a compatibilidade interna com o banco anterior.

## O que foi implementado

- importação e interpretação automática do PDF de romaneio;
- importação em massa de vários PDFs, com conferência individual e cadastro único dos arquivos válidos;
- cliente individual em cada produto/item;
- autocadastro de clientes e produtos ainda inexistentes;
- número do romaneio, NF, série, quantidade, valor unitário e valor total por item;
- classificação por item: **Receber c/ Cliente**, **Acertar c/ Lebrinha** ou **Bonificação - Lebrinha**;
- tela de conferência antes de salvar o PDF importado;
- listagem completa dos itens, clientes, valores e formas de acerto;
- listagem principal compacta, com uma linha por romaneio;
- botão de olho para abrir a inspeção completa dos itens em um pop-up;
- resumo no rodapé da inspeção com itens e valores totais para cada uma das três formas de cobrança;
- confirmação de pagamento por item “Receber c/ Cliente”, usando os botões de check e X;
- painel “Falta pagar” com a soma de todos os recebimentos ainda pendentes ou não conferidos;
- painel “Foi pago” com a soma dos itens “Receber c/ Cliente” confirmados;
- romaneios ordenados sempre da data mais recente para a mais antiga;
- filtros por coluna acionados ao clicar no texto ou na seta do cabeçalho;
- criação e edição manual de romaneios;
- rota antiga `/manifestos` mantida somente para compatibilidade, redirecionada para a nova tela.

## Comissões

- filtro por motorista combinado com os filtros de data;
- exportações CSV e PDF respeitam o motorista selecionado.

## Abastecimento

- toda a área do título de cada coluna abre o respectivo filtro, sem exigir o clique exato na seta.

## Atualizar banco e iniciar no Windows/PowerShell

Abra o PowerShell na pasta extraída do projeto e execute:

```powershell
taskkill /F /IM node.exe
pnpm install
pnpm prisma migrate deploy
pnpm prisma generate
pnpm dev
```

O comando `taskkill` evita o erro `EPERM` do Prisma quando o servidor anterior ainda está usando o arquivo `query_engine-windows.dll.node`. Se não houver um processo Node aberto, a mensagem informando que o processo não foi encontrado pode ser ignorada.

## Produção

Antes de publicar, aplique a migração e gere a versão de produção:

```powershell
pnpm install
pnpm prisma migrate deploy
pnpm build
```

Não use `prisma migrate reset`: esse comando apaga os dados do banco.

## Validações realizadas

- `pnpm check` (Prisma + TypeScript);
- teste do parser com o arquivo `ROMANEIO 17-04.pdf`;
- 14 itens, 5 clientes, dois números de romaneio e total de R$ 7.081,40 reconhecidos no PDF de exemplo;
- leitura validada tanto com a estrutura normal do PDF quanto com o texto compactado em uma única linha.

## Se aparecer “servidor desatualizado”

Essa mensagem significa que o navegador recebeu a interface nova, mas o processo Node ainda está executando uma compilação antiga. Pare todos os processos Node e use um dos blocos abaixo.

Desenvolvimento:

```powershell
taskkill /F /IM node.exe
pnpm install
pnpm prisma migrate deploy
pnpm prisma generate
pnpm dev
```

Produção:

```powershell
taskkill /F /IM node.exe
pnpm install
pnpm prisma migrate deploy
pnpm build
pnpm start
```
