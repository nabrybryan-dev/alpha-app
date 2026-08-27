-- Firma de sincronización: saber si una tabla cambió sin descargarla.
--
-- Diseño y porqués en `docs/specs/2026-08-27-sincronizacion-incremental.md`.
-- El resumen: `hidratarDesdeNube` baja 21 tablas enteras cada 45 s por pestaña,
-- y para el coach RLS no acota nada, así que se lleva la cartera completa. Esta
-- migración monta lo que hace falta para preguntar «¿cambió?» en vez de bajarlo
-- todo por si acaso.
--
-- ── Por qué la firma es (conteo, último cambio) y no un delta por fila ───────
--
-- El delta por fila -pedir lo modificado desde la última vez- es la respuesta de
-- manual, y aquí es la equivocada: **17 de las 21 tablas permiten borrado real**
-- y solo 4 tienen borrado lógico. Una fila borrada no aparece en ningún delta
-- -no se modificó, dejó de existir-, así que todo lo que el coach borrara se
-- quedaría para siempre en el dispositivo de la asesorada. Sin error. Con toda
-- la apariencia de ser real.
--
-- El conteo sí lo caza:
--
--   alta          conteo sube,  fecha sube
--   modificacion  conteo igual, fecha sube
--   BORRADO       conteo BAJA
--   alta+borrado  conteo igual, fecha sube (el alta es de ahora)
--
-- ── Por qué hace falta el trigger ───────────────────────────────────────────
--
-- Siete tablas ya tenían `actualizado_en` y parecía media solución. No lo era:
-- **no había un solo trigger que la mantuviera**. Los cuatro triggers de
-- `public` son de protección -`trg_proteger_rol`, `trg_proteger_perfil`,
-- `trg_proteger_estado_microciclo`, `registro_item_resolver_comida`-, ninguno de
-- sello de tiempo. La columna se rellenaba a mano en scripts de carga y las
-- escrituras de la app no la tocaban.
--
-- Sin trigger, la firma diria «no cambió» sobre datos que sí cambiaron, y la app
-- serviría la copia vieja creyéndola buena. Es el fallo que esta migración
-- existe para no cometer.

begin;

-- ── 1. La columna, donde falte ──────────────────────────────────────────────
-- `default now()` cubre el alta. La modificación la cubre el trigger de abajo.

alter table public.usuarios_app add column if not exists actualizado_en timestamptz not null default now();
alter table public.checkins add column if not exists actualizado_en timestamptz not null default now();
alter table public.adherencias add column if not exists actualizado_en timestamptz not null default now();
alter table public.mensajes add column if not exists actualizado_en timestamptz not null default now();
alter table public.cuestionarios add column if not exists actualizado_en timestamptz not null default now();
alter table public.respuestas add column if not exists actualizado_en timestamptz not null default now();
alter table public.contenidos add column if not exists actualizado_en timestamptz not null default now();
alter table public.premiaciones add column if not exists actualizado_en timestamptz not null default now();
alter table public.registro_comida add column if not exists actualizado_en timestamptz not null default now();
alter table public.registro_item add column if not exists actualizado_en timestamptz not null default now();
alter table public.preferencia_estado add column if not exists actualizado_en timestamptz not null default now();
alter table public.prueba_calibracion add column if not exists actualizado_en timestamptz not null default now();
alter table public.perfil_alimentario_veto add column if not exists actualizado_en timestamptz not null default now();
alter table public.consultas_chat add column if not exists actualizado_en timestamptz not null default now();

-- ── 2. El sello, una función para las 21 ────────────────────────────────────

create or replace function public.marcar_actualizado()
returns trigger
language plpgsql
as $marca$
begin
  new.actualizado_en := now();
  return new;
end
$marca$;

comment on function public.marcar_actualizado() is
  'Mantiene `actualizado_en` en cada UPDATE. Sin esto la firma de sincronizacion miente.';

drop trigger if exists trg_actualizado_en on public.adherencias;
create trigger trg_actualizado_en before update on public.adherencias
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.checkins;
create trigger trg_actualizado_en before update on public.checkins
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.consultas_chat;
create trigger trg_actualizado_en before update on public.consultas_chat
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.contenidos;
create trigger trg_actualizado_en before update on public.contenidos
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.cuestionarios;
create trigger trg_actualizado_en before update on public.cuestionarios
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.despensa;
create trigger trg_actualizado_en before update on public.despensa
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.hidratacion;
create trigger trg_actualizado_en before update on public.hidratacion
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.mensajes;
create trigger trg_actualizado_en before update on public.mensajes
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.microciclos;
create trigger trg_actualizado_en before update on public.microciclos
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.perfil_alimentario;
create trigger trg_actualizado_en before update on public.perfil_alimentario
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.perfil_alimentario_veto;
create trigger trg_actualizado_en before update on public.perfil_alimentario_veto
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.perfiles;
create trigger trg_actualizado_en before update on public.perfiles
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.planes_nutricionales;
create trigger trg_actualizado_en before update on public.planes_nutricionales
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.preferencia_estado;
create trigger trg_actualizado_en before update on public.preferencia_estado
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.premiaciones;
create trigger trg_actualizado_en before update on public.premiaciones
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.prueba_calibracion;
create trigger trg_actualizado_en before update on public.prueba_calibracion
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.registro_comida;
create trigger trg_actualizado_en before update on public.registro_comida
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.registro_item;
create trigger trg_actualizado_en before update on public.registro_item
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.respuestas;
create trigger trg_actualizado_en before update on public.respuestas
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.usuarios_app;
create trigger trg_actualizado_en before update on public.usuarios_app
  for each row execute function public.marcar_actualizado();
drop trigger if exists trg_actualizado_en on public.visibilidad_nutricion;
create trigger trg_actualizado_en before update on public.visibilidad_nutricion
  for each row execute function public.marcar_actualizado();

-- ── 3. Exponer la fecha en la vista de la nutricionista ─────────────────────
-- `checkins_nutricion` (0039) es una vista, y la app la hidrata aparte de
-- `checkins`. Para poder firmarla necesita la columna. `create or replace view`
-- solo admite AÑADIR columnas al final: por eso va la última.

create or replace view public.checkins_nutricion as
select
  c.id,
  c.usuario_id,
  c.fecha,
  (c.datos ->> 'pesoKg')::numeric as peso_kg,
  c.datos ->> 'hambre'            as hambre,
  c.datos ->> 'alimentacion'      as alimentacion,
  (c.datos ->> 'hambreEscala')::numeric as hambre_escala,
  c.actualizado_en
from public.checkins c
where public.es_staff() or c.usuario_id = auth.uid();

-- ── 4. La firma ─────────────────────────────────────────────────────────────
--
-- SECURITY INVOKER a proposito -o sea, sin `security definer`-. Tiene que
-- correr con el RLS de quien llama, porque la firma de un coach y la de una
-- asesorada son distintas por definicion. Calculada como superusuario, la
-- asesorada compararia su copia contra el conteo de toda la cartera y se
-- rehidrataria en cada refresco, que es justo lo contrario de lo que se busca.

create or replace function public.firma_de_sincronizacion()
returns table (tabla text, filas bigint, ultimo_cambio timestamptz)
language sql
stable
set search_path = public
as $firma$
  select 'adherencias', count(*), max(actualizado_en) from public.adherencias
  union all
  select 'checkins', count(*), max(actualizado_en) from public.checkins
  union all
  select 'consultas_chat', count(*), max(actualizado_en) from public.consultas_chat
  union all
  select 'contenidos', count(*), max(actualizado_en) from public.contenidos
  union all
  select 'cuestionarios', count(*), max(actualizado_en) from public.cuestionarios
  union all
  select 'despensa', count(*), max(actualizado_en) from public.despensa
  union all
  select 'hidratacion', count(*), max(actualizado_en) from public.hidratacion
  union all
  select 'mensajes', count(*), max(actualizado_en) from public.mensajes
  union all
  select 'microciclos', count(*), max(actualizado_en) from public.microciclos
  union all
  select 'perfil_alimentario', count(*), max(actualizado_en) from public.perfil_alimentario
  union all
  select 'perfil_alimentario_veto', count(*), max(actualizado_en) from public.perfil_alimentario_veto
  union all
  select 'perfiles', count(*), max(actualizado_en) from public.perfiles
  union all
  select 'planes_nutricionales', count(*), max(actualizado_en) from public.planes_nutricionales
  union all
  select 'preferencia_estado', count(*), max(actualizado_en) from public.preferencia_estado
  union all
  select 'premiaciones', count(*), max(actualizado_en) from public.premiaciones
  union all
  select 'prueba_calibracion', count(*), max(actualizado_en) from public.prueba_calibracion
  union all
  select 'registro_comida', count(*), max(actualizado_en) from public.registro_comida
  union all
  select 'registro_item', count(*), max(actualizado_en) from public.registro_item
  union all
  select 'respuestas', count(*), max(actualizado_en) from public.respuestas
  union all
  select 'usuarios_app', count(*), max(actualizado_en) from public.usuarios_app
  union all
  select 'visibilidad_nutricion', count(*), max(actualizado_en) from public.visibilidad_nutricion
  union all
  select 'checkins_nutricion', count(*), max(actualizado_en) from public.checkins_nutricion
$firma$;

comment on function public.firma_de_sincronizacion() is
  'Una fila por tabla hidratada: cuantas filas ve quien pregunta y cuando cambio la ultima. Sirve para saltarse la descarga de lo que no ha cambiado.';

revoke all on function public.firma_de_sincronizacion() from public;
revoke execute on function public.firma_de_sincronizacion() from anon;
grant execute on function public.firma_de_sincronizacion() to authenticated;

commit;

-- ── Comprobación ─────────────────────────────────────────────────────────────
--
-- 1) Las 22 filas (21 tablas + la vista), y ninguna con `ultimo_cambio` nulo
--    salvo las que esten vacias:
--
--   select * from public.firma_de_sincronizacion() order by tabla;
--
-- 2) Que el trigger este en las 21. Debe devolver 21:
--
--   select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
--    where t.tgname = 'trg_actualizado_en' and not t.tgisinternal;
--
-- 3) LA QUE IMPORTA: que la firma se mueva con un BORRADO, no solo con un alta.
--    Sobre una fila de prueba, en una transaccion que se deshace:
--
--   begin;
--     select filas from public.firma_de_sincronizacion() where tabla = 'premiaciones';
--     insert into public.premiaciones (id, usuario_id, titulo, fecha)
--       values ('tmp-firma', (select id from public.usuarios_app limit 1), 'prueba', current_date);
--     select filas from public.firma_de_sincronizacion() where tabla = 'premiaciones';  -- +1
--     delete from public.premiaciones where id = 'tmp-firma';
--     select filas from public.firma_de_sincronizacion() where tabla = 'premiaciones';  -- vuelve
--   rollback;
