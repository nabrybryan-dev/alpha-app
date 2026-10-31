-- 0151: el guion de llamada que deja la landing, para que Manuela lo lea antes de llamar.
--
-- QUÉ ES. Al terminar la evaluación en la landing, el agente de PRAXIS arma un «guion de llamada»:
-- quién es la persona (tramo de edad, objetivo), si hay alerta de salud, cómo abrir, qué le pesa,
-- qué mostrarle, las objeciones probables con su respuesta, el cierre, los avisos y el día y la
-- franja que prefiere para la llamada. Llega a la app por la Edge Function `guion-llamada` (con
-- `x-alpha-clave`, service role) y se lee en la consola (`GuionDeVenta.tsx`): en «Llamadas por
-- hacer» (Revisión) y, cuando ya hay cuenta, en la Ficha.
--
-- ANTES DE LA CUENTA (decisión de Bryan, 30-oct-2026). La llamada de venta es ANTES de pagar, y la
-- cuenta de la app se crea al pagar: el guion tiene que estar aquí desde que la persona reserva. Por
-- eso se ata a `person_id` (el id de la persona en la LANDING, `people.id`; otro proyecto, así que
-- sin FK) y `usuario_id` es opcional: lo pone la función cuando llega la cuenta, y entonces enlaza
-- TODAS las filas de esa persona.
--
-- `on delete cascade` en usuario_id (y no `set null`). Borrar una cuenta de la app es un acto
-- deliberado (casi siempre, una petición de borrado de datos), y el guion lleva nombre, correo y
-- WhatsApp: con `set null` esos datos se quedarían, y la persona volvería a salir en «Llamadas por
-- hacer» como si fuera un prospecto nuevo. Si la landing reenvía después, entra como sin cuenta.
--
-- POR QUÉ UNA FILA POR REVISIÓN. El guion es un documento del agente, no un formulario: si la
-- landing lo rehace (la persona cambia el día de la llamada) manda un guion nuevo y el viejo queda.
-- La pantalla lee la revisión más alta.
--
-- QUÉ ES `revision`. El esquema de la landing (`guion-llamada-v1`) trae `version` como TEXTO: es la
-- versión de la FORMA, no un contador. La revisión la deriva la Edge Function de `generado_en` (el
-- sello que la landing pone al armar cada guion): sus milisegundos desde 1970, de ahí el `bigint`.
-- Así no hay contador que coordinar entre dos sistemas: reenviar el MISMO guion (reintento de red)
-- da la misma revisión y el upsert por `unique (person_id, revision)` no duplica; un guion rehecho
-- trae un `generado_en` posterior y queda por encima.
--
-- LA PUERTA. La misma de las notas de llamada (0113): `es_coach()` o la capacidad
-- `leer_entrenamiento`, que es con lo que se entra a la consola. Manuela es `nutricionista` sin
-- `puesto_de_coach`: con `es_coach()` a secas leería cero filas sin error (lo que pasó con la
-- 0112). No se usa `es_staff()`: abre por rol, y una nutricionista nueva sin consola leería los
-- guiones de todos sin tener pantalla para ello.
--
-- NADIE ESCRIBE DESDE EL NAVEGADOR. Solo `select` para `authenticated`; sin políticas de
-- escritura. Escribe la Edge Function con service role, que salta RLS. El asesorado no ve su guion:
-- es material interno para la llamada de venta. Lleva el correo y el WhatsApp de la persona (Manuela
-- la llama): por eso la lectura es solo para quien entra a la consola, y nunca para `anon`.
--
-- NO SE APLICA SOLA. Se corre aparte (SQL Editor o `supabase db push` contra el proyecto de la
-- APP, no el de la landing). Comprobación: supabase/migrations/comprobar-0151.sql.
--
-- CÓMO VERIFICAR CON LA CUENTA DE MANUELA. Tras aplicar y desplegar la función, mandar un guion de
-- prueba sin usuario_id y entrar a la consola con la cuenta de Manuela: en Revisión, «Llamadas por
-- hacer» lo lista y abre la tarjeta «Guion de la llamada»; reenviado con el usuario_id de un
-- asesorado de prueba, la tarjeta sale también arriba en su Ficha, junto a las notas. Desde el
-- SQL Editor, la misma comprobación sin pantalla (pon el UUID de Manuela en el claim):
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub', '<uuid de Manuela>', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from public.guiones_llamada;   -- > 0 si hay guiones: la puerta la deja pasar
--   rollback;
-- Cero filas con guiones en la tabla = Manuela perdió `leer_entrenamiento` o la política no es esta.

begin;

create table if not exists public.guiones_llamada (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  usuario_id uuid null references public.usuarios_app(id) on delete cascade,
  origen text not null default 'landing',
  guion jsonb not null,
  dia_preferido date null,
  franja_preferida text null,
  revision bigint not null,
  creado_en timestamptz not null default now(),
  unique (person_id, revision)
);

comment on table public.guiones_llamada is
  'Guion de la llamada de venta que arma el agente de la landing (0151). Una fila por versión y persona de la landing (person_id); la app lee la más alta. Solo lectura para la consola.';
comment on column public.guiones_llamada.guion is
  'Guion guion-llamada-v1 tal cual lo manda la landing (persona con contacto, alerta_salud sí/no, apertura, dolores, que_mostrar, objeciones_probables, cierre, avisos, recomendaciones_praxis, reserva). La app lo lee de forma tolerante.';
comment on column public.guiones_llamada.revision is
  'Milisegundos de guion.generado_en (lo calcula la Edge Function): reenviar el mismo guion no duplica, uno rehecho queda encima.';
comment on column public.guiones_llamada.franja_preferida is
  'Franja de la llamada. En guion-llamada-v1 siempre tarde: Manuela llama de lunes a viernes, en la tarde.';
comment on column public.guiones_llamada.dia_preferido is
  'Día que la persona prefiere para la llamada, en hora de Colombia. Es una preferencia, no una cita.';

comment on column public.guiones_llamada.person_id is
  'Id de la persona en la base de la LANDING (people.id). Sin FK: es otro proyecto. Existe antes que la cuenta de la app.';
comment on column public.guiones_llamada.usuario_id is
  'Cuenta en la app (usuarios_app), cuando ya la hay. Null = todavía sin cuenta: sale en Llamadas por hacer. La pone la función al llegar alta-cliente, para todas las filas de la persona.';

create index if not exists guiones_llamada_person_idx on public.guiones_llamada (person_id);
create index if not exists guiones_llamada_usuario_idx on public.guiones_llamada (usuario_id);

alter table public.guiones_llamada enable row level security;

drop policy if exists guiones_llamada_leer on public.guiones_llamada;
create policy guiones_llamada_leer on public.guiones_llamada
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

revoke all on public.guiones_llamada from anon, public;
revoke all on public.guiones_llamada from authenticated;
grant select on public.guiones_llamada to authenticated;
grant all on public.guiones_llamada to service_role;

commit;
