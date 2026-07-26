@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Centro de Respuestas Alpha - Publicar fichas

echo.
echo   ============================================
echo    CENTRO DE RESPUESTAS ALPHA
echo    Publicar las 50 fichas y medir el buscador
echo   ============================================
echo.

rem ---------- 1. comprobar el archivo de claves ----------

if not exist "CLAVES.local.txt" (
  echo   [ALTO] No encuentro el archivo CLAVES.local.txt
  echo.
  echo   Tiene que estar en esta misma carpeta, junto a este .bat
  echo.
  pause
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("CLAVES.local.txt") do (
  set "_k=%%a"
  set "_v=%%b"
  if not "!_k!"=="" set "!_k!=!_v!"
)

rem ---------- 2. comprobar que estan las tres ----------

set "_falta="
if "%OPENAI_API_KEY%"==""       set "_falta=!_falta! OPENAI_API_KEY"
if "%SUPABASE_URL%"==""         set "_falta=!_falta! SUPABASE_URL"
if "%SUPABASE_SERVICE_KEY%"=="" set "_falta=!_falta! SUPABASE_SERVICE_KEY"

if not "%_falta%"=="" (
  echo   [ALTO] Falta llenar en CLAVES.local.txt:
  echo         %_falta%
  echo.
  echo   Abre CLAVES.local.txt con el Bloc de notas, pega los
  echo   valores despues del signo = , guarda y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

echo   Claves leidas correctamente.
echo.

rem ---------- 3. revisar que las 50 fichas esten sanas ----------

echo   [1 de 3] Revisando las 50 fichas...
echo.
call npm run validar-fichas
if errorlevel 1 (
  echo.
  echo   [ALTO] Alguna ficha tiene un error. No se publico nada.
  echo   Pasale a Claude lo que aparece arriba.
  echo.
  pause
  exit /b 1
)

rem ---------- 4. publicar ----------

echo.
echo   [2 de 3] Subiendo las fichas a Supabase...
echo   (esto pide los vectores a OpenAI, tarda unos segundos)
echo.
call npm run publicar-fichas
if errorlevel 1 (
  echo.
  echo   [ALTO] No se pudieron publicar. Mira el mensaje de arriba.
  echo.
  echo   Lo mas comun:
  echo     - La clave de OpenAI esta mal pegada o sin saldo
  echo     - La migracion 0010 todavia no se corrio en Supabase
  echo.
  pause
  exit /b 1
)

rem ---------- 5. calibrar ----------

echo.
echo   [3 de 3] Probando el buscador con 15 preguntas reales...
echo.
call npm run calibrar-umbrales > "RESULTADO.local.txt" 2>&1
type "RESULTADO.local.txt"

echo.
echo   ============================================
echo    LISTO
echo   ============================================
echo.
echo   El resultado quedo guardado en:
echo     RESULTADO.local.txt
echo.
echo   Ese archivo esta en esta misma carpeta.
echo   Abrelo, copia todo, y pasaselo a Claude.
echo.
pause
