-- ============================================================================
-- 0094 · Decisiones compartidas entre Bryan y Manuela (fase 3 de Administración)
-- ============================================================================
--
-- Respalda la tarjeta «Decisiones compartidas» de Equipo (maqueta «Espacios de Alpha»,
-- aprobada el 28-sep-2026) con el esquema de la habilidad `decisiones-compartidas`
-- (`esquema-propuesto.md` §2 a §5, CONTRATO.md D4), en su versión MÍNIMA:
--
--   · UNA tabla, `decisiones`: quién decidió, área, palanca («qué»), dirección («hacia dónde
--     lleva»), a quién le toca, y la firma del otro con su estado.
--   · Escribe SOLO la función `anotar_decision()` (actor = auth.uid(), nunca un parámetro);
--     la firma la da SOLO el otro, con `firmar_decision()`.
--   · El estado NO es una columna: sale de la vista `decisiones_con_estado` (una firma
--     vencida nunca se convierte en firmada; una decisión sin plazo o sin referencia queda
--     «incompleta»).
--
-- QUÉ NO ENTRA, Y POR QUÉ (para que nadie crea que ya está):
--   · `decisiones_eventos`, `decisiones_notas`, reemplazo/versión, revocación, la detección
--     de choques C-01..C-08 y el trabajo de vencimiento: siguen en la fase local
--     (`BN/decisiones/`). Aquí el vencimiento se calcula al leer.
--   · Las capacidades `decidir_finanzas` y `autorizar_creadores`: H-02 sigue abierta, así que
--     `finanzas` y las palancas `incorporacion` y `microprueba` las anota solo el coach.
--   · `le_toca` es UNA fila (a quién, qué, plazo), no una lista.
--
-- NUNCA DATOS DE SALUD (regla de la habilidad, §5.2). En entrenamiento y nutrición NO hay
-- texto libre (valor, resumen, notas y dinero deben ser nulos; `le_toca_que` es de una lista
-- cerrada) y la referencia es un puntero `{tabla, id}` a un plan de la app. Donde sí hay texto
-- (creadores y finanzas) pasa por `decision_texto_limpio()`: las palabras y patrones vetados
-- de la habilidad (cifras con unidad clínica, palabras de salud, @, correos, teléfonos).
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso, `revoke all …
-- from anon, authenticated, public` antes de conceder nada, y cada función `security definer`
-- con `search_path` fijo y `revoke … from public, anon`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: decisiones_compartidas
-- ────────────────────────────────────────────────────────────────────────────
-- `capacidades_staff_capacidad_check` es UN SOLO check compartido (DC4): se lee la lista
-- VIGENTE de la base, nunca una copiada de otra migración, y se reescribe entera + la nueva.
do $$
declare
  v_nombre text;
  v_def    text;
  v_lista  text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontró el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  -- La definición sale como ARRAY['a'::text, …] (cada nombre entre comillas) o, si alguien la
  -- reescribió con un literal, como '{a,b,…}'::text[]: se leen las dos formas.
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['decisiones_compartidas']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  -- `in (…)` con cada nombre citado: así la definición sigue en la forma que lee el bloque de arriba.
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

-- Solo casa con filas reales (el CI arranca con la base vacía).
--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'decisiones_compartidas'
  from public.usuarios_app u
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · AYUDAS PURAS: palancas por área y lista de vetadas
-- ────────────────────────────────────────────────────────────────────────────
-- Palancas por área (esquema §3, provisional H-04): lista cerrada.
create or replace function public.decision_palancas(p_area text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_area
    when 'entrenamiento' then array['volumen','frecuencia','intensidad','ejercicio','descarga','cardio','plan_nuevo','plan_renovado','pausa']
    when 'nutricion'     then array['energia','distribucion','alimento','plan_nuevo','plan_renovado','pausa']
    when 'creadores'     then array['puerta_nicho','puerta_idioma','volumen_contactos','estado_contacto','desempate','microprueba','incorporacion','segmento','plantilla_mensaje','tarea_mensaje']
    when 'finanzas'      then array['pago_equipo','gasto_fijo','precio','tope','reserva','comision','bono']
    else array[]::text[]
  end;
$$;

-- Palabras y patrones vetados (esquema §2, «fin-vetadas»; provisional H-06). Devuelve true si
-- el texto está LIMPIO (o es nulo). Lo que NO caza una lista, lo cierra la estructura: en las
-- áreas clínicas no hay texto libre.
create or replace function public.decision_texto_limpio(p_texto text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_texto is null or not (
       -- cifras con unidad clínica o de carga
       lower(p_texto) ~ '[0-9]+([.,][0-9]+)*\s*(kcal|cal|g|gr|kg|lb|ml|series?|reps?|rir|rpe)\y'
       -- un porcentaje solo si va con grasa
    or lower(p_texto) ~ '[0-9]+\s*%\s*de\s+grasa'
       -- palabras de salud
    or lower(p_texto) ~ '\y(dolor|lesión|lesion|diagnóstico|diagnostico|medicamento|peso corporal|grasa|glucosa|presión|presion|embarazo|rodilla|hombro|espalda|ansiedad|depresión|depresion)\y'
       -- @usuario y correos
    or p_texto ~ '@[A-Za-z0-9_.]'
       -- móvil colombiano, con o sin +57, espacios o guiones
    or p_texto ~ '(^|[^0-9-])(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)'
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · DECISIONES
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.decisiones (
  id                  uuid primary key default gen_random_uuid(),
  -- Quién decidió: sale de auth.uid() dentro de la función. Una persona, nunca un agente.
  decidido_por        uuid not null references public.usuarios_app(id),
  decidido_en         date not null default current_date,
  anotado_en          timestamptz not null default now(),
  area                text not null check (area in ('entrenamiento', 'nutricion', 'creadores', 'finanzas')),
  palanca             text not null,
  -- «Hacia dónde lleva».
  direccion           text not null check (direccion in
                        ('sube', 'baja', 'mantiene', 'inicia', 'detiene', 'incluye', 'excluye', 'cambia')),
  sujeto              text not null check (
                        sujeto ~ '^(cli-[0-9]+|ig:[0-9]+|ent-[0-9]+|equipo:(bryan|manuela)|negocio:[a-z_]+)$'
                        and public.decision_texto_limpio(sujeto)),
  valor               text check (char_length(valor) between 1 and 60),
  monto_cop           bigint check (monto_cop >= 0),
  periodicidad        text check (periodicidad in ('unica', 'mensual', 'semanal')),
  vigencia_desde      date not null default current_date,
  vigencia_hasta      date,
  resumen             text check (char_length(resumen) between 1 and 140),
  notas               text check (char_length(notas) between 1 and 280),
  -- Puntero al plan, aprobación, mensaje o firma de la app: solo la clave, nunca el contenido.
  referencia_tabla    text check (referencia_tabla in ('microciclos', 'aprobaciones', 'mensajes', 'casos_firma')),
  referencia_id       text check (referencia_id ~ '^[a-z0-9-]{1,64}$'),
  -- «A quién le toca».
  le_toca_a           text check (le_toca_a in ('bryan', 'manuela')),
  le_toca_que         text check (char_length(le_toca_que) between 1 and 80),
  le_toca_vence       date,
  -- La firma del otro.
  firma_de            uuid references public.usuarios_app(id),
  firma_nivel         text check (firma_nivel in ('firma', 'aviso')),
  firma_estado        text check (firma_estado in ('pendiente', 'firmada', 'rechazada', 'visto')),
  firma_vence_en      date,
  firma_respondida_en timestamptz,
  firma_motivo        text check (char_length(firma_motivo) between 1 and 280),
  -- La misma decisión anotada dos veces es una sola (esquema §2, huella).
  idempotencia        text not null unique,

  constraint decisiones_palanca_del_area
    check (palanca = any (public.decision_palancas(area))),
  constraint decisiones_negocio_es_palanca_del_area
    check (sujeto !~ '^negocio:' or substr(sujeto, 9) = any (public.decision_palancas(area))),
  -- E-04: en entrenamiento y nutrición no hay texto libre ni dinero.
  constraint decisiones_clinicas_sin_texto_libre
    check (area in ('creadores', 'finanzas')
           or (valor is null and resumen is null and notas is null
               and monto_cop is null and periodicidad is null)),
  constraint decisiones_clinicas_tarea_cerrada
    check (area in ('creadores', 'finanzas') or le_toca_que is null
           or le_toca_que in ('cuadrar con el plan de nutrición', 'cuadrar con el plan de entrenamiento')),
  constraint decisiones_dinero_solo_en_finanzas
    check (area = 'finanzas' or monto_cop is null),
  constraint decisiones_monto_con_periodicidad
    check (monto_cop is null or periodicidad is not null),
  -- R2-04: un monto 0 en estas palancas no se acepta salvo que diga «sin costo».
  constraint decisiones_monto_cero_dicho
    check (monto_cop is distinct from 0
           or palanca not in ('pago_equipo', 'gasto_fijo', 'precio', 'comision', 'bono')
           or lower(coalesce(valor, '') || ' ' || coalesce(notas, '')) like '%sin costo%'),
  constraint decisiones_vigencia_ordenada
    check (vigencia_hasta is null or vigencia_hasta >= vigencia_desde),
  constraint decisiones_referencia_completa
    check ((referencia_tabla is null) = (referencia_id is null)),
  constraint decisiones_le_toca_completo
    check (le_toca_a is not null or (le_toca_que is null and le_toca_vence is null)),
  constraint decisiones_texto_limpio
    check (public.decision_texto_limpio(valor) and public.decision_texto_limpio(resumen)
           and public.decision_texto_limpio(notas) and public.decision_texto_limpio(le_toca_que)
           and public.decision_texto_limpio(firma_motivo) and public.decision_texto_limpio(referencia_id)),
  -- La firma es del OTRO, y o está entera o no hay.
  constraint decisiones_firma_del_otro
    check (firma_de is null or firma_de <> decidido_por),
  constraint decisiones_firma_entera
    check ((firma_de is null and firma_nivel is null and firma_estado is null
            and firma_vence_en is null and firma_respondida_en is null and firma_motivo is null)
           or (firma_de is not null and firma_nivel is not null and firma_estado is not null)),
  constraint decisiones_firma_estado_del_nivel
    check (firma_estado is null
           or (firma_nivel = 'firma' and firma_estado in ('pendiente', 'firmada', 'rechazada'))
           or (firma_nivel = 'aviso' and firma_estado in ('pendiente', 'visto'))),
  constraint decisiones_firma_respondida
    check (firma_estado is null or ((firma_estado = 'pendiente') = (firma_respondida_en is null))),
  -- Molde de la 0040: un veto sin motivo no se guarda.
  constraint decisiones_rechazo_con_motivo
    check (firma_estado is distinct from 'rechazada' or firma_motivo is not null)
);

comment on table public.decisiones is
  'Decisiones compartidas Bryan/Manuela (0094, 2026-09-28). Sin datos de salud. Escribe solo '
  'anotar_decision(); firma solo firmar_decision() y solo el otro. El estado sale de la vista '
  'decisiones_con_estado, no de una columna.';

create index if not exists decisiones_por_fecha on public.decisiones (anotado_en desc);
create index if not exists decisiones_por_clave on public.decisiones (sujeto, palanca);

alter table public.decisiones enable row level security;
-- Sin este revoke, un UPDATE sin política «pasa» sobre cero filas (lección de la 0084).
revoke all on public.decisiones from anon, authenticated, public;
grant select on public.decisiones to authenticated;
grant all on public.decisiones to service_role;

create policy decisiones_leer on public.decisiones
  for select to authenticated
  using ((select public.es_coach()) or (select public.tiene_capacidad('decisiones_compartidas')));
-- Sin políticas de insert/update/delete: todo cambio va por las funciones de abajo.

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · VISTA: el estado se calcula, no se guarda
-- ────────────────────────────────────────────────────────────────────────────
-- Vista con los privilegios de su dueño (para poder mostrar el NOMBRE de quien decidió y de
-- quien firma sin abrir `usuarios_app`), pero con el MISMO filtro de lectura que la tabla: si
-- quien llama no es coach ni tiene la capacidad, no ve ninguna fila.
drop view if exists public.decisiones_con_estado;
create view public.decisiones_con_estado as
select
  d.*,
  (select u.nombre from public.usuarios_app u where u.id = d.decidido_por) as decidido_por_nombre,
  (select u.nombre from public.usuarios_app u where u.id = d.firma_de)     as firma_de_nombre,
  array_remove(array[
    case when d.area in ('entrenamiento', 'nutricion') and d.referencia_tabla is null
         then 'FALTA: referencia al plan en la app' end,
    case when d.firma_nivel = 'firma' and d.firma_estado = 'pendiente' and d.firma_vence_en is null
         then 'FALTA: plazo de firma' end,
    case when d.palanca in ('pago_equipo', 'gasto_fijo', 'precio', 'comision', 'bono') and d.monto_cop is null
         then 'FALTA: monto' end
  ], null) as faltan,
  (d.vigencia_desde > current_date) as programada,
  case
    when d.firma_estado = 'rechazada' then 'rechazada'
    -- Un plazo vencido NUNCA se convierte en firma (C-08): queda vencida.
    when d.firma_nivel = 'firma' and d.firma_estado = 'pendiente'
         and d.firma_vence_en is not null and d.firma_vence_en < current_date then 'vencida'
    when d.area in ('entrenamiento', 'nutricion') and d.referencia_tabla is null then 'incompleta'
    when d.firma_nivel = 'firma' and d.firma_estado = 'pendiente' and d.firma_vence_en is null then 'incompleta'
    when d.palanca in ('pago_equipo', 'gasto_fijo', 'precio', 'comision', 'bono') and d.monto_cop is null then 'incompleta'
    when d.firma_nivel = 'firma' and d.firma_estado = 'pendiente' then 'propuesta'
    else 'vigente'
  end as estado
from public.decisiones d
where (select public.es_coach()) or (select public.tiene_capacidad('decisiones_compartidas'));

revoke all on public.decisiones_con_estado from anon, authenticated, public;
grant select on public.decisiones_con_estado to authenticated;
grant all on public.decisiones_con_estado to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · FUNCIONES
-- ────────────────────────────────────────────────────────────────────────────
-- Quién puede anotar y firmar: el coach o quien tenga la capacidad.
create or replace function public.puede_decidir_compartido()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_coach() or public.tiene_capacidad('decisiones_compartidas');
$$;
revoke all on function public.puede_decidir_compartido() from public, anon;
grant execute on function public.puede_decidir_compartido() to authenticated, service_role;

-- A quién se le puede pedir la firma: las OTRAS personas con acceso al registro.
create or replace function public.companeros_de_decision()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.nombre
    from public.usuarios_app u
   where public.puede_decidir_compartido()
     and u.id <> auth.uid()
     and (u.rol = 'coach'
          or exists (select 1 from public.capacidades_staff c
                      where c.usuario_id = u.id and c.capacidad = 'decisiones_compartidas'))
   order by u.nombre;
$$;
revoke all on function public.companeros_de_decision() from public, anon;
grant execute on function public.companeros_de_decision() to authenticated, service_role;

-- ANOTAR. El actor sale de auth.uid(); con la misma huella devuelve la fila existente.
create or replace function public.anotar_decision(
  p_area             text,
  p_palanca          text,
  p_direccion        text,
  p_sujeto           text,
  p_valor            text default null,
  p_monto_cop        bigint default null,
  p_periodicidad     text default null,
  p_vigencia_desde   date default null,
  p_vigencia_hasta   date default null,
  p_resumen          text default null,
  p_notas            text default null,
  p_referencia_tabla text default null,
  p_referencia_id    text default null,
  p_le_toca_a        text default null,
  p_le_toca_que      text default null,
  p_le_toca_vence    date default null,
  p_firma_de         uuid default null,
  p_firma_nivel      text default null,
  p_firma_vence_en   date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo     uuid := auth.uid();
  v_coach  boolean;
  v_desde  date := coalesce(p_vigencia_desde, current_date);
  v_huella text;
  v_id     uuid;
  v_nivel  text;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  v_coach := public.es_coach();
  if not (v_coach or public.tiene_capacidad('decisiones_compartidas')) then
    raise exception 'no tienes acceso al registro de decisiones' using errcode = '42501';
  end if;
  -- Autoridad (esquema §5, mientras H-02 esté abierta): dinero y altas de creadores, solo el coach.
  if (p_area = 'finanzas' or p_palanca in ('incorporacion', 'microprueba')) and not v_coach then
    raise exception 'esa decisión la anota solo el coach' using errcode = '42501';
  end if;

  -- La firma, si se pide, es de OTRA persona con acceso al registro.
  if p_firma_de is not null then
    if p_firma_de = v_yo then
      raise exception 'la firma es de la otra persona, no la tuya' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.usuarios_app u
       where u.id = p_firma_de
         and (u.rol = 'coach'
              or exists (select 1 from public.capacidades_staff c
                          where c.usuario_id = u.id and c.capacidad = 'decisiones_compartidas'))
    ) then
      raise exception 'quien firma no tiene acceso al registro de decisiones' using errcode = '23514';
    end if;
    v_nivel := coalesce(p_firma_nivel, 'firma');
  elsif p_firma_nivel is not null or p_firma_vence_en is not null then
    raise exception 'un plazo o un nivel de firma piden quién firma' using errcode = '23514';
  end if;

  -- Dos anotaciones de la misma clave no se cruzan a mitad.
  perform pg_advisory_xact_lock(hashtext(coalesce(p_sujeto, '') || ':' || coalesce(p_palanca, '')));

  v_huella := encode(sha256(convert_to(json_build_array(
    v_yo, current_date, p_area, p_sujeto, p_palanca, p_direccion, p_valor, p_monto_cop,
    p_periodicidad, v_desde, p_vigencia_hasta)::text, 'utf8')), 'hex');

  insert into public.decisiones (
    decidido_por, area, palanca, direccion, sujeto, valor, monto_cop, periodicidad,
    vigencia_desde, vigencia_hasta, resumen, notas, referencia_tabla, referencia_id,
    le_toca_a, le_toca_que, le_toca_vence,
    firma_de, firma_nivel, firma_estado, firma_vence_en, idempotencia
  ) values (
    v_yo, p_area, p_palanca, p_direccion, p_sujeto, nullif(btrim(p_valor), ''), p_monto_cop, p_periodicidad,
    v_desde, p_vigencia_hasta, nullif(btrim(p_resumen), ''), nullif(btrim(p_notas), ''),
    p_referencia_tabla, p_referencia_id,
    p_le_toca_a, nullif(btrim(p_le_toca_que), ''), p_le_toca_vence,
    p_firma_de, v_nivel, case when p_firma_de is null then null else 'pendiente' end,
    case when p_firma_de is null then null else p_firma_vence_en end, v_huella
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select d.id into v_id from public.decisiones d where d.idempotencia = v_huella;
  end if;
  return v_id;
end
$$;
revoke all on function public.anotar_decision(text, text, text, text, text, bigint, text, date, date, text, text, text, text, text, text, date, uuid, text, date) from public, anon;
grant execute on function public.anotar_decision(text, text, text, text, text, bigint, text, date, date, text, text, text, text, text, text, date, uuid, text, date) to authenticated, service_role;

-- FIRMAR. Solo la persona a quien le toca, una sola vez, y nunca después del plazo.
create or replace function public.firmar_decision(
  p_id        uuid,
  p_veredicto text,
  p_motivo    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  d    public.decisiones%rowtype;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  select * into d from public.decisiones where id = p_id for update;
  if not found then
    raise exception 'esa decisión no existe' using errcode = 'P0002';
  end if;
  if d.firma_de is distinct from v_yo then
    raise exception 'esta firma no te toca' using errcode = '42501';
  end if;
  if d.firma_estado <> 'pendiente' then
    raise exception 'esta decisión ya tiene respuesta' using errcode = '23514';
  end if;
  if d.firma_nivel = 'firma' and d.firma_vence_en is not null and d.firma_vence_en < current_date then
    raise exception 'el plazo de firma venció: se anota una decisión nueva' using errcode = '23514';
  end if;
  if not ((d.firma_nivel = 'firma' and p_veredicto in ('firmada', 'rechazada'))
       or (d.firma_nivel = 'aviso' and p_veredicto = 'visto')) then
    raise exception 'veredicto no válido para una decisión de nivel %', d.firma_nivel using errcode = '23514';
  end if;
  if p_veredicto = 'rechazada' and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'un rechazo sin motivo no se guarda' using errcode = '23514';
  end if;

  update public.decisiones
     set firma_estado = p_veredicto,
         firma_respondida_en = now(),
         firma_motivo = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_id;
end
$$;
revoke all on function public.firmar_decision(uuid, text, text) from public, anon;
grant execute on function public.firmar_decision(uuid, text, text) to authenticated, service_role;

commit;
