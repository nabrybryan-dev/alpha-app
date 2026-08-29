#!/usr/bin/env bash
# Evalua la condicion de terminado. Sale 0 si se cumple, 1 si no.
cd "$(dirname "$0")" || exit 1
fallos=0
paso() { printf '  OK    %s\n' "$1"; }
falla() { printf '  FALLA %s\n' "$1"; fallos=$((fallos+1)); }

echo "== 1. archivos exigidos =="
for f in \
  src/features/entrenar/salon/SalonEntrenar.tsx \
  src/features/entrenar/salon/huecos.ts \
  src/features/entrenar/salon/paredes/contenidoPared.ts \
  src/features/entrenar/salon/paredes/PanelPared.tsx \
  src/features/entrenar/salon/panel/PanelInferior.tsx \
  src/features/entrenar/salon/registro/RegistroSerieSalon.tsx \
  src/features/entrenar/salon/sinPatron/SalonSinSujeto.tsx \
  src/features/entrenar/capas/nivelesAnatomicos.ts \
  src/features/entrenar/capas/gestoVertical.ts \
  src/features/entrenar/escena/sala.ts \
  src/features/entrenar/escena/tripode.ts \
  pruebas/inventario-entrenar.ts \
  informes/congelado-visor.md \
  informes/verificacion-iphone.md \
  riesgos/RIESGOS.md
do
  if [ -s "$f" ]; then paso "$f"; else falla "$f (falta o vacio)"; fi
done

echo "== 2. las tres llamadas en VisorPatron =="
visor=$(find src -name VisorPatron.tsx | head -1)
if [ -n "$visor" ]; then
  n=0
  for t in "lineaDePeso(" "sala(" "tripode("; do
    grep -qF "$t" "$visor" && n=$((n+1))
  done
  if [ "$n" -eq 3 ]; then paso "$visor tiene las tres"; else falla "$visor solo tiene $n de 3"; fi
else
  falla "no existe VisorPatron.tsx"
fi

echo "== 3. sin pendientes ni relleno =="
zonas=""
for d in src/features/entrenar/salon src/features/entrenar/capas src/features/entrenar/escena informes riesgos pruebas; do
  [ -d "$d" ] && zonas="$zonas $d"
done
if [ -n "$zonas" ]; then
  sucio=$(grep -rniE "TODO|FIXME|pendiente|placeholder|lorem|NO MEDIDO|NO COMPROBADO" $zonas 2>/dev/null)
  if [ -z "$sucio" ]; then paso "cero lineas de relleno"; else
    falla "$(printf '%s' "$sucio" | wc -l | tr -d ' ') lineas de relleno"
    printf '%s\n' "$sucio" | head -12 | sed 's/^/        /'
  fi
else
  falla "no existe ninguna de las carpetas"
fi

echo "== 4. tipos =="
if npx tsc --noEmit >/tmp/tsc.log 2>&1; then paso "tsc --noEmit limpio"; else
  falla "tsc: $(grep -c 'error TS' /tmp/tsc.log) errores"; grep 'error TS' /tmp/tsc.log | head -8 | sed 's/^/        /'
fi

echo "== 5. conflictos con origin/main =="
base=$(git merge-base salon/entrenar-4d origin/main)
conf=$(git merge-tree "$base" salon/entrenar-4d origin/main 2>/dev/null | grep -c '^<<<<<<<')
if [ "$conf" -eq 0 ]; then paso "0 conflictos"; else falla "$conf conflictos"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "META CUMPLIDA (falta npx vitest run)"; else echo "META NO CUMPLIDA: $fallos comprobaciones fallan"; fi
exit $((fallos > 0))
