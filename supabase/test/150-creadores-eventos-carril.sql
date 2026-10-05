-- creadores_eventos solo acepta carriles conocidos (migración 0097).
--
-- Hallazgo de la verificación externa del 28-sep: la 0090 dejaba escribir cualquier texto en
-- `carril_nuevo` y `carril_anterior`, y la app descartaba en silencio esos eventos.
--
-- Lo que se prueba:
--   1. Un carril_nuevo inventado FALLA; uno inventado en carril_anterior también.
--   2. carril_anterior puede ser nulo (el primer evento de un creador).
--   3. Todos los carriles de creadores_candidatos entran en las dos columnas (la misma lista).
--   4. El check es NOT VALID (no revisa el pasado) pero SÍ vale para lo nuevo: una fila vieja
--      con un carril raro no impide aplicar la migración, y se puede validar después.
--
-- Bloque de UUID propio. ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.sub', '', false);
set role service_role;

insert into public.creadores_candidatos (creador_id, usuario_ig, carril, fecha_dato)
values ('ig:970000001', 'creador.eventos', 'etapa1', now());

-- 2 · el primer evento no tiene carril anterior
insert into public.creadores_eventos (event_id, creador_id, carril_anterior, carril_nuevo, actor, fecha_dato)
values ('ig:970000001:etapa1:1', 'ig:970000001', null, 'etapa1', 'importador', now());

do $$
declare
  c text;
  i int := 0;
begin
  -- 1 · carril inventado
  begin
    insert into public.creadores_eventos (event_id, creador_id, carril_nuevo, actor, fecha_dato)
    values ('ig:970000001:raro:1', 'ig:970000001', 'carril_inventado', 'importador', now());
    raise exception 'FALLO: se aceptó un carril_nuevo inventado';
  exception when check_violation then null;
  end;
  begin
    insert into public.creadores_eventos (event_id, creador_id, carril_anterior, carril_nuevo, actor, fecha_dato)
    values ('ig:970000001:raro:2', 'ig:970000001', 'carril_inventado', 'etapa2', 'importador', now());
    raise exception 'FALLO: se aceptó un carril_anterior inventado';
  exception when check_violation then null;
  end;
  -- 3 · la misma lista que creadores_candidatos.carril: todos entran, en las dos columnas
  foreach c in array array[
    'descubierto', 'etapa1', 'etapa2', 'tambaleando', 'aprobado_contacto', 'mensaje_enviado',
    'respondio', 'no_respondio', 'encuesta', 'microprueba', 'piloto', 'continua', 'pausa',
    'descartado', 'entrenador'
  ] loop
    i := i + 1;
    insert into public.creadores_eventos (event_id, creador_id, carril_anterior, carril_nuevo, actor, fecha_dato)
    values ('ig:970000001:lista:' || i, 'ig:970000001', c, c, 'importador', now());
    -- y el candidato acepta el mismo carril: la lista es la misma
    update public.creadores_candidatos set carril = c where creador_id = 'ig:970000001';
  end loop;
end $$;

reset role;

-- 4 · NOT VALID: se declara así, para no fallar con filas viejas; y se puede validar después.
select pruebas.afirmar(
  (select count(*) from pg_constraint
    where conrelid = 'public.creadores_eventos'::regclass
      and conname in ('creadores_eventos_carril_nuevo_conocido', 'creadores_eventos_carril_anterior_conocido')
      and not convalidated) = 2,
  'los checks de carril no están declarados NOT VALID (fallaría con filas viejas)'
);
-- Sigue protegiendo lo NUEVO aunque no haya validado el pasado (lo probado arriba), y con las
-- filas actuales limpias se puede validar sin error.
alter table public.creadores_eventos validate constraint creadores_eventos_carril_nuevo_conocido;
alter table public.creadores_eventos validate constraint creadores_eventos_carril_anterior_conocido;
select pruebas.afirmar(
  (select count(*) from pg_constraint
    where conrelid = 'public.creadores_eventos'::regclass
      and conname in ('creadores_eventos_carril_nuevo_conocido', 'creadores_eventos_carril_anterior_conocido')
      and convalidated) = 2,
  'los checks de carril no se pudieron validar con las filas limpias'
);

rollback;
