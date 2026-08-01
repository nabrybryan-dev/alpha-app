-- 0018 · Que ve cada asesorado de sus propias cifras
--
-- POR QUE EXISTE. La app calcula sola el % de grasa, el objetivo calorico y el
-- total de kcal del dia. Para la mayoria de la gente ver eso es parte del
-- acompanamiento: es la forma tangible de saber que esta pasando con su
-- proceso. Para algunas personas -antecedente de conducta alimentaria, ciclo
-- irregular, restriccion documentada- esas mismas cifras empujan en la
-- direccion contraria.
--
-- Esa distincion NO la puede hacer un `if`. La hace la nutricionista. Esta tabla
-- es donde queda escrita su decision.
--
-- LO QUE NUNCA SE APAGA: el calculo. Corre siempre y para todos. El staff ve
-- todo. La alerta de disponibilidad energetica -que es justo la que protege a
-- quien esta en riesgo- funciona igual con los tres interruptores apagados.
-- Aqui solo se decide QUE VE EL ASESORADO.

begin;

-- ── Los interruptores ────────────────────────────────────────────────────────

create table if not exists public.visibilidad_nutricion (
  asesorado_id uuid primary key references public.usuarios_app (id) on delete cascade,

  -- Su % de grasa, masa magra e IMC. Un porcentaje es un juicio sobre su
  -- cuerpo, no sobre su conducta.
  ver_composicion       boolean not null default true,

  -- "2.100 kcal · P 115 · C 240 · G 62". Apagado, sigue viendo su plan entero
  -- -menus, porciones, intercambios-: come lo mismo, sin la cifra con la que
  -- negociar.
  ver_objetivo_calorico boolean not null default true,

  -- El anillo y el "te faltan 400 kcal" del diario. Es el que mas pesa: una
  -- pantalla de perfil se mira una vez, el contador cinco veces al dia. Apagado,
  -- sigue registrando igual y el coach sigue viendo todo.
  ver_contador_kcal     boolean not null default true,

  -- 'automatico' = nadie lo ha tocado, valen los valores por defecto.
  -- 'en_espera'  = la encuesta levanto una bandera y falta que Manuela decida.
  --                Los tres booleanos entran en false hasta entonces.
  -- 'decidido'   = Manuela ya lo miro. Lo que diga aqui manda.
  estado text not null default 'automatico'
    check (estado in ('automatico', 'en_espera', 'decidido')),

  actualizado_en timestamptz not null default now()
);

-- SIN FILA = TODO ENCENDIDO. Es el caso normal y no hace falta escribir nada
-- para que funcione: quien nunca haya pasado por aqui ve sus cifras.

comment on table public.visibilidad_nutricion is
  'Que cifras ve el asesorado. El calculo corre siempre; esto solo decide que se le muestra.';

-- ── La nota de la nutricionista, aparte ──────────────────────────────────────

/*
 * POR QUE UNA SEGUNDA TABLA Y NO UNA COLUMNA MAS.
 *
 * El motivo de la decision es una nota clinica: "antecedente de restriccion",
 * "ciclo ausente hace 4 meses". El asesorado SI tiene que poder leer sus
 * interruptores -sin eso la app no sabe que pintarle- pero NO esa nota.
 *
 * RLS es por fila, no por columna: no hay forma de dejar leer tres columnas y
 * esconder la cuarta de la misma tabla. Separarla es lo unico que lo garantiza
 * de verdad, y ademas se lee solo: quien mire este archivo ve donde esta el
 * limite sin tener que deducirlo de una politica.
 */
create table if not exists public.visibilidad_nutricion_nota (
  asesorado_id uuid primary key references public.usuarios_app (id) on delete cascade,
  motivo       text check (motivo is null or length(trim(motivo)) > 0),
  decidido_por uuid references public.usuarios_app (id),
  decidido_en  timestamptz,
  actualizado_en timestamptz not null default now()
);

comment on table public.visibilidad_nutricion_nota is
  'Por que se decidio asi. Solo staff: contiene notas clinicas sobre el asesorado.';

-- ── Seguridad ────────────────────────────────────────────────────────────────

alter table public.visibilidad_nutricion       enable row level security;
alter table public.visibilidad_nutricion_nota  enable row level security;

revoke all on public.visibilidad_nutricion, public.visibilidad_nutricion_nota from anon;

/*
 * AQUI LA LECTURA Y LA ESCRITURA NO SON SIMETRICAS, y es la unica tabla del
 * esquema donde pasa a proposito.
 *
 * El resto usa `for all` con la misma condicion en `using` y en `with check`.
 * Aqui no: si el asesorado pudiera escribir, encenderia sus propios
 * interruptores y toda esta migracion no serviria de nada. Justo la persona a
 * la que protege es la que no puede tocarla.
 */
create policy visibilidad_lee_lo_suyo on public.visibilidad_nutricion
  for select to authenticated
  using (asesorado_id = (select auth.uid()) or (select public.es_staff()));

create policy visibilidad_escribe_el_staff on public.visibilidad_nutricion
  for insert to authenticated
  with check ((select public.es_staff()));

create policy visibilidad_actualiza_el_staff on public.visibilidad_nutricion
  for update to authenticated
  using ((select public.es_staff()))
  with check ((select public.es_staff()));

create policy visibilidad_borra_el_staff on public.visibilidad_nutricion
  for delete to authenticated
  using ((select public.es_staff()));

-- La nota no la ve el asesorado ni para leer.
create policy nota_solo_staff on public.visibilidad_nutricion_nota
  for all to authenticated
  using ((select public.es_staff()))
  with check ((select public.es_staff()));

-- ── A quien hay que mirar ────────────────────────────────────────────────────

/*
 * Las que esperan decision, para el puesto de trabajo de Manuela.
 *
 * Es una vista y no una consulta suelta para que la app no tenga que repetir el
 * criterio en varios sitios: el dia que se anada otra razon para revisar, se
 * cambia aqui y ya.
 */
create or replace view public.visibilidad_pendiente
  -- `security_invoker = true` NO es opcional aqui.
  --
  -- Por defecto una vista corre con los permisos de SU DUENIO y se salta el RLS
  -- de las tablas de debajo: esta vista habria devuelto el nombre de todos los
  -- asesorados a cualquiera que la consultara, por muy bien escritas que
  -- estuvieran las politicas de arriba. Con el invoker activado, las politicas
  -- se aplican a quien pregunta, y solo el staff ve la lista.
  with (security_invoker = true) as
  select v.asesorado_id,
         u.nombre,
         v.actualizado_en
    from public.visibilidad_nutricion v
    join public.usuarios_app u on u.id = v.asesorado_id
   where v.estado = 'en_espera';

revoke all on public.visibilidad_pendiente from anon;

comment on view public.visibilidad_pendiente is
  'Asesorados cuyas cifras esperan la decision de la nutricionista.';

commit;
