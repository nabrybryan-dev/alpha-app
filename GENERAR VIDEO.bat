@echo off
rem Lanzador del generador de paquetes de video.
rem Se puede ARRASTRAR un brief .json encima de este archivo, o ejecutarlo sin nada
rem para usar el de ejemplo. Igual que los otros .bat: se situa en su propia carpeta,
rem asi que da igual desde donde se abra.
cd /d "%~dp0"

set "BRIEF=%~1"
if "%BRIEF%"=="" set "BRIEF=docs\video\briefs\ejemplo-ajuste-semanal.json"

if not exist "%BRIEF%" (
  echo No encuentro el brief: %BRIEF%
  echo Arrastra un archivo .json de docs\video\briefs encima de este .bat.
  pause
  exit /b 1
)

node scripts\generar-paquete-video.mjs "%BRIEF%"
echo.
pause
