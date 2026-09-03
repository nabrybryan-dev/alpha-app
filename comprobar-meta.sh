#!/usr/bin/env bash
# Evalua la condicion de terminado VIGENTE (salon 4D, 2-sep-2026).
# Sale 0 si se cumple, 1 si no.
#
# HISTORIA DE POR QUE ESTA ASI, que es lo unico que impide que vuelva a pasar:
#
#   La version anterior salia 0 el 2-sep con un acta del 29-ago levantada sobre otro
#   montaje, con una cascara de HTML falso viva en visor/, con construirSala sin una
#   sola llamada y con salon.test.tsx en rojo. Daba META CUMPLIDA. No mentia: es que
#   no miraba nada de eso.
#
#   Tres agujeros, y cada comprobacion de aqui abajo tapa uno:
#     1. no miraba la FECHA del acta, asi que un acta vieja valia para siempre;
#     2. solo barria src/features/entrenar/salon, y la cascara vivia en visor/;
#     3. terminaba diciendo "(falta aparte: npx vitest run)", y esa frase es la razon
#        mecanica de que una prueba roja no bloqueara nada durante dias.
#
#   Y uno mas, de fondo: el acta daba por buenos "sala" e "implementos" midiendo las
#   capas SVG/HTML que se pintan ENCIMA del lienzo, no la escena. Por eso ahora se
#   exige `enLienzo` en los cuatro elementos que son escena de verdad.
#
# Uso:
#   bash comprobar-meta.sh            comprobacion completa (la que decide la meta)
#   bash comprobar-meta.sh --rapido   igual pero sin `npm run verify`, para trabajar
set -o pipefail
cd "$(dirname "$0")" || exit 1

RAPIDO=0
[ "$1" = "--rapido" ] && RAPIDO=1

fallos=0
paso() { printf '  OK    %s\n' "$1"; }
falla() { printf '  FALLA %s\n' "$1"; fallos=$((fallos + 1)); }

echo "== 1. los dos ficheros del testigo =="
for f in testigo/salon-visible.mjs informes/testigo-salon.json; do
  if [ -s "$f" ]; then paso "$f"; else falla "$f (falta o vacio)"; fi
done

echo "== 2. el acta: variante, formato, cinco elementos en el lienzo y eje W =="
if [ -s informes/testigo-salon.json ]; then
  node scripts/leer-acta.mjs || fallos=$((fallos + 1))
else
  falla "no hay acta que leer"
fi

echo "== 3. el acta es POSTERIOR al codigo que certifica =="
if [ -s informes/testigo-salon.json ]; then
  node scripts/acta-fresca.mjs || fallos=$((fallos + 1))
else
  falla "no hay acta que fechar"
fi

echo "== 4. sin marcadores de trabajo sin acabar =="
zonas=""
for d in src/features/entrenar testigo informes; do
  [ -e "$d" ] && zonas="$zonas $d"
done
# `{false &&` es la cascara apagada con un literal: no es un TODO, no es un comentario,
# y ningun patron de los de antes la cazaba. Vivio dias en VisorPatron.tsx sin que nada
# chillara, porque ademas estaba en una carpeta que este barrido no visitaba.
#
# POR QUE EL PATRON ES TAN ESTRECHO, que es lo que costo una vuelta:
#
#   `\bTODO\b` a secas caza la palabra espanola TODO. La primera corrida saco ocho
#   lineas y CINCO eran prosa legitima: "recalcular el desenfoque de TODO el viewport",
#   "siguen viendose en TODO el recorrido", "Lo diste TODO hoy". Y `placeholder` a
#   secas caza el atributo `placeholder="sentadilla"` de un campo de verdad y los
#   comentarios que dicen "ni marco vacio ni placeholder", que es justo lo contrario
#   de dejar relleno.
#
#   Un guardian que da falsos rojos se acaba desactivando, y entonces no guarda nada.
#   Asi que un marcador solo cuenta cuando ABRE un comentario (`// TODO`, `/* FIXME`)
#   o esta en mayusculas como marca; la prosa que MENCIONA un placeholder no es relleno.
sucio=$(grep -rnE "(//|/\*|\*|\{/\*)[[:space:]]*(TODO|FIXME|XXX|HACK)\b|\{false &&|[Ll]orem [Ii]psum|PLACEHOLDER|NO MEDIDO|NO COMPROBADO" $zonas 2>/dev/null)
if [ -z "$sucio" ]; then
  paso "cero lineas"
else
  falla "$(printf '%s\n' "$sucio" | wc -l | tr -d ' ') lineas"
  printf '%s\n' "$sucio" | head -8 | sed 's/^/        /'
fi

echo "== 5. sin archivos vacios =="
vacios=$(find src/features/entrenar testigo -type f -empty 2>/dev/null)
if [ -z "$vacios" ]; then
  paso "cero archivos vacios"
else
  falla "$(printf '%s\n' "$vacios" | wc -l | tr -d ' ') archivos vacios"
  printf '%s\n' "$vacios" | head -5 | sed 's/^/        /'
fi

echo "== 6. el guardian de huerfanos vigila features/entrenar =="
# No basta con que el guardian exista: tiene que MIRAR esta carpeta, y tiene que
# hacerlo sin dejar que un banco de pruebas de scripts/ avale codigo que la app no usa.
if grep -q "src/features/entrenar" src/test/codigo-huerfano.test.ts 2>/dev/null &&
  grep -q "carpetasConsumidoras" src/test/codigo-huerfano.test.ts 2>/dev/null; then
  paso "declarado en src/test/codigo-huerfano.test.ts"
else
  falla "src/test/codigo-huerfano.test.ts no vigila src/features/entrenar con carpetasConsumidoras propia"
fi

echo "== 7. conflictos con origin/main =="
base=$(git merge-base HEAD origin/main 2>/dev/null)
if [ -z "$base" ]; then
  falla "no hay merge-base con origin/main"
else
  conf=$(git merge-tree "$base" HEAD origin/main 2>/dev/null | grep -c '^<<<<<<<')
  if [ "$conf" -eq 0 ]; then paso "0 conflictos"; else falla "$conf conflictos"; fi
fi

echo "== 8. tipos, lint y las pruebas =="
if [ "$RAPIDO" -eq 1 ]; then
  printf '  SALTADO  npm run verify (--rapido). Esta comprobacion NO cuenta como pasada.\n'
  falla "verify saltado: --rapido no puede cerrar la meta"
else
  if npm run verify >/tmp/verify.log 2>&1; then
    paso "npm run verify limpio"
  else
    falla "npm run verify"
    tail -14 /tmp/verify.log | sed 's/^/        /'
  fi
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "META CUMPLIDA"
else
  echo "META NO CUMPLIDA: $fallos comprobaciones fallan"
fi
exit $((fallos > 0))
