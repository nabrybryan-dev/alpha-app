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
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-viernes.ps1 -Partida
#
# Para verla despues:  Get-ScheduledTask -TaskName 'Alpha - revision semanal*'
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
#   · Tiene tope de horas. Si algo se queda colgado, se corta solo en vez de quedarse
#     comiendo maquina hasta el lunes.
#
# ============================================================================
# -Partida: LA REVISION LARGA, EN DOS TAREAS
# ============================================================================
# Decision de Bryan del 12-sep: la revision pasa a 2-3 minutos para la mitad de la cartera,
# y eso no cabe en una tarea de 4 h (voz ~3 h, cara ~4 h en Kaggle). Con -Partida se
# instalan DOS tareas y se QUITA la del viernes de madrugada:
#
#   noche  (jueves, 21:00, tope 8 h): guiones, revision larga, voz y LANZAR la cara.
#   manana (viernes, 09:00, tope 3 h): RECOGER la cara y publicar sin firmar.
#
# La del viernes de madrugada se quita a proposito: si quedaran las tres, a las 3:00 se
# rehace la voz de todos con la corta y se pisa lo que dejo la noche.
#
# Esa noche el portatil tiene que estar LIBRE: el modelo de voz no carga con las sesiones de
# Claude, VS Code y Chrome abiertas (medido el 12-sep: murio al cargar con 4,9 GB libres).

param(
  [string]$Hora = '03:00',
  [string]$Nombre = 'Alpha - revision semanal',
  [switch]$Partida,
  [string]$HoraNoche = '21:00',
  [string]$HoraManana = '09:00'
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

function Registra($nombreTarea, $argumentosExtra, $dia, $hora, $horasTope, $descripcion) {
  $accion = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}" {1}' -f $guion, $argumentosExtra).Trim() `
    -WorkingDirectory $repo

  $disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dia -At $hora

  $ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours $horasTope) `
    -MultipleInstances IgnoreNew

  Register-ScheduledTask `
    -TaskName $nombreTarea `
    -Action $accion `
    -Trigger $disparador `
    -Settings $ajustes `
    -Description $descripcion `
    -Force | Out-Null

  Write-Host "  [OK] Programada: $nombreTarea ($dia a las $hora, tope $horasTope h)" -ForegroundColor Green
}

Write-Host ''
if ($Partida) {
  Registra "$Nombre (noche)" '-Fase noche' 'Thursday' $HoraNoche 8 `
    'Jueves: guiones, revision larga, voz clonada y lanzamiento de la cara en Kaggle. No publica.'
  Registra "$Nombre (manana)" '-Fase manana' 'Friday' $HoraManana 3 `
    'Viernes: recoge la cara de Kaggle y deja sin firmar las revisiones semanales. La firma sigue siendo de Bryan.'

  if (Get-ScheduledTask -TaskName $Nombre -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $Nombre -Confirm:$false
    Write-Host "  [OK] Quitada la tarea del viernes de madrugada ($Nombre): pisaria la noche." -ForegroundColor Green
  }
  Write-Host ''
  Write-Host '  Esa noche el portatil tiene que estar libre: la voz no carga con todo abierto.' -ForegroundColor Yellow
} else {
  Registra $Nombre '' 'Friday' $Hora 4 `
    'Calcula, narra con la voz clonada y deja sin firmar las revisiones semanales de Alpha Athletics. La firma sigue siendo de Bryan.'
}

Write-Host "       registro en: $env:USERPROFILE\.alpha\registros"
Write-Host ''
Write-Host '  Pruebala ahora mismo sin esperar:' -ForegroundColor Cyan
Write-Host "       Get-ScheduledTask -TaskName '$Nombre*' | Start-ScheduledTask"
Write-Host ''
