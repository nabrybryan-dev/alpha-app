# Resuelve el chat_id de Telegram a partir del token del bot.
# El token se toma del portapapeles y NUNCA se imprime.

$ErrorActionPreference = 'Stop'

function Titulo($t) {
  Write-Host ''
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host ("  " + ("-" * $t.Length)) -ForegroundColor DarkGray
}

Clear-Host
Write-Host ''
Write-Host '  ============================================' -ForegroundColor Cyan
Write-Host '   AVISOS AL TELEFONO - CENTRO DE RESPUESTAS' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor Cyan

Titulo 'Paso 1: crear el bot'
Write-Host '  En Telegram, busca el contacto:  @BotFather'
Write-Host '  Escribele:  /newbot'
Write-Host '  Te pedira un nombre y un usuario (el usuario acaba en "bot").'
Write-Host '  Al final te da un token largo con dos puntos en medio.'
Write-Host '  COPIALO.'

$token = ''
while ($true) {
  Write-Host ''
  Write-Host '  Con el token copiado, pulsa ENTER.' -ForegroundColor Yellow
  [void](Read-Host)
  $v = (Get-Clipboard -Raw)
  if ($null -eq $v) { $v = '' }
  $v = $v.Trim()
  if ($v -match '^\d+:[A-Za-z0-9_-]{30,}$') { $token = $v; break }
  Write-Host '  Eso no parece un token de bot. Deberia ser numeros, dos puntos y letras.' -ForegroundColor Red
}
Write-Host "  [OK] Token leido ($($token.Length) caracteres)." -ForegroundColor Green

Titulo 'Paso 2: hablarle al bot'
Write-Host '  Busca en Telegram el bot que acabas de crear y escribele'
Write-Host '  cualquier cosa, por ejemplo:  hola'
Write-Host ''
Write-Host '  Es necesario: Telegram no deja que un bot escriba primero.'

$chatId = ''
while ($true) {
  Write-Host ''
  Write-Host '  Cuando le hayas escrito, pulsa ENTER.' -ForegroundColor Yellow
  [void](Read-Host)
  try {
    $r = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getUpdates" -Method Get
  } catch {
    Write-Host '  No se pudo hablar con Telegram. Revisa tu conexion.' -ForegroundColor Red
    continue
  }
  $ultimo = $r.result | Where-Object { $_.message.chat.id } | Select-Object -Last 1
  if ($ultimo) { $chatId = $ultimo.message.chat.id; break }
  Write-Host '  Todavia no veo tu mensaje. Escribele al bot y vuelve a pulsar ENTER.' -ForegroundColor Red
}

Titulo 'Paso 3: probar'
try {
  $cuerpo = @{ chat_id = $chatId; text = 'Listo. Por aqui te van a llegar las banderas rojas de Alpha.' } | ConvertTo-Json
  Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/sendMessage" -Method Post -Body $cuerpo -ContentType 'application/json' | Out-Null
  Write-Host '  [OK] Te acabo de mandar un mensaje de prueba. Miralo en Telegram.' -ForegroundColor Green
} catch {
  Write-Host '  No se pudo enviar la prueba, pero el chat_id parece bueno.' -ForegroundColor Yellow
}

Titulo 'Listo. Guarda estos dos secretos en Supabase'
Write-Host ''
Write-Host '  Supabase -> Edge Functions -> Secrets -> anadir dos:'
Write-Host ''
Write-Host '    Name:  TELEGRAM_BOT_TOKEN' -ForegroundColor Yellow
Write-Host '    Value: el token que copiaste (sigue en tu portapapeles)'
Write-Host ''
Write-Host "    Name:  TELEGRAM_CHAT_ID" -ForegroundColor Yellow
Write-Host "    Value: $chatId" -ForegroundColor Yellow
Write-Host ''
Write-Host '  El chat_id no es secreto, por eso te lo puedo mostrar.'
Write-Host '  El token si: no lo pegues en ningun chat.'
Write-Host ''
Read-Host '  Pulsa ENTER para cerrar'
