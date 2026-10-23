-- ============================================================================
-- 0116 · El puente con el laboratorio anatómico: consentimientos, tres vistas y un rol de solo lectura
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `lab/puente-vista` el 23-oct-2026 y la aplica Bryan, a mano, en
-- el SQL Editor, DESPUÉS de revisarla. Sin ella nada de la app se rompe: ninguna pantalla la usa.
--
-- QUÉ PEDIDO RESUELVE. Bryan eligió (23-oct, decisión 53 del laboratorio) que los datos reales de la app
-- lleguen SOLOS al laboratorio anatómico (un programa local en su PC), sin exportaciones a mano. Reglas:
--   · solo de quien dio permiso (por escrito, revocable), con un SEUDÓNIMO (P-001, P-002…) en vez de nombre;
--   · solo las columnas que el laboratorio necesita; ni nombre, ni correo, ni salud, ni mensajes, ni fotos;
--   · con una llave que SOLO PUEDE LEER esas vistas y nada más (ni las tablas de la app, ni escribir).
--
-- QUÉ CREA (todo en un esquema propio, `lab`, que NO es de los que Supabase publica por la API REST):
--   1. `lab.consentimientos`  quién dio permiso. Una fila por persona y vez: seudónimo, fecha, revocado.
--   2. `lab.lab_series`       UNA FILA POR SERIE registrada (carga, reps, RIR, %PV y lo PRESCRITO de esa serie,
--                             que el laboratorio necesita solo para detectar el RIR «rellenado»).
--   3. `lab.lab_sujetos`      sexo, talla y masa (última medida) y, solo si la persona lo permitió aparte, tres
--                             longitudes de segmento.
--   4. `lab.lab_revocaciones` seudónimos que revocaron: el lector local los usa para BORRAR lo suyo en el PC.
--   5. el rol `lab_lector`    sin contraseña ni login aquí (ver «LA CREDENCIAL»), con SELECT solo sobre 2, 3 y 4.
--
-- POR QUÉ UN ESQUEMA APARTE Y NO `public`. Las vistas de este tipo corren con los permisos de su dueño (la llave
-- no puede tocar las tablas base, y eso es justo lo que se quiere), y el asesor de seguridad de Supabase marca
-- como ERROR las «Security Definer View» que están en un esquema publicado (lo que motivó la 0100). `lab` no está
-- publicado: la API REST no las ve, `anon` y `authenticated` no tienen ni USAGE. (No verificado contra el panel:
-- ver comprobación 1 de `diseno/PUENTE-DATOS-REALES-PLAN-A.md` en el repo del laboratorio.)
--
-- QUÉ VE LA LLAVE Y QUÉ NO. Ve lo de arriba, filtrado por consentimiento vigente (`revocado_en is null`). NO ve:
-- `public.*` (ninguna tabla), `lab.consentimientos` (ahí está el vínculo seudónimo ↔ persona; solo lo toca quien
-- entra como dueño en el SQL Editor), ni `auth.*`. No puede insertar, actualizar ni borrar, ni crear objetos
-- (además la sesión nace en solo lectura y con tope de 30 s por consulta).
--
-- QUÉ NO SALE NUNCA: nombre, correo, `usuario_id`, `perfiles.datos` entero, checkins, mensajes, notas de llamada,
-- planes de nutrición, respuestas, fotos, cintura, caderas, perímetros, % de grasa, masa magra, antecedentes de
-- salud, `velocidad.huella` (la trayectoria de la barra), `notaCoach`, `cues`. Lista blanca de columnas: la de las
-- vistas, y el lector local la vuelve a comprobar (una columna de más rompe la lectura).
--
-- DOS REGLAS DE LA APP QUE LA VISTA RESPETA:
--   · La migración 0018 oculta la composición corporal a quien tiene un antecedente de conducta alimentaria: su
--     `pesoKg` falta. La vista da `peso_kg = null` en ese caso y NO busca el peso en otra medida más vieja.
--   · RIR o reps que no son número (antes de la 0041 hubo «Control», «Isometría»…) salen NULL, nunca 0.
--
-- LA CREDENCIAL. Esta migración NO guarda ninguna contraseña y NO deja entrar al rol: `lab_lector` nace `nologin`.
-- Para activarlo, Bryan corre APARTE (no en el repo) `alter role lab_lector with login password '<la que genere>'`
-- (los pasos están en `diseno/PUENTE-DATOS-REALES-PLAN-A.md` del laboratorio). Para apagarlo: `alter role lab_lector
-- nologin`. Para rotarla: otro `alter role … password`.
--
-- RETENCIÓN (decisión 52). Los datos locales se guardan hasta que la persona pida borrarlos. Pedirlo = poner
-- `revocado_en` en su fila; desde ese instante la vista no devuelve nada suyo y `lab_revocaciones` la lista para que
-- el lector local borre sus carpetas. Si la persona se borra de la app, su fila queda revocada sola (trigger).
--
-- CÓMO COMPROBAR (después de aplicar): `supabase/comprobar-0116.sql` (solo lee). El CI corre las sesiones de
-- verdad: `supabase/test/216-laboratorio-puente.sql`.
-- ============================================================================

begin;

create schema if not exists lab;
revoke all on schema lab from public;

-- ─────────────────────────── Ayudas (solo las usan las vistas) ───────────────────────────

-- Número o NULL. Un texto («Control», «RIR 2-3») o un null JSON no son cero: son falta.
create or replace function lab.num(j jsonb)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $$
  select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end
$$;

-- Fecha AAAA-MM-DD o NULL (una fecha mal escrita no tumba la vista entera).
create or replace function lab.dia(t text)
returns date
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if t is not null and t ~ '^\d{4}-\d{2}-\d{2}' then
    return left(t, 10)::date;
  end if;
  return null;
exception when others then
  return null;
end
$$;

-- Las vistas usan «arreglo JSON o vacío» en línea (case jsonb_typeof): lab_lector no ejecuta ninguna función del
-- esquema lab, y las funciones que usa una vista se comprueban con los permisos de quien la lee.

-- ─────────────────────────── Consentimientos ───────────────────────────

create sequence if not exists lab.seudonimo_seq;

create table if not exists lab.consentimientos (
  id                 uuid primary key default gen_random_uuid(),
  -- La persona. Si se borra de la app, la FK la pone a NULL y el trigger de abajo deja la fila revocada.
  usuario_id         uuid references public.usuarios_app(id) on delete set null,
  seudonimo          text not null unique default ('P-' || lpad(nextval('lab.seudonimo_seq')::text, 3, '0'))
                       check (seudonimo ~ '^P-[0-9]{3,}$'),
  concedido_en       timestamptz not null default now(),
  revocado_en        timestamptz,
  -- Aparte, como pide la propuesta: longitudes de fémur, tibia y torso. Por defecto NO.
  permite_segmentos  boolean not null default false,
  -- Primera persona (decisión 51): la cuenta de prueba de Bryan.
  cuenta_de_prueba   boolean not null default false,
  -- Dónde está el papel firmado (carpeta, fecha). Sin nombres ni cifras.
  nota               text not null default '',
  check (revocado_en is null or revocado_en >= concedido_en),
  check (usuario_id is not null or revocado_en is not null)
);

-- Una sola vez vigente por persona (puede haber varias filas viejas revocadas).
create unique index if not exists consentimientos_uno_vigente
  on lab.consentimientos (usuario_id) where revocado_en is null;

create or replace function lab.revocar_si_se_borro()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.usuario_id is null and old.usuario_id is not null and new.revocado_en is null then
    new.revocado_en := greatest(now(), new.concedido_en);
  end if;
  return new;
end
$$;

drop trigger if exists consentimientos_revocar_si_se_borro on lab.consentimientos;
create trigger consentimientos_revocar_si_se_borro
  before update on lab.consentimientos
  for each row execute function lab.revocar_si_se_borro();

-- RLS en el mismo paso que el `create table` (GUIA-BRYAN §10). Sin políticas: nadie con sesión de la app llega
-- (el esquema no se publica); el dueño, en el SQL Editor, se salta la RLS.
alter table lab.consentimientos enable row level security;
revoke all on lab.consentimientos from public, anon, authenticated;
revoke all on sequence lab.seudonimo_seq from public, anon, authenticated;

comment on table lab.consentimientos is
  'Quién dio permiso al laboratorio anatómico. Una fila por persona y vez. Aquí está el único vínculo seudónimo ↔ persona; la llave lab_lector NO lo ve.';

-- ─────────────────────────── Las vistas ───────────────────────────
-- Corren con los permisos del dueño a propósito (ver «POR QUÉ UN ESQUEMA APARTE»).

create or replace view lab.lab_series with (security_invoker = off) as
select
  c.seudonimo,
  m.numero                                              as microciclo_numero,
  m.estado                                              as microciclo_estado,
  m.actualizado_en                                      as microciclo_actualizado_en,
  lab.dia(m.datos ->> 'fechaInicio')                    as fecha_inicio,
  lab.dia(s.js ->> 'fecha')                             as sesion_fecha,
  e.je ->> 'id'                                         as ejercicio_id,
  e.je ->> 'nombre'                                     as ejercicio_nombre,
  lab.num(r.jr -> 'orden')                              as serie_orden,
  lab.num(r.jr -> 'cargaKg')                            as carga_kg,
  lab.num(r.jr -> 'reps')                               as reps,
  lab.num(r.jr -> 'rir')                                as rir,
  case when (r.jr ->> 'confirmada') in ('tal_cual', 'editada') then r.jr ->> 'confirmada' end
                                                        as confirmada,
  lab.num(r.jr -> 'velocidad' -> 'pvPct')               as pv_pct,
  case when jsonb_typeof(r.jr -> 'velocidad' -> 'hayEscala') = 'boolean'
       then (r.jr -> 'velocidad' ->> 'hayEscala')::boolean end
                                                        as pv_hay_escala,
  r.jr -> 'velocidad' ->> 'calidad'                     as pv_calidad,
  lab.num(r.jr -> 'velocidad' -> 'inclinacionMax')      as pv_inclinacion_max,
  lab.num(e.je -> 'rirObjetivo')                        as rir_objetivo,
  (jsonb_typeof(e.je -> 'rirObjetivo') = 'string')      as objetivo_al_fallo,
  lab.num(pr.p -> 'rir')                                as rir_prescrito,
  lab.num(pr.p -> 'reps')                               as reps_prescritas,
  lab.num(pr.p -> 'cargaKg')                            as carga_prescrita_kg
from lab.consentimientos c
join public.microciclos m on m.usuario_id = c.usuario_id
cross join lateral jsonb_array_elements((case when jsonb_typeof(m.datos -> 'sesiones') = 'array' then m.datos -> 'sesiones' else '[]'::jsonb end)) as s(js)
cross join lateral jsonb_array_elements((case when jsonb_typeof(s.js -> 'ejercicios') = 'array' then s.js -> 'ejercicios' else '[]'::jsonb end)) as e(je)
cross join lateral jsonb_array_elements((case when jsonb_typeof(e.je -> 'series') = 'array' then e.je -> 'series' else '[]'::jsonb end)) as r(jr)
left join lateral (
  select p
    from jsonb_array_elements((case when jsonb_typeof(e.je -> 'seriesPrescritas') = 'array' then e.je -> 'seriesPrescritas' else '[]'::jsonb end)) as p
   where lab.num(p -> 'orden') = lab.num(r.jr -> 'orden')
   limit 1
) as pr(p) on true
where c.revocado_en is null
  and jsonb_typeof(r.jr) = 'object';

create or replace view lab.lab_sujetos with (security_invoker = off) as
select
  c.seudonimo,
  p.sexo,
  lab.dia(u.med ->> 'fecha')                            as fecha_medida,
  lab.num(u.med -> 'alturaCm')                          as talla_cm,
  -- Falta = falta. La app la esconde a quien tiene un antecedente de conducta alimentaria (0018): no se busca otra.
  lab.num(u.med -> 'pesoKg')                            as peso_kg,
  case when c.permite_segmentos then lab.num(u.med -> 'cuerpo' -> 'femurCm') end  as femur_cm,
  case when c.permite_segmentos then lab.num(u.med -> 'cuerpo' -> 'tibiaCm') end  as tibia_cm,
  case when c.permite_segmentos then lab.num(u.med -> 'cuerpo' -> 'torsoCm') end  as torso_cm
from lab.consentimientos c
join public.perfiles p on p.usuario_id = c.usuario_id
left join lateral (
  select med
    from jsonb_array_elements((case when jsonb_typeof(p.datos -> 'medidas') = 'array' then p.datos -> 'medidas' else '[]'::jsonb end)) as med
   where jsonb_typeof(med) = 'object'
   order by lab.dia(med ->> 'fecha') desc nulls last
   limit 1
) as u(med) on true
where c.revocado_en is null;

create or replace view lab.lab_revocaciones with (security_invoker = off) as
select c.seudonimo, c.revocado_en
  from lab.consentimientos c
 where c.revocado_en is not null;

comment on view lab.lab_series is
  'Una fila por serie de quien dio permiso (vigente). Sin nombre, correo, usuario_id ni huella de velocidad. Es lo único que lee lab_lector, junto con lab_sujetos y lab_revocaciones.';

-- ─────────────────────────── El rol de solo lectura ───────────────────────────

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lab_lector') then
    -- nologin: no entra nadie hasta que Bryan le ponga contraseña a mano. Sin bypassrls, sin herencia, 2 conexiones.
    create role lab_lector nologin noinherit nobypassrls nocreatedb nocreaterole connection limit 2;
  end if;
end $$;

alter role lab_lector set default_transaction_read_only = on;
alter role lab_lector set statement_timeout = '30s';

revoke all on all tables in schema public from lab_lector;
revoke all on all tables in schema lab from public, anon, authenticated, lab_lector;
-- Las funciones de `lab` (ayudas y trigger) nacen con EXECUTE para PUBLIC: se cierra. Las vistas corren como dueño y
-- no lo necesitan; la llave no debe poder llamarlas.
revoke execute on all functions in schema lab from public, anon, authenticated, lab_lector;
alter default privileges in schema lab revoke execute on functions from public;
grant usage on schema lab to lab_lector;
grant select on lab.lab_series, lab.lab_sujetos, lab.lab_revocaciones to lab_lector;
-- Las vistas llaman a lab.num y lab.dia, y Postgres comprueba EXECUTE con los permisos de quien lee la vista.
-- Son puras (convierten un valor JSON o un texto) y no tocan tablas: lab_lector las ejecuta; nadie más.
grant execute on function lab.num(jsonb), lab.dia(text) to lab_lector;

commit;

-- Señal: `0116 - puente del laboratorio` en supabase/comprobar-0116.sql
