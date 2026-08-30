# V33.3 - Proteção SEFAZ 656 + Aplicativo Windows

## SEFAZ
- Se cStat=656 ou 137, nenhuma nova chamada é enviada por 1 hora.
- Se cStat=138 e ultNSU já alcançou maxNSU, também aguarda 1 hora.
- Enquanto ultNSU < maxNSU, o Agente Local drena os lotes sequencialmente, avançando sempre pelo NSU retornado.
- Se o NSU não avançar, a drenagem é interrompida para evitar repetição agressiva.
- O botão Forçar atualização respeita a mesma trava e não fura a janela de 1 hora.
- O Worker Cloudflare continua sem consultar a SEFAZ diretamente.

## Windows .EXE
- Nova pasta `desktop-app` com Electron.
- `Gerar-Radasa-System-EXE.cmd` instala as dependências e gera um instalador Windows.
- O instalador cria atalho `Radasa System` na Área de Trabalho e no Menu Iniciar.
- O app abre `https://radasa.com.br` em uma janela própria, sem barra do navegador.
- O Agente SEFAZ continua separado e pode ser instalado para iniciar automaticamente no Windows.
