$ErrorActionPreference = "Stop"

$arquivo = "client\src\pages\Viagens.tsx"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = "$env:USERPROFILE\Downloads\corrigir-viagens-encoding-$stamp.log"

function Log($msg) {
  Write-Host $msg
  Add-Content -Path $log -Value $msg -Encoding UTF8
}

Log "=== INICIANDO CORRECAO ==="
Log "Pasta atual: $(Get-Location)"
Log "Arquivo alvo: $arquivo"

if (!(Test-Path $arquivo)) {
  Log "ERRO: Arquivo nao encontrado: $arquivo"
  exit 1
}

$backup = "$arquivo.bak-encoding-$stamp"
Copy-Item $arquivo $backup -Force
Log "Backup criado: $backup"

$txt = Get-Content $arquivo -Raw -Encoding UTF8
$antes = $txt

# Corrige mojibake comum: MÃ‰DIO, AÃ‡Ã•ES, â€”, â†’, etc.
$replaces = @{
  "Ã¡"="á"; "Ã " ="à"; "Ã¢"="â"; "Ã£"="ã"; "Ã¤"="ä";
  "Ã©"="é"; "Ã¨"="è"; "Ãª"="ê"; "Ã«"="ë";
  "Ã­"="í"; "Ã¬"="ì"; "Ã®"="î"; "Ã¯"="ï";
  "Ã³"="ó"; "Ã²"="ò"; "Ã´"="ô"; "Ãµ"="õ"; "Ã¶"="ö";
  "Ãº"="ú"; "Ã¹"="ù"; "Ã»"="û"; "Ã¼"="ü";
  "Ã§"="ç";

  "Ã"="Á"; "Ã€"="À"; "Ã‚"="Â"; "Ãƒ"="Ã"; "Ã„"="Ä";
  "Ã‰"="É"; "Ãˆ"="È"; "ÃŠ"="Ê"; "Ã‹"="Ë";
  "Ã"="Í"; "ÃŒ"="Ì"; "ÃŽ"="Î"; "Ã"="Ï";
  "Ã“"="Ó"; "Ã’"="Ò"; "Ã”"="Ô"; "Ã•"="Õ"; "Ã–"="Ö";
  "Ãš"="Ú"; "Ã™"="Ù"; "Ã›"="Û"; "Ãœ"="Ü";
  "Ã‡"="Ç";

  "â€”"="—"; "â€“"="–"; "â†’"="→"; "â€¢"="•"; "Â·"="·";
  "â€œ"="“"; "â€"="”"; "â€˜"="‘"; "â€™"="’";
  "â€¦"="…"; "â‚¬"="€";

  "MÃ‰DIO"="MÉDIO";
  "MÃ‰DIA"="MÉDIA";
  "AÃ‡Ã•ES"="AÇÕES";
  "AÃ‡ÕES"="AÇÕES";
  "VISUALIZAÃ‡ÃƒO"="VISUALIZAÇÃO";
  "VisualizaÃ§Ã£o"="Visualização";
  "visualizaÃ§Ã£o"="visualização";
  "ComissÃ£o"="Comissão";
  "PedÃ¡gio"="Pedágio";
  "DiÃ¡ria"="Diária";
  "MÃ©dia"="Média";
  "mÃ©dia"="média";
  "CÃ³digo"="Código";
  "cÃ³digo"="código";
  "nÃ£o"="não";
  "NÃ£o"="Não";
  "Ã§Ã£o"="ção";
  "Ã‡ÃƒO"="ÇÃO";
  "Ã•ES"="ÕES";
  "Ã‡"="Ç";
  "Â "="";
  "â€‹"=""
}

foreach ($k in $replaces.Keys) {
  $txt = $txt.Replace($k, $replaces[$k])
}

# Correção específica do card que apareceu no print
$txt = $txt.Replace("CUSTO MÃ‰DIO POR KM", "CUSTO MÉDIO POR KM")
$txt = $txt.Replace("CUSTO MÃ‰DIO", "CUSTO MÉDIO")
$txt = $txt.Replace("AÃ‡Ã•ES", "AÇÕES")
$txt = $txt.Replace("AÃ‡ÕES", "AÇÕES")
$txt = $txt.Replace("â€”", "—")

# Se algum R$ virou lixo, força os textos mais comuns
$txt = $txt.Replace("R$ 0,00", "R$ 0,00")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($arquivo, $txt, $utf8NoBom)

if ($txt -eq $antes) {
  Log "AVISO: Nenhuma substituicao foi feita. Talvez o arquivo aberto no projeto nao seja esse ou o build esta usando cache."
} else {
  Log "OK: Substituicoes aplicadas no arquivo."
}

Log ""
Log "Procurando textos ainda bugados..."
$bugs = Select-String -Path $arquivo -Pattern "Ã|Â|â€|â€”|â€“|â†|â€¢" -AllMatches -ErrorAction SilentlyContinue

if ($bugs) {
  Log "AINDA EXISTEM POSSIVEIS BUGS:"
  $bugs | Select-Object -First 30 | ForEach-Object {
    Log "Linha $($_.LineNumber): $($_.Line.Trim())"
  }
} else {
  Log "OK: Nenhum texto bugado comum encontrado."
}

Log ""
Log "Conferindo visualizacao:"
$vis = Select-String -Path $arquivo -Pattern "Visualização rápida do Acerto|Visualizacao rapida do Acerto|Detalhes da Viagem|View dialog|setViewingViagem" -Context 1,1 -ErrorAction SilentlyContinue

if ($vis) {
  $vis | ForEach-Object {
    Log "Linha $($_.LineNumber): $($_.Line.Trim())"
  }
} else {
  Log "AVISO: Nao encontrei textos da visualizacao. Pode ter sido removida ou alterada."
}

Log ""
Log "=== FINALIZADO ==="
Log "Log salvo em: $log"
