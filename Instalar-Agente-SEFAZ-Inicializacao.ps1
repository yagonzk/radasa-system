$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmd = Join-Path $project "Iniciar-Agente-SEFAZ.cmd"
$taskName = "Radasa - Agente SEFAZ"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$cmd`"" -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Consulta NF-e automaticamente no Ambiente Nacional para o Radasa System." -Force | Out-Null
Write-Host "Agente SEFAZ configurado para iniciar com o Windows." -ForegroundColor Green
Write-Host "Tarefa: $taskName"
