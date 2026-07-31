-- Registro de comidas del asesorado.
-- Spec: ../docs/superpowers/specs/2026-07-31-registro-de-comidas-design.md
--
-- Datos de composicion nutricional tomados de la Tabla de Composicion de
-- Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
-- Familiar - ICBF.

begin;

-- Como se obtuvo la cantidad. Determina el margen de error del dato.
-- `create type` no admite IF NOT EXISTS en PostgreSQL, a diferencia de las
-- tablas e indices de aqui abajo. Un pegado repetido o truncado la haria
-- fallar sola en vez de quedar en no-op: mismo riesgo de aplicacion a medias
-- que la 0013 (ver supabase/comprobar-migraciones.sql), asi que se envuelve.
do $$
begin
  if to_regtype('public.confianza_registro') is null then
    create type public.confianza_registro as enum (
      'pesado', 'estimado_calibrado', 'estimado', 'ajeno'
    );
  end if;
end $$;

create table if not exists public.registro_comida (
  id                bigint generated always as identity primary key,
  -- Contra usuarios_app, no contra auth.users: es la referencia que usa el
  -- resto del esquema (perfiles, microciclos, checkins...) y la que
  -- es_staff() consulta para resolver el rol. Referenciar auth.users aqui
  -- habria dejado a esta tabla con una nocion de identidad distinta a la de
  -- todas las demas.
  asesorado_id      uuid not null references public.usuarios_app(id) on delete cascade,
  momento           timestamptz not null default now(),
  comida            text not null check (comida in ('desayuno','almuerzo','cena','snack')),
  -- Si no cocino el, no se le puede preguntar por el aceite ni por la sal.
  cocinado_por_el   boolean not null default true,
  aceite_g          numeric(6,2) check (aceite_g >= 0),
  sal_g             numeric(6,2) check (sal_g >= 0),
  confianza         confianza_registro not null default 'estimado',
  creado_en         timestamptz not null default now()
);

create index if not exists registro_comida_por_asesorado
  on public.registro_comida (asesorado_id, momento desc);

create table if not exists public.registro_item (
  id              bigint generated always as identity primary key,
  registro_id     bigint not null references public.registro_comida(id) on delete cascade,
  -- restrict y no el default implicito: sin esto, borrar un alimento
  -- (un asesorado puede borrar los que declaro el mismo, ver 0014) borraria
  -- en silencio el historial de quien lo registro si algun dia esto pasara
  -- a cascade por error. Explicito, como ya hace 0014 con ingrediente_id.
  alimento_id     text not null references public.alimentos(id) on delete restrict,
  gramos          numeric(8,2) not null check (gramos >= 0),
  fue_pesado      boolean not null default false,
  -- El estado con el que se calculo. Se guarda aunque venga del alimento,
  -- porque saber que se asumio es lo que permite auditar el dato despues.
  estado_asumido  text not null check (estado_asumido in ('crudo','cocido','seco','listo','preparado','en_lata'))
);

create index if not exists registro_item_por_registro
  on public.registro_item (registro_id);

-- FK sin indexar: un update/delete en alimentos recorreria esta tabla entera
-- para comprobar la restriccion. registro_item va a ser, con diferencia, la
-- tabla de mayor crecimiento del esquema.
create index if not exists registro_item_por_alimento
  on public.registro_item (alimento_id);

-- La respuesta de R1: se pregunta una vez por familia de alimento y se recuerda.
create table if not exists public.preferencia_estado (
  asesorado_id  uuid not null references public.usuarios_app(id) on delete cascade,
  familia       text not null,
  estado        text not null check (estado in ('crudo','cocido','seco')),
  primary key (asesorado_id, familia)
);

-- Las pruebas de calibracion: estimar primero, pesar despues.
create table if not exists public.prueba_calibracion (
  id                bigint generated always as identity primary key,
  asesorado_id      uuid not null references public.usuarios_app(id) on delete cascade,
  -- Sin default: current_date correria en el huso del servidor (Supabase =
  -- UTC), no en el del asesorado (Colombia, UTC-5). Una prueba de una cena
  -- registrada de noche quedaria fechada al dia siguiente, corrompiendo el
  -- conteo de dias_pesando y el orden de "ultimas 15" de R4. El cliente
  -- manda la fecha local, igual que ya hacen checkins.fecha y
  -- adherencias.fecha (0001), que tampoco tienen default.
  fecha             date not null,
  alimento_id       text not null references public.alimentos(id) on delete restrict,
  gramos_estimados  numeric(8,2) not null check (gramos_estimados >= 0),
  gramos_reales     numeric(8,2) not null check (gramos_reales > 0),
  -- Se calcula en la base para que no dependa de que el cliente lo mande bien.
  -- numeric(12,2) y no (6,2): gramos_estimados y gramos_reales son (8,2) e
  -- independientes, asi que el cociente no tiene techo natural. 105 g
  -- estimados sobre 1 g real -un pellizco que parecio puñado, o un simple
  -- error de tecleo- ya dan 10.400%, por encima de lo que (6,2) admite
  -- ("numeric field overflow"), justo en el dato peor calibrado: el que esta
  -- tabla existe para guardar. (12,2) cubre cualquier combinacion que las
  -- otras dos columnas puedan producir.
  error_pct         numeric(12,2) generated always as
                      ((gramos_estimados - gramos_reales) / gramos_reales * 100) stored
);

create index if not exists prueba_calibracion_por_asesorado
  on public.prueba_calibracion (asesorado_id, fecha desc);

create index if not exists prueba_calibracion_por_alimento
  on public.prueba_calibracion (alimento_id);

-- ── Seguridad ────────────────────────────────────────────────────────────────
-- Son datos personales de salud. Cada quien ve lo suyo; el staff ve todo.

alter table public.registro_comida     enable row level security;
alter table public.registro_item       enable row level security;
alter table public.preferencia_estado  enable row level security;
alter table public.prueba_calibracion  enable row level security;

revoke all on public.registro_comida, public.registro_item,
                public.preferencia_estado, public.prueba_calibracion
  from anon;

-- (select auth.uid()) / (select public.es_staff()) y no las llamadas sueltas:
-- envueltas asi el planificador las trata como initplan (se evaluan una vez
-- por consulta) en vez de volver a llamarlas por cada fila evaluada. Patron
-- de rendimiento de Supabase para RLS. Las migraciones 0001-0014 de este
-- repo no lo usan, pero estas cuatro tablas -sobre todo registro_comida y
-- registro_item- van a crecer sin tope mientras las demas son casi estaticas
-- o una fila por dia; vale la pena aqui aunque sea la primera vez.
create policy registro_comida_propio on public.registro_comida
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or public.es_staff())
  with check (asesorado_id = (select auth.uid()) or public.es_staff());

create policy registro_item_propio on public.registro_item
  for all to authenticated
  using (exists (select 1 from public.registro_comida r
                 where r.id = registro_id
                   and (r.asesorado_id = (select auth.uid()) or public.es_staff())))
  with check (exists (select 1 from public.registro_comida r
                      where r.id = registro_id
                        and (r.asesorado_id = (select auth.uid()) or public.es_staff())));

create policy preferencia_estado_propia on public.preferencia_estado
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or public.es_staff())
  with check (asesorado_id = (select auth.uid()) or public.es_staff());

create policy prueba_calibracion_propia on public.prueba_calibracion
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or public.es_staff())
  with check (asesorado_id = (select auth.uid()) or public.es_staff());

commit;
