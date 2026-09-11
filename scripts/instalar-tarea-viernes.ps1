# Deja la revision semanal programada para que ocurra sola los viernes.
#
# CORRELO DESDE LA CARPETA DEDICADA, no desde la de trabajo de siempre:
#
#     C:/Users/ASUS/dev/alpha-viernes/scripts/instalar-tarea-viernes.ps1
#
# La tarea queda apuntando a la carpeta donde este ESTE archivo. Y la de siempre
# (dev/alpha-app) NO sirve: la comparten varias sesiones y va cambiando de rama, asi que un
# viernes de madrugada este archivo puede no existir ahi. No daria error: no habria
# revisiones, y se sabria el sabado. La carpeta dedicada, ademas, se pone al dia sola antes
# de cada corrida (ver revision-semanal-viernes.ps1).
#
# Se corre UNA VEZ. No pide permisos de administrador: la tarea es del usuario.
#
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-viernes.ps1
#
# Para verla despues:  Get-ScheduledTask -TaskName 'Alpha - revision semanal'
# Para probarla ya:    Start-ScheduledTask -TaskName 'Alpha - revision semanal'
# Para quitarla:       Unregister-ScheduledTask -TaskName 'Alpha - revision semanal'
#
# TRES DETALLES QUE NO SON ADORNO
#
#   · Se ejecuta AUNQUE EL PORTATIL ESTE A BATERIA. Por defecto Windows salta las tareas
#     sin enchufe, y eso convierte "todos los viernes" en "los viernes que estuviera
#     cargando", que es la peor clase de fallo: el que parece que funciona.
#   · Si la maquina estaba apagada a esa hora, se ejecuta EN CUANTO SE ENCIENDA. Sin esto,
#     un viernes con el portatil cerrado se salta la semana entera y nadie se entera.
#   · Tiene tope de 4 horas. Si algo se queda colgado, se corta solo en vez de quedarse
#     comiendo maquina hasta el lunes.

param(
  [string]$Hora = '03:00',
  [string]$Nombre = 'Alpha - revision semanal'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$guion = Join-Path $PSScriptRoot 'revision-semanal-viernes.ps1'

if (-not (Test-Path $guion)) { throw "no encuentro $guion" }

$clave = "$env:USERPROFILE\.alpha\service_role.txt"
if (-not $env:SUPABASE_SERVICE_KEY -and -not (Test-Path $clave)) {
  Write-Host ''
  Write-Host '  AVISO: todavia no esta la clave de servicio.' -ForegroundColor Yellow
  Write-Host "  La tarea se instala igual, pero el viernes va a parar en el primer paso."
  Write-Host "  Deja la clave en:  $clave"
  Write-Host ''
}

$accion = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $guion) `
  -WorkingDirectory $repo

$disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At $Hora

$ajustes = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $Nombre `
  -Action $accion `
  -Trigger $disparador `
  -Settings $ajustes `
  -Description 'Calcula, narra con la voz clonada y deja sin firmar las revisiones semanales de Alpha Athletics. La firma sigue siendo de Bryan.' `
  -Force | Out-Null

Write-Host ''
Write-Host "  [OK] Programada: $Nombre" -ForegroundColor Green
Write-Host "       viernes a las $Hora, y si el portatil estaba apagado, al encenderlo."
Write-Host "       registro en: $env:USERPROFILE\.alpha\registros"
Write-Host ''
Write-Host '  Pruebala ahora mismo sin esperar al viernes:' -ForegroundColor Cyan
Write-Host "       Start-ScheduledTask -TaskName '$Nombre'"
Write-Host ''
