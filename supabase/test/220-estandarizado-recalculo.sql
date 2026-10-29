-- El recálculo de `estandarizado_ejercicio` (0149).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La tabla se sembró una vez (25-ago) y nadie la recalculaba. La 0149 pone
-- `recalcular_estandarizado()`. Lo que podía fallar sin que nadie lo viera:
--   · que el microciclo ACTIVO (a medias) diera por asentada la técnica: marcar de más es el error caro;
--   · que un cue reescrito por el coach o un RIR fuera de banda no rompiera la racha;
--   · que el recálculo pisara un VETO del coach;
--   · que no fuera idempotente (una segunda pasada seguida tiene que cambiar 0 filas);
--   · que la pudiera llamar anon o un asesorado con sesión.
--
-- Cuatro ejercicios de una persona, con microciclos 1..4 (los tres primeros cerrados):
--   ej-a  limpio; el 4.º microciclo está ACTIVO  -> racha 2, 'no'. Al cerrarlo -> racha 3, 'si'.
--   ej-b  el cue cambia en el 4.º                 -> racha 0, 'no', motivo 'nota tecnica nueva'.
--   ej-c  RIR 3 contra objetivo 1 en el 3.º       -> rompe; el 4.º suma -> racha 1, 'no', 'rir fuera de banda'.
--   ej-d  limpio, pero con VETO del coach puesto  -> sigue 'no' / 'veto_coach'.
--
-- Bloque de UUID propio (f220…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f2200000-0000-0000-0000-000000000001', 'est-asesorada@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f2200000-0000-0000-0000-000000000001', 'Asesorada de la estandarizacion', 'asesorado', 'AE')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Un ejercicio dentro de una sesión. `rir` es el que registra la serie; `objetivo`, el prescrito.
create function pg_temp.ej(p_id text, p_cue text, p_rir int, p_objetivo int) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'nombre', 'Ejercicio ' || p_id, 'cues', p_cue, 'rirObjetivo', p_objetivo,
    'series', jsonb_build_array(jsonb_build_object('rir', p_rir, 'reps', 10, 'cargaKg', 40)));
$$;

create function pg_temp.micro(p_ejercicios jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('sesiones', jsonb_build_array(jsonb_build_object('ejercicios', p_ejercicios)));
$$;

-- Microciclos 1, 2, 3 (cerrados) y 4 (activo).
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('est-m1', 'f2200000-0000-0000-0000-000000000001', 1, 'cerrado', pg_temp.micro(jsonb_build_array(
     pg_temp.ej('ej-a', 'Controla el retorno', 2, 2), pg_temp.ej('ej-b', 'Codo pegado', 2, 2),
     pg_temp.ej('ej-c', 'Pecho arriba', 2, 1), pg_temp.ej('ej-d', 'Cadera atras', 1, 1)))),
  ('est-m2', 'f2200000-0000-0000-0000-000000000001', 2, 'cerrado', pg_temp.micro(jsonb_build_array(
     pg_temp.ej('ej-a', 'Controla el retorno', 2, 2), pg_temp.ej('ej-b', 'Codo pegado', 2, 2),
     pg_temp.ej('ej-c', 'Pecho arriba', 1, 1), pg_temp.ej('ej-d', 'Cadera atras', 1, 1)))),
  ('est-m3', 'f2200000-0000-0000-0000-000000000001', 3, 'cerrado', pg_temp.micro(jsonb_build_array(
     pg_temp.ej('ej-a', 'Controla el retorno', 2, 2), pg_temp.ej('ej-b', 'Codo pegado', 2, 2),
     pg_temp.ej('ej-c', 'Pecho arriba', 3, 1), pg_temp.ej('ej-d', 'Cadera atras', 1, 1)))),
  ('est-m4', 'f2200000-0000-0000-0000-000000000001', 4, 'activo', pg_temp.micro(jsonb_build_array(
     pg_temp.ej('ej-a', 'CONTROLA  el retorno.', 2, 2), pg_temp.ej('ej-b', 'Codo a 45 grados', 2, 2),
     pg_temp.ej('ej-c', 'Pecho arriba', 1, 1), pg_temp.ej('ej-d', 'Cadera atras', 1, 1))));

-- El veto del coach sobre ej-d, puesto ANTES del recálculo.
insert into public.estandarizado_ejercicio (usuario_id, ejercicio_id, estado, origen, microciclos_ok, motivo)
values ('f2200000-0000-0000-0000-000000000001', 'ej-d', 'no', 'veto_coach', 0, 'veto');

-- ── 1 · La primera pasada ──────────────────────────────────────────────────
do $$
declare
  v_cambiadas integer;
  r record;
begin
  v_cambiadas := public.recalcular_estandarizado();
  if v_cambiadas < 3 then
    raise exception 'La primera pasada debia insertar al menos ej-a, ej-b y ej-c, cambio %', v_cambiadas;
  end if;

  -- ej-a: el microciclo activo NO suma. Racha 2 (m2 y m3) y sigue en 'no'.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-a';
  if r.estado <> 'no' or r.microciclos_ok <> 2 then
    raise exception 'ej-a con el 4.o ACTIVO debia ser no/2, salio %/%', r.estado, r.microciclos_ok;
  end if;

  -- ej-b: el cue reescrito rompe la racha aunque el microciclo siga activo.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-b';
  if r.estado <> 'no' or r.microciclos_ok <> 0 or r.motivo is distinct from 'nota tecnica nueva' then
    raise exception 'ej-b debia ser no/0/nota tecnica nueva, salio %/%/%', r.estado, r.microciclos_ok, r.motivo;
  end if;

  -- ej-c: RIR 3 contra 1 (desviacion 2) rompe en m3; m4 esta activo y no suma.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-c';
  if r.estado <> 'no' or r.microciclos_ok <> 0 or r.motivo is distinct from 'rir fuera de banda' then
    raise exception 'ej-c debia ser no/0/rir fuera de banda, salio %/%/%', r.estado, r.microciclos_ok, r.motivo;
  end if;

  -- ej-d: el veto gana. Ni estado, ni origen, ni racha, ni motivo cambian.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-d';
  if r.estado <> 'no' or r.origen <> 'veto_coach' or r.microciclos_ok <> 0 or r.motivo is distinct from 'veto' then
    raise exception 'El veto del coach en ej-d fue pisado: %/%/%/%', r.estado, r.origen, r.microciclos_ok, r.motivo;
  end if;
end
$$;

-- ── 2 · Idempotencia: una segunda pasada seguida no reescribe ninguna fila de esta persona ──
-- `now()` es el mismo dentro de la transaccion, asi que comparar `actualizado_en` antes y despues no puede
-- fallar nunca. Se retrocede el sello de las filas a una fecha vieja ANTES de la segunda pasada: si la pasada
-- reescribe una fila igual (falta la guarda `is distinct from`), el sello salta a now() y se ve.
update public.estandarizado_ejercicio set actualizado_en = timestamptz '2000-01-01 00:00:00+00'
 where usuario_id = 'f2200000-0000-0000-0000-000000000001';

do $$
declare
  v_devueltas integer;
  v_reescritas integer;
begin
  v_devueltas := public.recalcular_estandarizado();
  select count(*) into v_reescritas from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001'
     and actualizado_en > timestamptz '2000-01-01 00:00:00+00';
  if v_devueltas <> 0 then
    raise exception 'Una pasada sin cambios en el historial debia devolver 0 filas, devolvio %', v_devueltas;
  end if;
  if v_reescritas <> 0 then
    raise exception 'La segunda pasada reescribio % filas que no habian cambiado', v_reescritas;
  end if;
end
$$;

-- ── 3 · Al cerrar el 4.º microciclo, ej-a llega a la racha de 3 y se estandariza ──
update public.microciclos set estado = 'cerrado' where id = 'est-m4';

do $$
declare r record;
begin
  perform public.recalcular_estandarizado();
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-a';
  -- m4 cambia el cue solo en espacios, mayusculas y un punto: NO es una nota nueva (normalizacion).
  if r.estado <> 'si' or r.microciclos_ok <> 3 or r.motivo is not null then
    raise exception 'ej-a cerrado el 4.o debia ser si/3/null, salio %/%/%', r.estado, r.microciclos_ok, r.motivo;
  end if;
  -- ej-c: m4 cerrado y limpio suma 1 tras la ruptura de m3.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-c';
  if r.estado <> 'no' or r.microciclos_ok <> 1 then
    raise exception 'ej-c tras cerrar m4 debia ser no/1, salio %/%', r.estado, r.microciclos_ok;
  end if;
  -- ej-d sigue vetado.
  select * into r from public.estandarizado_ejercicio
   where usuario_id = 'f2200000-0000-0000-0000-000000000001' and ejercicio_id = 'ej-d';
  if r.origen <> 'veto_coach' or r.estado <> 'no' then
    raise exception 'El veto de ej-d no sobrevivio a la segunda pasada';
  end if;
end
$$;

-- ── 4 · Permisos: solo el servidor la ejecuta ──────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.recalcular_estandarizado()', 'execute') then
    raise exception 'anon puede ejecutar recalcular_estandarizado()';
  end if;
  if has_function_privilege('authenticated', 'public.recalcular_estandarizado()', 'execute') then
    raise exception 'authenticated puede ejecutar recalcular_estandarizado()';
  end if;
  if not has_function_privilege('service_role', 'public.recalcular_estandarizado()', 'execute') then
    raise exception 'service_role no puede ejecutar recalcular_estandarizado()';
  end if;
end
$$;

select 'OK · el recalculo de estandarizado_ejercicio cumple' as resultado;

rollback;
