# EL VIERNES, SOLO. Los tres pasos de la revision semanal, sin que nadie teclee nada.
#
# Nace de una pregunta de Bryan que era la correcta: "pero eso significa que cada ocho dias
# lo tendria que hacer". Si hay que pegar una orden cada semana, esto no esta automatizado:
# esta esperando a que alguien se acuerde. Y alguien se olvida.
#
#   1.   calcula los numeros de cada quien y escribe su guion (la plantilla)
#   1.6  el agente LOCAL de mensajes (cerebro-alpha-agentes) reescribe el guion de cada quien.
#        Todo en este equipo: ningun dato de salud viaja a un modelo externo (decision de
#        Bryan, 22-oct). Si el agente no esta, queda la plantilla y NO se firma nada.
#   2.   genera su audio con la voz clonada de alpha-estudio, un proceso por persona
#   3.   lo sube y escribe su ficha -SIN FIRMAR-
#   4.   (APAGADO por defecto) firma sola lo que el agente marco "publicar"
#
# LA FIRMA. Hasta el 21-oct era de Bryan y "no se automatizaba nunca". El 21-oct Bryan decidio que
# los mensajes semanales salgan SOLOS, sin su aprobacion ("Solos, sin freno", con el riesgo
# explicado). Por eso existe el paso 4, pero NACE APAGADO: solo corre con -FirmaAutomatica o si
# existe el archivo %USERPROFILE%\.alpha\firma-automatica.activa (las tareas programadas no llevan
# parametros, asi que el archivo es la forma de dejarlo encendido). La base pone sus propias
# guardas (migracion XXXX_aprobacion_automatica_revisiones.sql) y el interruptor "detener" de la
# consola sigue frenando a quien tenga una orden vigente.
#
# CUANDO NO SE PUBLICA, SE DICE. Antes terminaba con "LISTO" aunque se hubieran publicado 0 de 13
# (16-oct). Ahora cada salida con error deja su linea en notificaciones.log (funcion Falla) y el
# codigo de salida distinto de 0.
#
# ============================================================================
# LA CLAVE NO VIVE AQUI
# ============================================================================
# La lee de una de estas dos, en este orden:
#   1. la variable de entorno SUPABASE_SERVICE_KEY
#   2. el archivo  %USERPROFILE%\.alpha\service_role.txt
# Nunca se escribe en este archivo ni se imprime en el registro. Y conviene sacarla del
# Escritorio: ahi la ve cualquiera que se siente delante.
#
# ============================================================================
# COMO SE PRUEBA ANTES DE DEJARLO SOLO
# ============================================================================
#   powershell -ExecutionPolicy Bypass -File scripts\revision-semanal-viernes.ps1 -Ensayo
#
# Con -Ensayo hace los guiones y la voz de verdad, pero NO publica. Es la unica forma
# honesta de saber que la cadena entera funciona sin tocar la base.

param(
  # No publica. Los guiones y los audios si se generan.
  [switch]$Ensayo,
  # El lunes de la semana. Vacio = la semana en la que cae hoy.
  [string]$Semana = '',
  # alpha-estudio: de aqui sale la voz (`python -m estudio.voz`, molde `config.MOLDE_OFICIAL`).
  # Antes se llamaba a `dev\prueba-voz\generar_revisiones.py` (molde de 12 s, ajustes del 13-sep).
  [string]$Estudio = 'C:\Users\ASUS\dev\alpha-estudio',
  # Donde se escribe el registro de lo que paso.
  [string]$Registro = "$env:USERPROFILE\.alpha\registros",
  # No traerse el codigo nuevo antes de correr. Para probar con lo que hay delante.
  [switch]$SinActualizar,
  # LA CARA (el doblaje de labios) corre en Kaggle, FUERA de este equipo: sube los audios de la tanda,
  # que llevan el nombre y las cifras de salud de cada persona. Decision de Bryan, 22-oct: "Todo en el PC".
  # Por eso la cara esta APAGADA por defecto y solo corre con -ConCara, a proposito y cada vez. Antes
  # corria sola en cuanto existian el lanzador y el venv de la GPU, y solo se apagaba con -SinCara.
  [switch]$ConCara,
  # QUE PARTE DE LA CADENA SE CORRE. La voz de una tanda entera (~9 min por persona con el PC
  # apretado de memoria) y la cara en Kaggle no caben en una sola tarea corta.
  #   completa : todo seguido, como siempre.
  #   noche    : jueves. Guiones, mensajes, voz, y LANZAR la cara sin esperarla.
  #   manana   : viernes. RECOGER la cara, rehacer las pocas voces que faltaran y publicar.
  [ValidateSet('completa', 'noche', 'manana')]
  [string]$Fase = 'completa',
  # Quien NO recibe video aunque tenga microciclo activo (inactivos): un nombre por linea.
  # Si el archivo no existe, sale la tanda entera.
  [string]$Fuera = "$env:USERPROFILE\.alpha\revision-fuera.txt",
  # Donde vive cerebro-alpha-agentes con `agentes/mensaje_semanal.py` (el agente de mensajes) y
  # `agentes/tasa_contra_el_plan.py`. CORREGIDO el 22-oct: apuntaba a `dev\cerebro-alpha-tasa`, que
  # no existe, y por eso la tasa nunca se calculaba (el log del 15-oct: "No such file or directory").
  [string]$Cerebro = 'C:\Users\ASUS\dev\cerebro-alpha-agentes',
  # La firma automatica (paso 4). APAGADA por defecto. Ver la cabecera.
  [switch]$FirmaAutomatica,
  [string]$FirmaAutomaticaArchivo = "$env:USERPROFILE\.alpha\firma-automatica.activa",
  # Si por la manana faltan mas voces que estas, no se rehacen (no caben en la tarea): se avisa.
  [int]$MaximoDeVocesPorLaManana = 4,
  # El CANDADO contra dos corridas a la vez (la tarea de la noche que se alarga + la de la manana, o una
  # corrida a mano mientras corre la programada). Dos corridas pisarian el mismo manifiesto, lanzarian
  # dos modelos de voz de 2-3 GB en un PC que ya va justo de memoria y publicarian dos veces.
  # Es un archivo abierto SIN compartir: el sistema lo suelta solo si el proceso muere, no queda candado huerfano.
  [string]$Candado = "$env:USERPROFILE\.alpha\revision-semanal.lock"
)

# ============================================================================
# POR QUE 'Continue' Y NO 'Stop', QUE ES LO QUE PARECE MAS SEGURO
# ============================================================================
# Con 'Stop', PowerShell convierte en error MORTAL cualquier cosa que un programa externo
# escriba por el canal de errores -aunque sea un aviso inofensivo-. El generador de voz
# imprime "UserWarning: pkg_resources is deprecated" al cargar el modelo, y eso bastaba
# para tumbar la cadena entera en el paso 2, con un mensaje que habla de setuptools y no
# menciona ni la voz ni la revision. Medido el 12-sep en un ensayo.
#
# No se pierde seguridad: cada paso comprueba su propio `$LASTEXITCODE` justo despues y
# para con un motivo escrito. Esa es la red de verdad; 'Stop' solo anadia falsos positivos.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot

# EL REGISTRO TIENE UN SOLO ESCRITOR. Hasta el 12-sep la salida de cada paso iba por
# `Tee-Object -Append`, que deja el archivo ABIERTO mientras corre el paso; el `Apunta` de
# dentro chocaba con el ("IOException ... GetContentWriterIOError") y la linea se perdia. Y en
# PowerShell 5.1 `Tee-Object` escribe UTF-16: el registro salia mitad UTF-8, mitad UTF-16, y
# un `grep` normal no veia la mitad. Ahora todo pasa por `Escribe`, que abre, anade una
# linea en UTF-8 sin BOM y cierra.
$script:utf8 = New-Object System.Text.UTF8Encoding $false
function Escribe([string]$linea) {
  for ($intento = 1; $intento -le 5; $intento++) {
    try { [System.IO.File]::AppendAllText($script:archivoRegistro, $linea + "`r`n", $script:utf8); return }
    catch { Start-Sleep -Milliseconds 200 }
  }
  Write-Host "(no pude escribir en el registro: $linea)"
}

function Apunta($texto) {
  $linea = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
  Write-Host $linea
  Escribe $linea
}

# La salida de un programa (npm, python) al registro, linea a linea. Lo que llega por stderr
# viene envuelto como error de PowerShell ("NativeCommandError"): se escribe su texto, no el
# envoltorio. `$LASTEXITCODE` no se toca, asi que el paso sigue pudiendo comprobarlo.
function Registra([switch]$Callado) {
  process {
    $texto = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
    if (-not $Callado) { Write-Host $texto }
    Escribe $texto
  }
}

# El lunes de la semana de hoy (domingo = 0 cuenta como la semana que ya empezo). Lo usa `Falla`
# cuando el fallo ocurre ANTES de saber que semana es.
function LunesDeHoy {
  $hoy = Get-Date
  $atras = if ($hoy.DayOfWeek -eq [DayOfWeek]::Sunday) { 6 } else { [int]$hoy.DayOfWeek - 1 }
  return $hoy.AddDays(-$atras).ToString('yyyy-MM-dd')
}

# UNA SOLA SALIDA PARA TODO FALLO. Escribe en el registro, deja UNA linea en notificaciones.log (el
# canal que ya existe para avisar a Bryan: lo lee quien lee los avisos de los agentes) y sale con
# un codigo distinto de 0. El aviso es "mejor esfuerzo": si no se puede escribir, se dice y se sale
# igual; el aviso de un fallo no puede ser otro fallo. Con -Ensayo no se avisa a nadie.
function Falla([string]$paso, [string]$motivo, [int]$codigo = 1) {
  Apunta "PARO en el paso $paso : $motivo"
  if (-not $Ensayo) {
    try {
      $semanaDelAviso = if ($lunes) { $lunes } else { LunesDeHoy }
      Push-Location $repo
      try {
        & npm run avisar-tanda -- --semana $semanaDelAviso --fase $Fase --paso $paso --motivo $motivo --codigo $codigo 2>&1 | Registra -Callado
      } finally { Pop-Location }
    } catch {
      Apunta "(no pude avisar a Bryan en notificaciones.log: $($_.Exception.Message))"
    }
  }
  exit $codigo
}

# EL CANDADO. Se toma antes que nada (antes de traer codigo y de tocar el manifiesto) y lo suelta el sistema
# al terminar el proceso, pase lo que pase. Si no se puede tomar, hay otra corrida en marcha: se para, se
# avisa y se sale con el codigo 5. NO se espera: una corrida que espera a otra puede acabar publicando dos veces.
$script:manejadorDelCandado = $null
function TomaElCandado([string]$archivo) {
  try {
    $carpetaDelCandado = Split-Path -Parent $archivo
    if ($carpetaDelCandado -and -not (Test-Path $carpetaDelCandado)) { New-Item -ItemType Directory -Force -Path $carpetaDelCandado | Out-Null }
    $script:manejadorDelCandado = [System.IO.File]::Open($archivo, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(("pid {0} desde {1}" -f $PID, (Get-Date -Format 's')))
    $script:manejadorDelCandado.SetLength(0)
    $script:manejadorDelCandado.Write($bytes, 0, $bytes.Length)
    $script:manejadorDelCandado.Flush()
    return $true
  } catch { return $false }
}

# --- el registro, antes que nada: si algo falla, que quede escrito donde falló ---
if (-not (Test-Path $Registro)) { New-Item -ItemType Directory -Force -Path $Registro | Out-Null }
$script:archivoRegistro = Join-Path $Registro ("revision-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
Apunta "===== arranca la revision semanal ====="
if (-not (TomaElCandado $Candado)) {
  Falla 'candado' "hay otra corrida de la revision semanal en marcha (no pude tomar $Candado). Esta no hace nada." 5
}

# ============================================================================
# PONERSE AL DIA, Y POR QUE ESTO NO ES UN ADORNO
# ============================================================================
# Esta tarea vive en su PROPIA carpeta (`dev\alpha-viernes`), separada de la carpeta de
# trabajo de siempre. La razon es un fallo que no avisa: `dev\alpha-app` la comparten
# varias sesiones y va cambiando de rama, asi que un viernes a las 3:00 ese sitio puede
# estar en una rama donde este archivo NI EXISTE. No saltaria ningun error: simplemente
# no habria revisiones, y se notaria el sabado.
#
# Pero una carpeta fija trae el problema contrario: se queda congelada con el codigo del
# dia que se creo. Por eso, antes de nada, se trae lo ultimo de `main`.
#
# Se usa `checkout --detach`, NO `reset --hard`: si alguien dejo algo a medias ahi, esto
# se niega a pisarlo y lo dice, en vez de borrarlo en silencio a las tres de la manana.
if (-not $SinActualizar) {
  Push-Location $repo
  try {
    git fetch origin main --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      # Sin red no se puede publicar igualmente, asi que no se para aqui: se sigue con lo
      # que hay y queda ESCRITO, que es lo que permite entender el registro despues.
      Apunta "AVISO: no pude traer el codigo nuevo (sin red?). Sigo con el que hay."
    } else {
      $antes = (git rev-parse --short HEAD)
      $huellaAntes = (Get-FileHash -Path $PSCommandPath).Hash
      git checkout --detach origin/main --quiet 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Falla 'actualizar el codigo' "no pude ponerme al dia. Hay algo sin guardar en $repo."
      }
      $ahora = (git rev-parse --short HEAD)
      if ($antes -eq $ahora) { Apunta "codigo al dia ($ahora)" }
      else { Apunta "codigo actualizado: $antes -> $ahora" }
      # EL SCRIPT SE LEE ENTERO AL ARRANCAR. Si la actualizacion trae una version nueva de
      # ESTE archivo, lo que corre sigue siendo la vieja: el 12-sep una tanda arranco sin la
      # lista de "fuera" que acababa de llegar con el checkout. Se relanza con la nueva, con
      # los mismos parametros y -SinActualizar para que no vuelva a entrar aqui.
      if ((Get-FileHash -Path $PSCommandPath).Hash -ne $huellaAntes) {
        Apunta "este script cambio con la actualizacion: me relanzo con la version nueva"
        # La corrida nueva tiene que poder tomar el candado: se suelta aqui.
        if ($script:manejadorDelCandado) { $script:manejadorDelCandado.Dispose(); $script:manejadorDelCandado = $null }
        $argumentos = @()
        foreach ($p in $PSBoundParameters.GetEnumerator()) {
          if ($p.Value -is [System.Management.Automation.SwitchParameter]) {
            if ($p.Value.IsPresent) { $argumentos += "-$($p.Key)" }
          } else { $argumentos += @("-$($p.Key)", "$($p.Value)") }
        }
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @argumentos -SinActualizar
        exit $LASTEXITCODE
      }
    }
  } finally { Pop-Location }
}

# Las dependencias tambien: un `package-lock.json` nuevo con los paquetes viejos rompe de
# formas raras, y aqui nadie va a estar mirando.
if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  Apunta "no hay node_modules: instalando (esto tarda unos minutos)"
  Push-Location $repo
  try {
    npm ci 2>&1 | Registra -Callado
    if ($LASTEXITCODE -ne 0) { Falla 'instalar dependencias' 'fallo npm ci' }
  } finally { Pop-Location }
}

# --- la clave ---
if (-not $env:SUPABASE_SERVICE_KEY) {
  $archivoClave = "$env:USERPROFILE\.alpha\service_role.txt"
  if (Test-Path $archivoClave) {
    $env:SUPABASE_SERVICE_KEY = (Get-Content $archivoClave -Raw).Trim()
  }
}
if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL = 'https://sbzmbiwrnvegrticatza.supabase.co' }

if (-not $env:SUPABASE_SERVICE_KEY) {
  Falla 'clave de servicio' "no encuentro la clave de servicio. Ni en la variable de entorno ni en $env:USERPROFILE\.alpha\service_role.txt"
}
Apunta ("clave leida ({0} caracteres). No se imprime." -f $env:SUPABASE_SERVICE_KEY.Length)

# --- que semana ---
if ($Semana) {
  $lunes = $Semana
} else {
  $hoy = Get-Date
  # La semana es la ISO, de lunes a domingo. El viernes en que sale la revision cae DENTRO
  # de la semana que se esta contando, asi que el lunes buscado es el de esta misma semana.
  # OJO: a la hora en que corre, el VIERNES todavia no ha pasado: el audio cuenta de lunes a
  # jueves. Si algun dia se quiere que el viernes entre, se mueve la hora, no la cuenta.
  # DayOfWeek: domingo = 0, y ese domingo sigue perteneciendo a la semana que ya empezo.
  $atras = if ($hoy.DayOfWeek -eq [DayOfWeek]::Sunday) { 6 } else { [int]$hoy.DayOfWeek - 1 }
  $lunes = $hoy.AddDays(-$atras).ToString('yyyy-MM-dd')
}
$carpeta = Join-Path $repo ("salidas\revision-{0}" -f $lunes)
Apunta "semana del $lunes -> $carpeta"

Push-Location $repo
try {
  $manifiesto = Join-Path $carpeta 'manifiesto.json'

  if ($Fase -eq 'manana') {
    # La fase de la manana NO rehace los guiones ni los mensajes: eso ocurrio el jueves por la
    # noche. Si no hay manifiesto, la noche no corrio, y publicar a ciegas seria publicar la
    # semana de otro dia.
    if (-not (Test-Path $manifiesto)) {
      Falla 'manifiesto' "no hay manifiesto en $carpeta. La fase de la noche no corrio."
    }
    Apunta "fase manana: se recoge la cara, se rehacen las pocas voces que falten y se publica"
  } else {
    # ---------- 1. los guiones ----------
    Apunta "paso 1: guiones (la plantilla)"
    $argsGuiones = @('run', 'revision-semanal', '--', '--paso', 'guiones', '--semana', $lunes)
    if (Test-Path $Fuera) { $argsGuiones += @('--fuera-archivo', $Fuera) }
    & npm @argsGuiones 2>&1 | Registra
    if ($LASTEXITCODE -ne 0) { Falla '1 guiones' "salio con codigo $LASTEXITCODE" $LASTEXITCODE }

    # ---------- 1.6 los mensajes: el agente LOCAL ----------
    # Reemplaza al antiguo paso 1.5 ("revision larga"), que mandaba la ficha de la tasa de cada
    # persona a un modelo externo. Decision de Bryan, 22-oct: "Todo en el PC". El agente es Python
    # local (cerebro-alpha-agentes\agentes\mensaje_semanal.py), sin modelo y sin red.
    # NO PARA LA CADENA SI FALLA: el paso 1 ya dejo la plantilla de todos. Si el agente no esta o
    # no responde, queda la plantilla, no se firma nada y el script avisa a Bryan.
    Apunta "paso 1.6: mensajes con el agente local (cerebro: $Cerebro)"
    & npm run mensaje-semanal -- --semana $lunes --cerebro $Cerebro 2>&1 | Registra
    if ($LASTEXITCODE -ne 0) { Apunta "el paso de los mensajes no salio (codigo $LASTEXITCODE). SIGO: todos con la plantilla y sin firma automatica." }

    # ---------- 2. la voz ----------
    # Aqui esta la hora larga de maquina: ~9 min por persona con el PC apretado de memoria. Un
    # proceso de alpha-estudio POR PERSONA, con un reintento: una caida (la del 15-oct, 0xC0000005)
    # le cuesta a una persona, no a la tanda. Se salta los audios que ya existen con el mismo guion,
    # asi que si esto se corta a la mitad, volver a lanzarlo NO repite lo hecho.
    Apunta "paso 2: la voz (alpha-estudio: $Estudio)"
    & npm run generar-voces -- --carpeta $carpeta --estudio $Estudio 2>&1 | Registra
    $codigoVoz = $LASTEXITCODE
    if ($codigoVoz -ne 0) {
      # Antes esto paraba TODO y decia "alguna voz salio corta" para cualquier codigo. Ahora lo
      # que fallo se nombra arriba, persona por persona (con el codigo real del proceso), y la
      # cadena sigue con quien SI tiene audio: el paso 3 dice "SIN AUDIO" de las demas y la tanda
      # sale como INCOMPLETA, con aviso.
      Apunta "el paso 2 (la voz) salio con codigo ${codigoVoz}: faltan voces, ver arriba cuales. SIGO con quien tenga audio."
    }
  }
  $manifiestoCuantos = if (Test-Path $manifiesto) {
    ((Get-Content $manifiesto -Raw | ConvertFrom-Json).encargos).Count
  } else { 0 }

  # ---------- 2.1 (manana) las voces que faltaron por la noche ----------
  # Si la noche dejo a alguien sin audio, se vuelve a intentar UNA vez aqui, pero solo si son pocas:
  # la tarea de la manana tiene limite de 3 h y cada voz tarda unos 9 min.
  if ($Fase -eq 'manana') {
    $m = Get-Content $manifiesto -Raw | ConvertFrom-Json
    $faltan = @($m.encargos | Where-Object { -not $_.omitido -and -not (Test-Path (Join-Path $carpeta ($_.usuarioId + '.mp3'))) -and -not (Test-Path (Join-Path $carpeta ($_.usuarioId + '.mp4'))) })
    if ($faltan.Count -gt 0) {
      if ($faltan.Count -le $MaximoDeVocesPorLaManana) {
        Apunta ("paso 2.1: faltan {0} voces de la noche: se vuelven a intentar" -f $faltan.Count)
        & npm run generar-voces -- --carpeta $carpeta --estudio $Estudio 2>&1 | Registra
        if ($LASTEXITCODE -ne 0) { Apunta "siguen faltando voces (codigo $LASTEXITCODE). SIGO con quien tenga audio." }
      } else {
        Apunta ("faltan {0} voces: son mas de {1}, no caben en la manana. SIGO con quien tenga audio." -f $faltan.Count, $MaximoDeVocesPorLaManana)
      }
    }
  }

  # ---------- 2.5 LA CARA (APAGADA por defecto: solo con -ConCara) ----------
  # El doblaje de labios pide una tarjeta NVIDIA y la de este portatil es AMD, asi que
  # este paso ocurre FUERA: sube los audios a Kaggle, lanza el cuaderno, recoge los mp4
  # y BORRA los audios de alli. Medido el 12-sep: 142 s por video, ~1 h 15 la tanda de 22.
  #
  # DECISION DE BRYAN, 22-oct, "Todo en el PC": los audios llevan el nombre y las cifras de salud de
  # cada persona y NO salen de este equipo salvo que alguien lo pida a proposito con -ConCara. La
  # prueba scripts/lib/cadena-sin-modelo-externo.test.mjs ve este bloque, lo separa como "opt-in" y
  # falla si algo parecido aparece FUERA de el.
  #
  # NO PARA LA CADENA SI FALLA, y es la decision mas importante de este paso: el paso 3
  # publica el mp4 cuando existe y el mp3 cuando no. Un viernes sin cara es un viernes
  # con voz, no un viernes sin revision. Se anota lo que paso y se sigue.
  if ($ConCara) {
    $lanzador = 'C:\Users\ASUS\dev\cara-alpha\lanzar_en_kaggle.py'
    $pythonCara = 'F:\cara-gpu\venv311\Scripts\python.exe'
    if ((Test-Path $lanzador) -and (Test-Path $pythonCara)) {
      # Tres formas segun la fase. De noche se LANZA y se sale: la larga tarda ~4 h y en este
      # equipo un proceso que espera en segundo plano muere por RAM. De manana se RECOGE (y
      # se borran los audios de Kaggle). Completa, como siempre: lanza, espera y recoge.
      $modoCara = switch ($Fase) { 'noche' { @('--sin-esperar') } 'manana' { @('--solo-recoger') } default { @() } }
      Apunta ("paso 2.5: la cara, en Kaggle, FUERA del equipo, porque se pidio -ConCara ({0})" -f $(if ($modoCara) { $modoCara -join ' ' } else { 'lanzar, esperar y recoger' }))
      & $pythonCara $lanzador $carpeta @modoCara 2>&1 | Registra
      if ($LASTEXITCODE -ne 0) {
        Apunta "la cara no salio (codigo $LASTEXITCODE). SIGO: se publicara la voz."
      }
    } else {
      Apunta "no encuentro el lanzador de la cara. SIGO: se publicara la voz."
    }
  } else {
    Apunta "paso 2.5: la cara APAGADA (todo en el PC; solo corre con -ConCara). Se publica la voz."
  }

  if ($Fase -eq 'noche') {
    # La noche no publica. Si la voz quedo incompleta, que el resultado de la tarea y el aviso lo digan:
    # antes la noche del 15-oct salio con codigo 1 sin que nadie lo leyera.
    if ($codigoVoz -ne 0) {
      Falla '2 voz' "la noche termino con voces sin hacer (codigo $codigoVoz). La manana intentara las que falten." $codigoVoz
    }
    Apunta "FASE NOCHE LISTA. La cara se recoge y se publica en la fase de la manana."
    exit 0
  }

  $caras = @(Get-ChildItem -Path $carpeta -Filter *.mp4 -ErrorAction SilentlyContinue)
  Apunta ("caras en la carpeta: {0} de {1}" -f $caras.Count, $manifiestoCuantos)

  # ---------- 3. publicar, sin firmar ----------
  if ($Ensayo) {
    Apunta "paso 3: ENSAYO, no se publica"
    & npm run revision-semanal -- --paso publicar --semana $lunes --ensayo 2>&1 | Registra
  } else {
    Apunta "paso 3: publicar (SIN firmar)"
    # --cara-sobre-voz-firmada: si el coach firmo la VOZ antes del viernes, la cara la
    # reemplaza y la firma se QUITA (vuelve a la bandeja). Un video firmado no se pisa nunca.
    # El codigo de salida es el del BALANCE: 0 solo si se publico (o ya estaba firmada) toda la tanda.
    & npm run revision-semanal -- --paso publicar --semana $lunes --cara-sobre-voz-firmada 2>&1 | Registra
    if ($LASTEXITCODE -ne 0) {
      Falla '3 publicar' "la tanda NO quedo completa (codigo $LASTEXITCODE): hay gente sin audio o rechazada, ver arriba quien." $LASTEXITCODE
    }
  }

  # ---------- 4. la firma automatica (APAGADA por defecto) ----------
  $firmaEncendida = ($FirmaAutomatica.IsPresent -or (Test-Path $FirmaAutomaticaArchivo))
  if ($Ensayo) {
    Apunta "paso 4: ENSAYO de la firma automatica (no toca nada)"
    & npm run revision-semanal -- --paso firmar --semana $lunes --ensayo 2>&1 | Registra
  } elseif ($firmaEncendida) {
    Apunta "paso 4: firma automatica ENCENDIDA (decision de Bryan, 21-oct). Firma solo lo que el agente marco publicar."
    & npm run revision-semanal -- --paso firmar --semana $lunes 2>&1 | Registra
    if ($LASTEXITCODE -ne 0) {
      Falla '4 firma' "la firma automatica fallo (codigo $LASTEXITCODE): las revisiones quedaron publicadas pero SIN FIRMAR, en la bandeja del coach." $LASTEXITCODE
    }
  } else {
    Apunta "paso 4: firma automatica APAGADA (no existe $FirmaAutomaticaArchivo ni se pidio -FirmaAutomatica)."
  }

  if ($firmaEncendida -and -not $Ensayo) {
    Apunta "LISTO. Publicadas y firmadas las que el agente marco publicar; el resto espera en la bandeja del coach."
  } else {
    Apunta "LISTO. Publicadas SIN FIRMAR: las revisiones esperan FIRMA en la bandeja del coach."
    Apunta "Nadie las ve hasta que se firmen."
  }
}
finally {
  Pop-Location
}
