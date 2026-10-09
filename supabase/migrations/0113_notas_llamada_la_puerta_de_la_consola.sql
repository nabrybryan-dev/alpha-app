-- 0113: las notas de llamada se abren con la puerta de la consola, y ganan su casilla de tareas.
--
-- QUÉ ARREGLA. La 0112 dejó `notas_llamada` detrás de `es_coach()`. Esa función es cierta para
-- el rol `coach` y para quien lleva la capacidad `puesto_de_coach` — es decir, para las dos
-- cuentas de Bryan. Manuela es `nutricionista` y no lleva esa capacidad: la bitácora se pidió
-- para ella (Bryan, 8-oct-2026) y ella era justo quien no podía ni leerla ni escribirla. El
-- `select` no le daba error: RLS le devolvía cero filas, y la app le decía «todavía no hay
-- llamadas anotadas».
--
-- QUÉ PUERTA SE PONE, Y POR QUÉ ESA. La tarjeta de las notas vive en la consola, y a la consola
-- se entra por CAPACIDAD, no por rol (decisión de Bryan del 26-sep, `layouts.tsx`): pasa quien
-- ocupa el puesto de coach o quien tiene `leer_entrenamiento`. Es la misma condición con la que
-- ya se leen `cadena_corridas`, `ordenes` y `tarjetas_vida` (0083). Así la base y la pantalla
-- dicen lo mismo: quien ve la tarjeta puede usarla, y quien no entra a la consola tampoco lee
-- la tabla por REST. No se usa `es_staff()` porque abre por rol: una nutricionista nueva sin
-- acceso a la consola leería las notas de todos sin tener pantalla para ello.
--
-- LO QUE NO CAMBIA. El autor lo sigue poniendo la base (`default auth.uid()`) y la política
-- sigue exigiendo `coach_id = auth.uid()`: nadie anota a nombre de otro. El asesorado sigue sin
-- ver nada. Sigue sin haber `update` ni `delete`: una nota no se corrige ni se borra desde la
-- app (queda pendiente, con política por autor, si Bryan lo pide).
--
-- LO QUE SE AÑADE.
--   · `tareas`: lo primero que nombró el pedido («anotar las tareas de los asesorados frente a
--     lo que va escuchando») no tenía casilla propia; iba fundido en `conclusiones`. Texto
--     libre y opcional: no es una lista con estado.
--   · La regla de siempre para una tabla nueva, que la 0112 se saltó: `revoke all` de `anon`,
--     `public` y `authenticated`, y solo después lo mínimo. La 0112 dejó a `anon` y a
--     `authenticated` con todos los privilegios de tabla (incluidos `delete` y `truncate`);
--     RLS lo tapaba, pero era una sola barrera donde el resto del esquema tiene dos.
--   · `to authenticated` en las dos políticas: no se evalúan siquiera para `anon`.
--   · `(select …)` alrededor de las funciones: Postgres las resuelve una vez por consulta y no
--     una vez por fila (mismo patrón que las políticas de la 0083).

alter table public.notas_llamada add column if not exists tareas text;

comment on column public.notas_llamada.tareas is
  'Tareas que le quedan al asesorado tras la llamada. Texto libre y opcional (0113).';

drop policy if exists notas_llamada_leer on public.notas_llamada;
drop policy if exists notas_llamada_escribir on public.notas_llamada;

create policy notas_llamada_leer on public.notas_llamada
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

create policy notas_llamada_escribir on public.notas_llamada
  for insert to authenticated
  with check (
    (
      (select public.es_coach())
      or (select public.tiene_capacidad('leer_entrenamiento'))
    )
    and coach_id = (select auth.uid())
  );

revoke all on public.notas_llamada from anon, public;
revoke all on public.notas_llamada from authenticated;
grant select, insert on public.notas_llamada to authenticated;
grant all on public.notas_llamada to service_role;
