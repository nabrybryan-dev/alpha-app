#!/usr/bin/env bash
# Evalua la condicion de terminado del PENDIENTE 2 de SEMANA-2.md: las otras cuatro
# pantallas, con movimiento. Sale 0 si se cumple, 1 si no.
#
# Hermano de `comprobar-meta.sh` y con las mismas cicatrices, que se ganaron el 2-sep
# midiendo el salon:
#
#   - LEE ACTAS, NO LEVANTA CHROME. Preguntar si la meta esta cumplida no puede costar
#     un navegador. Las actas las escribe `testigo/casillas-quietas.mjs`.
#   - LAS ACTAS CADUCAN. Una que certifica una pantalla que ya se ha tocado no certifica
#     nada. La del salon estuvo cuatro dias en verde hablando de una pantalla que ya no
#     existia, y nadie lo noto porque nadie miraba la fecha.
#   - EXIGE HABER VISTO AL TESTIGO DECIR QUE NO. Un contador de ausencias que nunca se
#     ha puesto rojo daria cero quietas tambien el dia que dejara de mirar. Por eso la
#     prueba ciega deja su propia acta y aqui se comprueba.
#   - NO SE PUEDE APROBAR CONTANDO CERO CASILLAS. Si el buscador se rompe y no encuentra
#     ninguna, `quietas` vale 0 y la meta saldria cumplida por haber dejado de mirar.
#
# Uso:
#   bash comprobar-casillas.sh            comprobacion completa (la que decide la meta)
#   bash comprobar-casillas.sh --rapido   igual pero sin `npm run verify`, para trabajar
set -o pipefail
cd "$(dirname "$0")" || exit 1

RAPIDO=0
[ "$1" = "--rapido" ] && RAPIDO=1

fallos=0
paso() { printf '  OK    %s\n' "$1"; }
falla() { printf '  FALLA %s\n' "$1"; fallos=$((fallos + 1)); }

# Las cuatro pantallas del pendiente 2. El salon no esta: tiene su propia meta.
ZONAS="src/features/hoy src/features/bienestar src/features/nutricion src/features/progreso"

echo "== 1. el testigo y sus dos actas =="
for f in testigo/casillas-quietas.mjs informes/testigo-casillas.json informes/testigo-casillas-ciega.json; do
  if [ -s "$f" ]; then paso "$f"; else falla "$f (falta o vacio)"; fi
done

echo "== 2. cero casillas quietas, y sobre un censo que no esta vacio =="
if [ -s informes/testigo-casillas.json ]; then
  node -e '
    const a = require("./informes/testigo-casillas.json")
    let mal = 0
    if (!(a.total > 0)) {
      console.log("  FALLA el censo esta vacio (" + a.total + " casillas): cero quietas por haber dejado de mirar")
      mal++
    }
    for (const p of a.pantallas || []) {
      if (p.quietas === 0) console.log("  OK    " + p.ruta + ": " + p.casillas + " casillas, ninguna quieta")
      else {
        console.log("  FALLA " + p.ruta + ": " + p.quietas + " de " + p.casillas + " sin diseno en tres dimensiones")
        for (const q of (p.lasQuietas || []).slice(0, 6)) console.log("          " + q.area + " px2  " + q.etiqueta)
        mal++
      }
    }
    process.exit(mal > 0 ? 1 : 0)
  ' || fallos=$((fallos + 1))
else
  falla "no hay acta que leer"
fi

echo "== 3. las dos actas son POSTERIORES a las pantallas que certifican =="
node scripts/acta-fresca.mjs --acta=informes/testigo-casillas.json --vigila="$ZONAS" || fallos=$((fallos + 1))
node scripts/acta-fresca.mjs --acta=informes/testigo-casillas-ciega.json --vigila="$ZONAS" || fallos=$((fallos + 1))

echo "== 4. el testigo sabe decir que no =="
if [ -s informes/testigo-casillas-ciega.json ]; then
  node -e '
    const c = require("./informes/testigo-casillas-ciega.json")
    if (c.vioElCebo === true && c.casillas > 0) {
      console.log("  OK    encontro la casilla muerta sobre " + c.casillas + " del censo")
      process.exit(0)
    }
    console.log("  FALLA la prueba ciega no lo vio: " + JSON.stringify(c))
    process.exit(1)
  ' || fallos=$((fallos + 1))
else
  falla "no hay acta de la prueba ciega"
fi

echo "== 5. sin marcadores ni archivos vacios en esas cuatro carpetas =="
sucio=$(grep -rnE "(//|/\*|\*|\{/\*)[[:space:]]*(TODO|FIXME|XXX|HACK)\b|\{false &&|[Ll]orem [Ii]psum|PLACEHOLDER|NO MEDIDO|NO COMPROBADO" $ZONAS 2>/dev/null)
if [ -z "$sucio" ]; then paso "cero lineas"; else
  falla "$(printf '%s\n' "$sucio" | wc -l | tr -d ' ') lineas"
  printf '%s\n' "$sucio" | head -6 | sed 's/^/        /'
fi
vacios=$(find $ZONAS -type f -empty 2>/dev/null)
if [ -z "$vacios" ]; then paso "cero archivos vacios"; else falla "$(printf '%s\n' "$vacios" | wc -l | tr -d ' ') vacios"; fi

echo "== 6. tipos, lint y las pruebas =="
if [ "$RAPIDO" -eq 1 ]; then
  printf '  SALTADO  npm run verify (--rapido). Esta comprobacion NO cuenta como pasada.\n'
  falla "verify saltado: --rapido no puede cerrar la meta"
else
  if npm run verify >/tmp/verify-casillas.log 2>&1; then
    paso "npm run verify limpio"
  else
    falla "npm run verify"
    tail -14 /tmp/verify-casillas.log | sed 's/^/        /'
  fi
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "META CUMPLIDA"
else
  echo "META NO CUMPLIDA: $fallos comprobaciones fallan"
fi
exit $((fallos > 0))
