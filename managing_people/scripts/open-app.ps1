param([int]$Port = 4173)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:$Port"
