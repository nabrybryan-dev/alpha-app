#!/usr/bin/env bash
# Aplica TODAS las migraciones en orden sobre una base limpia.
#
# POR QUÉ EN BASH Y CON psql, Y NO EN NODE. Las migraciones llevan funciones con
# cuerpos entre `$$ ... $$` que contienen puntos y coma. Partir el archivo por
# `;` desde JavaScript rompe esas funciones por la mitad y da errores que no
# tienen nada que ver con el fallo real. `psql` ya sabe leer SQL: usarlo evita
# reimplementar un parser y evita añadir una dependencia (`pg`) al proyecto.
#
# Este script vale por sí solo aunque no hubiera ni una prueba detrás: hoy nadie
# comprueba que la 0001 → 00NN corran seguidas sobre una base vacía. Una
# migración que dependa de algo que otra borró se descubriría en producción.

set -euo pipefail

: "${DATABASE_URL:?Hace falta DATABASE_URL}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRACIONES="$RAIZ/supabase/migrations"

echo "── Suplantando lo mínimo de Supabase ──"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$RAIZ/supabase/test/00-suplantar-supabase.sql"

echo "── Aplicando migraciones ──"
# Orden lexicográfico = orden numérico, porque van con cuatro dígitos. Se
# excluyen los `.local.sql`: llevan datos reales de asesorados y no se commitean.
for archivo in "$MIGRACIONES"/[0-9]*.sql; do
  nombre="$(basename "$archivo")"
  case "$nombre" in
    # Llevan datos reales de asesorados y no se commitean.
    *.local.sql) echo "   (omitida $nombre · local)"; continue ;;
    # La semilla NO es esquema: no crea ni una tabla ni una política, solo mete
    # datos de prueba. Y aborta a propósito si no encuentra dos correos que hay
    # que editar a mano antes de correrla, así que en CI siempre fallaría. Lo que
    # aquí se prueba es el esquema; los datos los pone cada prueba.
    *semilla*) echo "   (omitida $nombre · datos, no esquema)"; continue ;;
  esac

  # Las altas de catálogo tampoco son esquema, y no se pueden aplicar aquí.
  #
  # EL CATÁLOGO NO SE CARGA CON MIGRACIONES. Los 1.200 alimentos entran desde
  # `herramientas/base-alimentos/cargar_catalogo-*.sql`, que son 1,3 MB y viven
  # FUERA de este repositorio. Las altas posteriores dan por hecho que ya están:
  # la 0029 mete una receta de agua de panela cuyo ingrediente es
  # `azucar-morena`, y contra una base sin catálogo eso revienta por clave ajena.
  #
  # Se detectan por contenido y no por una lista escrita a mano: si el archivo
  # inserta en las tablas del catálogo y no trae NI UNA sentencia de esquema, no
  # tiene nada que comprobar aquí. Así una alta nueva se omite sola y nadie tiene
  # que acordarse de añadirla.
  #
  # Lo que este job promete sigue en pie: que las migraciones de ESQUEMA corren
  # seguidas sobre una base vacía. Lo que no cubre —y conviene saberlo— es que la
  # base entera se pueda reconstruir solo desde aquí: no se puede, porque le
  # falta el catálogo.
  if grep -q "into public.alimento" "$archivo" &&
     ! grep -qE "create table|alter table|create policy|create function|create index|create view" "$archivo"; then
    echo "   (omitida $nombre · altas de catálogo, sin esquema)"
    continue
  fi
  echo "   → $nombre"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$archivo"
done

echo "── Migraciones aplicadas ──"
