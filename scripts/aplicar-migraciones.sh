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
  echo "   → $nombre"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$archivo"
done

echo "── Migraciones aplicadas ──"
