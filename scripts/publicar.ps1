# Publicador de fichas del Centro de Respuestas Alpha.
# Recoge las claves del portapapeles para que nadie tenga que escribirlas
# ni pegarlas en un archivo. Nunca las imprime en pantalla.

$ErrorActionPreference = 'Stop'
$raiz     = Split-Path -Parent $PSScriptRoot
$archivo  = Join-Path $raiz 'CLAVES.local.txt'
$resultado = Join-Path $raiz 'RESULTADO.local.txt'
Set-Location $raiz

function Titulo($t) {
  Write-Host ''
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host ("  " + ("-" * $t.Length)) -ForegroundColor DarkGray
}

function Leer-Clave($nombre) {
  if (-not (Test-Path $archivo)) { return '' }
  $l = Select-String -Path $archivo -Pattern "^$nombre=" | Select-Object -First 1
  if ($l) { ($l.Line -split '=', 2)[1].Trim() } else { '' }
}

function Guardar-Clave($nombre, $valor) {
  $lineas = if (Test-Path $archivo) { Get-Content $archivo } else { @() }
  $lineas = $lineas | Where-Object { $_ -notmatch "^$nombre=" }
  $lineas += "$nombre=$valor"
  Set-Content -Path $archivo -Value $lineas -Encoding UTF8
}

# Devuelve el rol de un JWT de Supabase sin exponer la clave.
function Rol-Del-Jwt($jwt) {
  try {
    $p = $jwt.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($p.Length % 4) { $p += '=' }
    ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json).role
  } catch { '' }
}

function Pedir-Clave($nombre, $titulo, $instrucciones, $validador) {
  $actual = Leer-Clave $nombre
  if ($actual -and (& $validador $actual)) {
    Write-Host "  [OK] $titulo ya estaba guardada." -ForegroundColor Green
    return $actual
  }

  Titulo $titulo
  foreach ($linea in $instrucciones) { Write-Host "  $linea" }

  while ($true) {
    Write-Host ''
    Write-Host '  Cuando la tengas copiada, vuelve aqui y pulsa ENTER.' -ForegroundColor Yellow
    [void](Read-Host)

    $v = (Get-Clipboard -Raw)
    if ($null -eq $v) { $v = '' }
    $v = $v.Trim().Trim('"').Trim("'")

    if (-not $v) {
      Write-Host '  El portapapeles esta vacio. Copia la clave y vuelve a pulsar ENTER.' -ForegroundColor Red
      continue
    }
    if (-not (& $validador $v)) {
      Write-Host '  Eso no parece la clave correcta. Revisa que copiaste la buena.' -ForegroundColor Red
      continue
    }

    Guardar-Clave $nombre $v
    Write-Host "  [OK] Guardada ($($v.Length) caracteres)." -ForegroundColor Green
    return $v
  }
}

Clear-Host
Write-Host ''
Write-Host '  ============================================' -ForegroundColor Cyan
Write-Host '   CENTRO DE RESPUESTAS ALPHA' -ForegroundColor Cyan
Write-Host '   Publicar las 50 fichas y probar el buscador' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor Cyan

# ---------------------------------------------------------------- claves

$env:SUPABASE_URL = Pedir-Clave 'SUPABASE_URL' 'Direccion de tu Supabase' @(
  'Supabase -> tu proyecto -> Project Settings -> API',
  'Copia el valor de "Project URL".'
) { param($v) $v -match '^https://[a-z0-9]+\.supabase\.co/?$' }

$env:OPENAI_API_KEY = Pedir-Clave 'OPENAI_API_KEY' 'Clave de OpenAI' @(
  'platform.openai.com -> API keys -> Create new secret key',
  'Copiala con el boton de copiar (empieza por sk-).'
) { param($v) $v -match '^sk-' -and $v.Length -gt 20 }

# Supabase tiene dos formatos de clave secreta:
#   nuevo   -> empieza por sb_secret_
#   antiguo -> es un JWT (empieza por eyJ) con role = service_role
# Y hay que rechazar la publica: sb_publishable_ o JWT con role = anon.
$env:SUPABASE_SERVICE_KEY = Pedir-Clave 'SUPABASE_SERVICE_KEY' 'Clave secreta de Supabase' @(
  'Supabase -> tu proyecto -> Settings -> API Keys',
  'Busca el apartado "Secret keys" (el de ABAJO).',
  'Dale al boton de copiar de la fila "default".',
  'OJO: la de arriba, "Publishable key", NO sirve. Si la copias te aviso.'
) {
  param($v)
  if ($v -match '^sb_publishable_') { return $false }
  if ($v -match '^sb_secret_')      { return $true }
  (Rol-Del-Jwt $v) -eq 'service_role'
}

# ---------------------------------------------------------------- trabajo

Titulo '1 de 3  Revisando las 50 fichas'
& npm run validar-fichas
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '  [ALTO] Alguna ficha tiene un error. No se publico nada.' -ForegroundColor Red
  Write-Host '  Pasale a Claude lo que aparece arriba.'
  Write-Host ''
  Read-Host '  Pulsa ENTER para cerrar'
  exit 1
}

Titulo '2 de 3  Subiendo las fichas a Supabase'
Write-Host '  (pide los vectores a OpenAI, tarda unos segundos)'
& npm run publicar-fichas
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '  [ALTO] No se pudieron publicar. Mira el mensaje de arriba.' -ForegroundColor Red
  Write-Host '  Lo mas comun: la clave de OpenAI sin saldo, o la migracion 0010 sin correr.'
  Write-Host ''
  Read-Host '  Pulsa ENTER para cerrar'
  exit 1
}

Titulo '3 de 3  Probando el buscador con 15 preguntas'
& npm run calibrar-umbrales 2>&1 | Tee-Object -FilePath $resultado

Write-Host ''
Write-Host '  ============================================' -ForegroundColor Green
Write-Host '   LISTO' -ForegroundColor Green
Write-Host '  ============================================' -ForegroundColor Green
Write-Host ''
Write-Host '  El resultado quedo guardado en:'
Write-Host "    RESULTADO.local.txt" -ForegroundColor Yellow
Write-Host ''
Write-Host '  Se va a abrir solo. Copia todo y pasaselo a Claude.'
Write-Host ''

if (Test-Path $resultado) { Start-Process notepad.exe -ArgumentList "`"$resultado`"" }

Read-Host '  Pulsa ENTER para cerrar'
