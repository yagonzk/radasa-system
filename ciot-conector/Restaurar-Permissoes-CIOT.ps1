# Restauracao restrita das ACLs do runtime CIOT. Nunca concede acesso a Users/Everyone.
# Executado APENAS por um administrador a partir dos scripts oficiais do projeto.
$ErrorActionPreference = "Stop"
function Set-CiotRestrictedPermissions {
  param([Parameter(Mandatory = $true)][string]$RuntimeDir)
  $expectedDir = [IO.Path]::GetFullPath((Join-Path $env:ProgramFiles "Radasa\CIOT"))
  $targetDir = [IO.Path]::GetFullPath($RuntimeDir)
  if (-not [string]::Equals($expectedDir.TrimEnd('\'), $targetDir.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
    throw "PASTA_CIOT_INESPERADA"
  }
  $directory = Get-Item -LiteralPath $targetDir -Force -ErrorAction Stop
  if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "PASTA_CIOT_INVALIDA"
  }

  # A pasta herda zero permissoes de Program Files; somente SYSTEM e Administradores.
  & icacls.exe $targetDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "FALHA_ACL_PASTA_CIOT" }

  foreach ($item in @(Get-ChildItem -LiteralPath $targetDir -Force -ErrorAction Stop)) {
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "ITEM_CIOT_INESPERADO"
    }
    # Instalacoes anteriores podem ter arquivos SEM ACE por causa do /T com /inheritance:r.
    # Recupera a propriedade antes de escrever DACL explicita, sem expor dados do PFX/DPAPI.
    & takeown.exe /F $item.FullName /A | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "FALHA_PROPRIEDADE_ARQUIVO_CIOT" }
    & icacls.exe $item.FullName /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "FALHA_ACL_ARQUIVO_CIOT" }
  }
  # Confere que nao sobraram ACEs para outros usuarios/grupos.
  foreach ($path in @($targetDir) + @((Get-ChildItem -LiteralPath $targetDir -Force -File).FullName)) {
    foreach ($entry in @((Get-Acl -LiteralPath $path -ErrorAction Stop).Access)) {
      $sid = try { $entry.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { "" }
      if ($sid -notin @("S-1-5-18", "S-1-5-32-544") -or
          $entry.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
        throw "ACL_CIOT_CONTEM_PERMISSAO_INESPERADA"
      }
    }
  }
}
