#!/usr/bin/env bash
# Evalua la condicion de terminado VIGENTE (salon a pantalla completa, 30-ago).
# Sale 0 si se cumple, 1 si no.
#
# OJO: esta es la condicion NUEVA. La anterior buscaba 'pendiente' sin distinguir
# mayusculas y cazaba 'independiente' y 'metodo'. Ya no.
cd "$(dirname "$0")" || exit 1
fallos=0
paso() { printf '  OK    %s\n' "$1"; }
falla() { printf '  FALLA %s\n' "$1"; fallos=$((fallos+1)); }

echo "== 1. los dos ficheros del testigo =="
for f in testigo/salon-visible.mjs informes/testigo-salon.json; do
  if [ -s "$f" ]; then paso "$f"; else falla "$f (falta o vacio)"; fi
done

echo "== 2. el acta: cinco elementos visibles, pestana visible, 9:16 =="
if [ -s informes/testigo-salon.json ]; then
  node -e '
    const a = require("./informes/testigo-salon.json")
    const claves = ["sala","letras3D","sujeto","camara","implementos"]
    let mal = 0
    if (a.pestanaVisible !== true) { console.log("  FALLA pestanaVisible no es true"); mal++ }
    if (a.formato !== "9:16") { console.log("  FALLA formato no es 9:16 (" + a.formato + ")"); mal++ }
    for (const k of claves) {
      const e = (a.elementos || {})[k]
      if (!e || e.visible !== true || !(e.pixeles > 0)) {
        console.log("  FALLA " + k + ": " + JSON.stringify(e))
        mal++
      } else {
        console.log("  OK    " + k + " " + e.pixeles + " px")
      }
    }
    if (a.rama) console.log("  (acta levantada sobre la rama " + a.rama + ", usuario " + (a.usuario || "?") + ")")
    process.exit(mal > 0 ? 1 : 0)
  ' || fallos=$((fallos+1))
else
  falla "no hay acta que leer"
fi

echo "== 3. sin marcadores de trabajo sin acabar =="
zonas=""
for d in src/features/entrenar/salon testigo informes; do
  [ -e "$d" ] && zonas="$zonas $d"
done
sucio=$(grep -rnE "\bTODO\b|\bFIXME\b|\bXXX\b|placeholder|lorem|NO MEDIDO|NO COMPROBADO" $zonas 2>/dev/null)
if [ -z "$sucio" ]; then paso "cero lineas"; else
  falla "$(printf '%s' "$sucio" | wc -l | tr -d ' ') lineas"
  printf '%s\n' "$sucio" | head -8 | sed 's/^/        /'
fi

echo "== 4. tipos =="
if npx tsc --noEmit >/tmp/tsc.log 2>&1; then paso "tsc --noEmit limpio"; else
  falla "tsc: $(grep -c 'error TS' /tmp/tsc.log) errores"
  grep 'error TS' /tmp/tsc.log | head -6 | sed 's/^/        /'
fi

echo "== 5. conflictos con origin/main =="
base=$(git merge-base HEAD origin/main)
conf=$(git merge-tree "$base" HEAD origin/main 2>/dev/null | grep -c '^<<<<<<<')
if [ "$conf" -eq 0 ]; then paso "0 conflictos"; else falla "$conf conflictos"; fi

echo
echo "  (falta aparte: npx vitest run)"
if [ "$fallos" -eq 0 ]; then echo "META CUMPLIDA salvo vitest"; else echo "META NO CUMPLIDA: $fallos comprobaciones fallan"; fi
exit $((fallos > 0))
