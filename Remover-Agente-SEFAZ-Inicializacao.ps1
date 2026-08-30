$taskName = "Radasa - Agente SEFAZ"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Inicializacao automatica do Agente SEFAZ removida." -ForegroundColor Yellow
