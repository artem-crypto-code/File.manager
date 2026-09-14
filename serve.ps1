$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Output "LISTENING"
$deadline = (Get-Date).AddSeconds(45)
$root = $PWD.Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.svg'='image/svg+xml'; '.webmanifest'='application/manifest+json' }
while ((Get-Date) -lt $deadline -and $listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $path = $ctx.Request.Url.AbsolutePath
  if ($path -eq '/') { $path = '/index.html' }
  $file = Join-Path $root ($path -replace '/', '\')
  if (Test-Path $file -PathType Leaf) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ext = [System.IO.Path]::GetExtension($file)
    if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Output "OK $path"
  } else {
    $ctx.Response.StatusCode = 404
    Write-Output "404 $path"
  }
  $ctx.Response.Close()
}
$listener.Stop()
Write-Output "STOPPED"
