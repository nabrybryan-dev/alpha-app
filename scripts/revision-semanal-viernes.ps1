# EL VIERNES, SOLO. Los tres pasos de la revision semanal, sin que nadie teclee nada.
#
# Nace de una pregunta de Bryan que era la correcta: "pero eso significa que cada ocho dias
# lo tendria que hacer". Si hay que pegar una orden cada semana, esto no esta automatizado:
# esta esperando a que alguien se acuerde. Y alguien se olvida.
#
#   1. calcula los numeros de cada quien y escribe su guion
#   2. genera su audio con la voz clonada
#   3. lo sube y escribe su ficha -SIN APROBAR-
#
# Lo unico que sigue siendo de Bryan es la firma. Eso no se automatiza nunca: es lo que
# separa "la maquina dijo algo con mi voz" de "yo se lo dije".
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
  # Donde vive el entorno de Python con el modelo de voz.
  [string]$Voz = 'C:\Users\ASUS\dev\prueba-voz',
  # Donde se escribe el registro de lo que paso.
  [string]$Registro = "$env:USERPROFILE\.alpha\registros",
  # No traerse el codigo nuevo antes de correr. Para probar con lo que hay delante.
  [switch]$SinActualizar,
  # Saltarse la cara y publicar solo la voz. Para una semana con prisa o con Kaggle caido.
  [switch]$SinCara,
  # QUE PARTE DE LA CADENA SE CORRE. La revision larga (decision de Bryan, 12-sep: 2-3 min por
  # persona) no cabe en una sola tarea de 4 h: la voz pasa a ~3 h y la cara a ~4 h en Kaggle.
  #   completa : todo seguido, como siempre (la revision corta de 15 s cabe).
  #   noche    : jueves. Guiones, revision larga, voz, y LANZAR la cara sin esperarla.
  #   manana   : viernes. RECOGER la cara y publicar sin firmar.
  [ValidateSet('completa', 'noche', 'manana')]
  [string]$Fase = 'completa',
  # La lista de quien lleva revision larga: un nombre por linea, tal cual esta en la app.
  # Si el archivo no existe, todos salen con la corta.
  [string]$Larga = "$env:USERPROFILE\.alpha\revision-larga.txt",
  # Quien NO recibe video aunque tenga microciclo activo (inactivos): un nombre por linea.
  # Si el archivo no existe, sale la tanda entera.
  [string]$Fuera = "$env:USERPROFILE\.alpha\revision-fuera.txt",
  # Donde vive cerebro-alpha-agentes con `agentes/tasa_contra_el_plan.py` y los planes.
  [string]$Cerebro = 'C:\Users\ASUS\dev\cerebro-alpha-tasa'
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

function Apunta($texto) {
  $linea = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
  Write-Host $linea
  Add-Content -Path $script:archivoRegistro -Value $linea -Encoding utf8
}

# --- el registro, antes que nada: si algo falla, que quede escrito donde falló ---
if (-not (Test-Path $Registro)) { New-Item -ItemType Directory -Force -Path $Registro | Out-Null }
$script:archivoRegistro = Join-Path $Registro ("revision-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
Apunta "===== arranca la revision semanal ====="

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
      git checkout --detach origin/main --quiet 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Apunta "PARO: no pude ponerme al dia. Hay algo sin guardar en $repo."
        exit 1
      }
      $ahora = (git rev-parse --short HEAD)
      if ($antes -eq $ahora) { Apunta "codigo al dia ($ahora)" }
      else { Apunta "codigo actualizado: $antes -> $ahora" }
    }
  } finally { Pop-Location }
}

# Las dependencias tambien: un `package-lock.json` nuevo con los paquetes viejos rompe de
# formas raras, y aqui nadie va a estar mirando.
if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  Apunta "no hay node_modules: instalando (esto tarda unos minutos)"
  Push-Location $repo
  try {
    npm ci 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro | Out-Null
    if ($LASTEXITCODE -ne 0) { Apunta "PARO: fallo la instalacion de dependencias"; exit 1 }
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
  Apunta "PARO: no encuentro la clave de servicio. Ni en la variable de entorno ni en $env:USERPROFILE\.alpha\service_role.txt"
  exit 1
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
    # La fase de la manana NO rehace nada: guiones, revision larga y voz ya ocurrieron el
    # jueves por la noche. Si no hay manifiesto, la noche no corrio, y publicar a ciegas seria
    # publicar la semana de otro dia.
    if (-not (Test-Path $manifiesto)) {
      Apunta "PARO: no hay manifiesto en $carpeta. La fase de la noche no corrio."
      exit 1
    }
    Apunta "fase manana: se recoge la cara y se publica"
  } else {
    # ---------- 1. los guiones ----------
    Apunta "paso 1: guiones"
    $argsGuiones = @('run', 'revision-semanal', '--', '--paso', 'guiones', '--semana', $lunes)
    if (Test-Path $Fuera) { $argsGuiones += @('--fuera-archivo', $Fuera) }
    & npm @argsGuiones 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
    if ($LASTEXITCODE -ne 0) { Apunta "PARO en el paso 1 (codigo $LASTEXITCODE)"; exit 1 }

    # ---------- 1.5 la revision larga ----------
    # Para los elegidos en $Larga: la tasa contra su plan, redactada por un modelo con las
    # cifras en huecos. NO PARA LA CADENA SI FALLA: el paso 1 ya dejo la corta de todos, asi
    # que lo peor que pasa es un viernes con la revision de siempre.
    if (Test-Path $Larga) {
      Apunta "paso 1.5: revision larga para los elegidos en $Larga"
      & npm run revision-larga -- --semana $lunes --personas-archivo $Larga --cerebro $Cerebro 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
      if ($LASTEXITCODE -ne 0) { Apunta "la revision larga no salio (codigo $LASTEXITCODE). SIGO: todos con la corta." }
    } else {
      Apunta "sin lista de revision larga en $Larga : todos con la corta"
    }

    # ---------- 2. la voz ----------
    # Aqui esta la hora larga de maquina (~40 min la corta, ~3 h con la larga de la mitad).
    # El generador se salta los audios que ya existen con el mismo guion, asi que si esto se
    # corta a la mitad, volver a lanzarlo NO repite lo hecho.
    Apunta "paso 2: la voz"
    $python = Join-Path $Voz '.venv\Scripts\python.exe'
    $generador = Join-Path $Voz 'generar_revisiones.py'
    if (-not (Test-Path $python))    { Apunta "PARO: no esta el Python de la voz en $python"; exit 1 }
    if (-not (Test-Path $generador)) { Apunta "PARO: no esta el generador en $generador"; exit 1 }

    & $python $generador $carpeta 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
    if ($LASTEXITCODE -ne 0) {
      # El generador devuelve error cuando alguna revision salio CORTA. Eso no se publica a
      # medias: media revision son justo los numeros que faltan.
      Apunta "PARO en el paso 2 (codigo $LASTEXITCODE): alguna voz salio corta. No se publica nada."
      exit 1
    }
  }
  $manifiestoCuantos = if (Test-Path $manifiesto) {
    ((Get-Content $manifiesto -Raw | ConvertFrom-Json).encargos).Count
  } else { 0 }

  # ---------- 2.5 LA CARA ----------
  # El doblaje de labios pide una tarjeta NVIDIA y la de este portatil es AMD, asi que
  # este paso ocurre FUERA: sube los audios a Kaggle, lanza el cuaderno, recoge los mp4
  # y BORRA los audios de alli. Medido el 12-sep: 142 s por video, ~1 h 15 la tanda de 22.
  #
  # NO PARA LA CADENA SI FALLA, y es la decision mas importante de este paso: el paso 3
  # publica el mp4 cuando existe y el mp3 cuando no. Un viernes sin cara es un viernes
  # con voz, no un viernes sin revision. Se anota lo que paso y se sigue.
  if (-not $SinCara) {
    $lanzador = 'C:\Users\ASUS\dev\cara-alpha\lanzar_en_kaggle.py'
    $pythonCara = 'F:\cara-gpu\venv311\Scripts\python.exe'
    if ((Test-Path $lanzador) -and (Test-Path $pythonCara)) {
      # Tres formas segun la fase. De noche se LANZA y se sale: la larga tarda ~4 h y en este
      # equipo un proceso que espera en segundo plano muere por RAM. De manana se RECOGE (y
      # se borran los audios de Kaggle). Completa, como siempre: lanza, espera y recoge.
      $modoCara = switch ($Fase) { 'noche' { @('--sin-esperar') } 'manana' { @('--solo-recoger') } default { @() } }
      Apunta ("paso 2.5: la cara, en Kaggle ({0})" -f $(if ($modoCara) { $modoCara -join ' ' } else { 'lanzar, esperar y recoger' }))
      & $pythonCara $lanzador $carpeta @modoCara 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
      if ($LASTEXITCODE -ne 0) {
        Apunta "la cara no salio (codigo $LASTEXITCODE). SIGO: se publicara la voz."
      }
    } else {
      Apunta "no encuentro el lanzador de la cara. SIGO: se publicara la voz."
    }
  }

  if ($Fase -eq 'noche') {
    Apunta "FASE NOCHE LISTA. La cara se recoge y se publica en la fase de la manana."
    exit 0
  }

  $caras = @(Get-ChildItem -Path $carpeta -Filter *.mp4 -ErrorAction SilentlyContinue)
  Apunta ("caras en la carpeta: {0} de {1}" -f $caras.Count, $manifiestoCuantos)

  # ---------- 3. publicar, sin firmar ----------
  if ($Ensayo) {
    Apunta "paso 3: ENSAYO, no se publica"
    & npm run revision-semanal -- --paso publicar --semana $lunes --ensayo 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
  } else {
    Apunta "paso 3: publicar (SIN aprobar)"
    & npm run revision-semanal -- --paso publicar --semana $lunes 2>&1 | Tee-Object -Append -FilePath $script:archivoRegistro
    if ($LASTEXITCODE -ne 0) { Apunta "PARO en el paso 3 (codigo $LASTEXITCODE)"; exit 1 }
  }

  Apunta "LISTO. Las revisiones esperan FIRMA en la bandeja del coach."
  Apunta "Nadie las ve hasta que se firmen."
}
finally {
  Pop-Location
}
