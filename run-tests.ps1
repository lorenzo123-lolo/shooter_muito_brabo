# Roda os testes do Bloco de Isaac no Microsoft Edge invisível (headless) e mostra o resultado.
# Uso:  powershell -ExecutionPolicy Bypass -File run-tests.ps1
# Usa o protocolo de depuração do navegador para esperar TODOS os testes terminarem,
# inclusive os de áudio (que rodam em segundo plano).
param([string]$Page = 'tests.html', [int]$TimeoutSec = 180, [int]$Port = 9333)

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profileDir = Join-Path $env:TEMP 'bloco-isaac-testes-edge'
$url = 'file:///' + ((Join-Path $PSScriptRoot $Page) -replace '\\', '/')

$edgeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  "--remote-debugging-port=$Port", "--user-data-dir=`"$profileDir`"",
  '--autoplay-policy=no-user-gesture-required', $url)
$proc = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru

function Stop-TestEdge {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like "*bloco-isaac-testes-edge*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

try {
  # espera a página aparecer na lista de alvos de depuração
  $wsUrl = $null
  $deadline = (Get-Date).AddSeconds(30)
  while (-not $wsUrl -and (Get-Date) -lt $deadline) {
    try {
      $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json" -TimeoutSec 2
      $t = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like "*$Page" } | Select-Object -First 1
      if ($t) { $wsUrl = $t.webSocketDebuggerUrl }
    } catch { }
    if (-not $wsUrl) { Start-Sleep -Milliseconds 300 }
  }
  if (-not $wsUrl) { throw 'O Edge não abriu a página de testes.' }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$wsUrl, $ct).Wait()

  # espera window.testResults existir e a promessa terminar
  $expr = 'new Promise(r => { const w = () => window.testResults ? window.testResults.then(r) : setTimeout(w, 100); w(); })'
  $req = @{ id = 1; method = 'Runtime.evaluate'
            params = @{ expression = $expr; awaitPromise = $true; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($req)
  $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, $ct).Wait()

  $buf = New-Object byte[] 65536
  $value = $null
  $end = (Get-Date).AddSeconds($TimeoutSec)
  while ($null -eq $value -and (Get-Date) -lt $end) {
    $ms = New-Object IO.MemoryStream
    do {
      $task = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), $ct)
      if (-not $task.Wait([TimeSpan]::FromSeconds($TimeoutSec))) { throw 'Os testes demoraram demais.' }
      $ms.Write($buf, 0, $task.Result.Count)
    } while (-not $task.Result.EndOfMessage)
    $msg = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
    if ($msg.id -eq 1) {
      if ($msg.result.exceptionDetails) { throw ('Erro na página: ' + $msg.result.exceptionDetails.text) }
      $value = $msg.result.result.value
    }
  }
  if ($null -eq $value) { throw 'Sem resposta dos testes.' }
  Write-Output $value
  if ($value -match 'FALHAS 0') { $code = 0 } else { $code = 1 }
} finally {
  Stop-TestEdge
}
exit $code
