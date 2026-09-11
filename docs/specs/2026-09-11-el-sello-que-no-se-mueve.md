# Cinco tablas con un sello que nunca se mueve

**Estado: PROPUESTA. No aplicada.** Medido contra producción (`sbzmbiwrnvegrticatza`)
el 2026-09-11. Las cinco tablas pertenecen a carriles de otras sesiones, así que aquí
queda el daño medido y el arreglo escrito; aplicarlo es decisión de Bryan o de quien
lleve cada carril.

## Qué se midió

De las tablas de `public` con columna `actualizado_en`, **22 tienen
`trg_actualizado_en`** y cinco no. (Tres de las «sin disparador» son vistas
—`cribado_vigente`, `checkins_nutricion`, `visibilidad_pendiente`—, y seis son
respaldos `respaldo_*`, que son fotos y no deben moverse. Esas nueve no son hallazgo.)

| Tabla | Filas | ¿La lee la app en vivo? | ¿Se actualiza en sitio? |
|---|---|---|---|
| `estandarizado_ejercicio` | 1.217 | No (solo SQL y un test) | Sí, al resembrar |
| `medios_app` | 0 | Sí (`data/nube/medios.ts`) | Sí |
| `motivo_sin_plan` | 4 | No (solo SQL) | Sí |
| `permisos_de_aviso` | 0 | Sí (`data/nube/avisos.ts`, upsert por usuario) | **Sí, en cada re-permiso** |
| `visibilidad_nutricion_nota` | 1 | Escritura sí, lectura no | **Sí, cada vez que se edita la nota** |

Las cinco declaran `actualizado_en timestamptz not null default now()` y **ninguna
tiene `creado_en`**. Es decir: la columna se rellena al nacer la fila y no se vuelve a
tocar nunca, y no hay una segunda fecha que delate la diferencia. Una columna que se
llama «cuándo cambió» guarda «cuándo nació», y nada en la base lo desmiente.

## Qué daño hace HOY

**Ninguno medible.** Y conviene decirlo así de claro, porque la hipótesis con la que
entré —que el teléfono se creería al día— resultó **falsa para estas cinco**:

- `firma_de_sincronizacion()` cubre 22 tablas y una vista. **Ninguna de las cinco está
  dentro**, así que la firma no puede mentir sobre ellas.
- `permisos_de_aviso` no depende de `actualizado_en`: lleva su propio `visto_en`, que
  la app sí escribe en cada upsert.
- `visibilidad_nutricion_nota` se sube, no se baja: nunca se hidrata.
- La única fila que existe hoy (la nota de un asesorado) tiene **desfase cero** contra
  el sello de sus interruptores: nunca se ha editado desde que se creó.

Lo que hay hoy, entonces, es una columna que promete lo que no cumple. Cualquier
consulta forense del tipo «qué cambió desde el jueves» sobre estas cinco contesta con
la fecha de nacimiento y no avisa de que lo está haciendo.

## Qué daño hará el día que cuente

El riesgo concreto no es teórico: **es el camino que ya recorrió `cribado`**. Cuando
el cribado entró en la sincronización (migración 0058), hubo que hacer tres cosas a la
vez, y el propio código lo deja escrito en `src/data/nube/firma.ts:124`:

> la fila de `firma_de_sincronizacion()`, la entrada en `FUENTES` y el trigger
> `trg_actualizado_en` — «las tres cosas o ninguna».

El día que alguien meta una de estas cinco en la firma sin acordarse del trigger, la
trampa se cierra sola y en silencio:

1. La firma compara dos cosas por tabla: **cuántas filas hay** y **cuál es el
   `max(actualizado_en)`**.
2. Un **borrado** baja el conteo y una **alta** lo sube: los dos se detectan.
3. Una **edición** no mueve el conteo, y sin trigger tampoco mueve el máximo.
4. `sinCambios()` devuelve `true`, la descarga se salta, y el teléfono se queda con el
   valor viejo **hasta que otra cosa cambie**. No hay error, no hay pantalla en rojo.

Sobre `permisos_de_aviso` eso significa que alguien que revoca los avisos los sigue
recibiendo; sobre `visibilidad_nutricion_nota`, que una nota clínica corregida sigue
mostrando la versión anterior.

## El arreglo

Una migración de cinco líneas. `marcar_actualizado()` ya existe y es la misma que usan
las otras 22:

```sql
-- Las cinco tablas que tienen la columna y no el sello (medido 2026-09-11).
create trigger trg_actualizado_en before update on public.estandarizado_ejercicio
  for each row execute function marcar_actualizado();
create trigger trg_actualizado_en before update on public.medios_app
  for each row execute function marcar_actualizado();
create trigger trg_actualizado_en before update on public.motivo_sin_plan
  for each row execute function marcar_actualizado();
create trigger trg_actualizado_en before update on public.permisos_de_aviso
  for each row execute function marcar_actualizado();
create trigger trg_actualizado_en before update on public.visibilidad_nutricion_nota
  for each row execute function marcar_actualizado();
```

**No lleva número aquí a propósito.** El 2026-09-07 se escribieron dos `0058`
distintos, y hoy `origin/main` tiene **dos `0062` y dos `0065`** conviviendo
(`0062_el_cribado_guarda_su_historia` / `0062_el_saludo_es_una_via`;
`0065_los_dias_que_puede_entrenar` / `0065_el_video_es_de_cada_quien`). El número se
elige al aplicar, mirando las ramas vivas, no el disco.

### Cómo comprobar que quedó (efecto, no nombre)

No basta con que el trigger aparezca en `pg_trigger`: eso es comprobar el nombre. La
señal para `supabase/comprobar-migraciones.sql` mide el **efecto**, que es lo que
importa:

```sql
-- Cero filas. Toda tabla real con `actualizado_en` tiene quien lo mueva.
select c.table_name
  from information_schema.columns c
  join pg_class cl on cl.relname = c.table_name
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
 where c.table_schema = 'public' and c.column_name = 'actualizado_en'
   and cl.relkind = 'r'                      -- vistas fuera
   and c.table_name not like 'respaldo!_%' escape '!'   -- los respaldos son fotos
   and not exists (
     select 1 from pg_trigger t
      where t.tgrelid = cl.oid and not t.tgisinternal
        and t.tgname = 'trg_actualizado_en');
```

Y la prueba que de verdad lo demuestra, porque lo ve moverse:

```sql
-- En una transaccion que se deshace: el sello tiene que avanzar. Vale tal cual en el
-- SQL Editor de Supabase (sin \gset, que es de psql).
begin;
  create temp table antes as
    select asesorado_id, actualizado_en from public.visibilidad_nutricion_nota;
  update public.visibilidad_nutricion_nota set motivo = motivo;
  select n.asesorado_id, (n.actualizado_en > a.actualizado_en) as el_sello_se_movio
    from public.visibilidad_nutricion_nota n
    join antes a on a.asesorado_id = n.asesorado_id;
rollback;
```

## Lo que NO propongo

- **No tocar los `respaldo_*`.** Son fotos de un instante; un sello que se mueva sería
  el error. (De paso: los once tienen RLS activa y cero políticas, o sea cerrados a
  `anon` y `authenticated`. Correcto.)
- **No añadir `creado_en`.** Tentador para separar las dos fechas, pero ninguna de las
  cinco tiene hoy quien lo lea, y una columna nueva en cinco tablas por una necesidad
  que nadie ha pedido es peso muerto. Si alguna entra en la firma, se decide entonces.
- **No meterlas en `firma_de_sincronizacion()`.** Ese es el cambio que las volvería
  peligrosas, y solo tiene sentido cuando el teléfono necesite bajarlas. El trigger es
  precisamente lo que hay que tener puesto **antes** de que eso ocurra.
