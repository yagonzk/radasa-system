$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = [Convert]::ToBase64String($bytes)
Write-Host "SEFAZ_AGENT_SECRET=" -NoNewline
Write-Host $secret
