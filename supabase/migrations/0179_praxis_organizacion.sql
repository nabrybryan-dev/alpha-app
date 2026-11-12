-- 0179 · Praxis organiza la app hablando: dónde se guarda la organización de cada persona (fase O4).
--
-- Orden de Bryan del 11-nov-2026 («doy la orden de cambiar la base de datos»). Diseño:
-- docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md §7 (rama spec/praxis-interactiva) y
-- biblioteca-praxis/DISENO-TARJETA-CONFIRMACION-ORGANIZAR-20261111.md.
--
-- QUÉ CREA (nada existente se toca):
--   · praxis_organizacion          una fila por persona: qué piezas escondió, cuáles fijó y cuánto movió cada una.
--   · praxis_organizacion_cambios  el historial: cada cambio con su `antes` y su `despues`, para deshacer.
--   · praxis_organizacion_aplicar(p_cambio, p_version)  y  praxis_organizacion_deshacer()  (las únicas vías de escritura).
--
-- REGLAS QUE VIVEN AQUÍ (no se confía en el teléfono):
--   · Solo ids del catálogo, nunca texto libre. Las listas de ids las GENERA src/app/organizacionSql.test.ts desde
--     el catálogo (`GENERAR_SQL=1 npx vitest run src/app/organizacionSql.test.ts`); no se editan a mano.
--   · Solo se esconde lo libre (lo fijo, lo asignado por el coach, lo del equipo y las pantallas que los contienen, no).
--   · Tope de 6 escondidas (Bryan, 9-nov), salvo «solo lo importante», que lo salta a propósito.
--   · Hoy y Praxis (núcleo de la barra) no se fijan ni se mueven.
--   · `p_version` detecta el choque entre aparatos: si la fila cambió en otro, no se toca nada.
--   · Esconder peso o medidas marca `avisa_coach` (lo calcula el servidor, no el teléfono). El coach lo ve SIN la frase:
--     no se guarda ninguna frase en ninguna de las dos tablas.
--   · 60 cambios por hora y persona como máximo.
--
-- QUIÉN LEE: la persona lo suyo; el equipo (es_staff_id, 0164) todo, para dar soporte y ver los avisos. Nadie escribe
-- directo en las tablas. anon no ve nada.
--
-- SE DESHACE CON:  drop function public.praxis_organizacion_deshacer(); drop function public.praxis_organizacion_aplicar(jsonb, int);
--   drop table public.praxis_organizacion_cambios; drop table public.praxis_organizacion;
--   drop function public.praxis_organizacion_es_ocultable(text); drop function public.praxis_organizacion_es_organizable(text);
--   drop function public.praxis_organizacion_esconde_peso(text);
-- Comprobar después de aplicar: supabase/migrations/comprobar-0179.sql

begin;

-- ── Las listas del catálogo (GENERADAS) ─────────────────────────────────────────────────────────────────────────────
-- INICIO LISTAS GENERADAS
-- GENERADO por src/app/organizacionSql.test.ts desde el catálogo: no se edita a mano.
create or replace function public.praxis_organizacion_es_ocultable(p_id text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_id = any(array[
    'bienestar.historial',
    'bienestar.medidas',
    'bienestar.mensajes-vida',
    'bienestar.vida',
    'contenidos.lista',
    'cuestionarios.enviados',
    'entrenar.camara',
    'entrenar.tambor',
    'hoy.album',
    'hoy.bloque',
    'hoy.carteles',
    'hoy.cifras',
    'hoy.contenidos',
    'hoy.radar',
    'hoy.semana',
    'logros.album',
    'logros.medallas',
    'logros.nivel',
    'logros.premios',
    'logros.rachas',
    'logros.ranking',
    'nutricion.adherencia',
    'nutricion.agua',
    'nutricion.calibracion',
    'nutricion.micros',
    'nutricion.recetas',
    'nutricion.resumen',
    'nutricion.tira-semana',
    'pantalla:/contenidos',
    'pantalla:/logros',
    'pantalla:/progreso',
    'progreso.checkins',
    'progreso.competencias',
    'progreso.escala',
    'progreso.evolucion',
    'progreso.fatiga',
    'progreso.logros',
    'progreso.medidas',
    'progreso.velocidad',
    'semana.dias',
    'semana.mensajes-vida',
    'semana.notas',
    'semana.resumen',
    'semana.revision',
    'semana.vida',
    'yo.buzon'
  ]::text[]);
$$;

create or replace function public.praxis_organizacion_es_organizable(p_id text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_id = any(array[
    'bienestar.checkin',
    'bienestar.historial',
    'bienestar.medidas',
    'bienestar.mensajes-vida',
    'bienestar.recordatorio',
    'bienestar.vida',
    'chat.conversacion',
    'chat.remitente',
    'contenidos.lista',
    'cuestionarios.enviados',
    'cuestionarios.pendientes',
    'entrenar.camara',
    'entrenar.salon',
    'entrenar.tambor',
    'hoy.actualizar-salud',
    'hoy.album',
    'hoy.aviso-sincronizacion',
    'hoy.bloque',
    'hoy.carteles',
    'hoy.checkin',
    'hoy.cifras',
    'hoy.contenidos',
    'hoy.cuestionario-de-salud',
    'hoy.encabezado',
    'hoy.escribir-al-coach',
    'hoy.nutricion',
    'hoy.pendientes',
    'hoy.permiso-avisos',
    'hoy.pregunta-del-dia',
    'hoy.radar',
    'hoy.semana',
    'hoy.sesion',
    'logros.album',
    'logros.medallas',
    'logros.nivel',
    'logros.premios',
    'logros.rachas',
    'logros.ranking',
    'nutricion.adherencia',
    'nutricion.agua',
    'nutricion.calibracion',
    'nutricion.comidas',
    'nutricion.micros',
    'nutricion.recetas',
    'nutricion.resumen',
    'nutricion.tira-semana',
    'pantalla:/bienestar',
    'pantalla:/chat',
    'pantalla:/contenidos',
    'pantalla:/cuestionarios',
    'pantalla:/entrenar',
    'pantalla:/logros',
    'pantalla:/nutricion',
    'pantalla:/nutricion/al-dia',
    'pantalla:/nutricion/plan',
    'pantalla:/progreso',
    'pantalla:/semana',
    'pantalla:/yo',
    'pantalla:/yo/derechos',
    'plan.contexto',
    'plan.intercambios',
    'plan.menus',
    'plan.mercado',
    'plan.ondulacion',
    'plan.perfil',
    'plan.suplementos',
    'progreso.checkins',
    'progreso.competencias',
    'progreso.escala',
    'progreso.evolucion',
    'progreso.fatiga',
    'progreso.logros',
    'progreso.medidas',
    'progreso.velocidad',
    'semana.chat',
    'semana.dias',
    'semana.mensajes-vida',
    'semana.notas',
    'semana.responder',
    'semana.resumen',
    'semana.revision',
    'semana.vida',
    'yo.avisos',
    'yo.buzon',
    'yo.clave',
    'yo.derechos'
  ]::text[]);
$$;

create or replace function public.praxis_organizacion_esconde_peso(p_id text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_id = any(array[
    'bienestar.medidas',
    'pantalla:/bienestar',
    'pantalla:/progreso',
    'progreso.medidas'
  ]::text[]);
$$;
-- FIN LISTAS GENERADAS

revoke all on function public.praxis_organizacion_es_ocultable(text) from public, anon;
revoke all on function public.praxis_organizacion_es_organizable(text) from public, anon;
revoke all on function public.praxis_organizacion_esconde_peso(text) from public, anon;
grant execute on function public.praxis_organizacion_es_ocultable(text) to authenticated, service_role;
grant execute on function public.praxis_organizacion_es_organizable(text) to authenticated, service_role;
grant execute on function public.praxis_organizacion_esconde_peso(text) to authenticated, service_role;

-- ── Las tablas ──────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.praxis_organizacion (
  usuario_id     uuid primary key references public.usuarios_app(id) on delete cascade,
  version        int not null default 0 check (version >= 0),
  ocultas        text[] not null default '{}' check (cardinality(ocultas) <= 60),
  fijadas        text[] not null default '{}' check (cardinality(fijadas) <= 60),
  -- { id_de_pieza: cuántos lugares se movió (negativo = arriba) }, entre -20 y 20.
  movidas        jsonb not null default '{}'::jsonb check (jsonb_typeof(movidas) = 'object'),
  actualizado_en timestamptz not null default now()
);

comment on table public.praxis_organizacion is
  '0179: organización de la app de cada persona (Praxis, organizar hablando). Solo ids del catálogo, sin texto libre. '
  'Se escribe SOLO con praxis_organizacion_aplicar / _deshacer.';

create table if not exists public.praxis_organizacion_cambios (
  id              bigint generated always as identity primary key,
  usuario_id      uuid not null references public.usuarios_app(id) on delete cascade,
  creado_en       timestamptz not null default now(),
  accion          text not null check (accion in ('ocultar', 'fijar', 'mover_arriba', 'mover_abajo', 'restablecer', 'solo_lo_importante')),
  piezas          text[] not null default '{}' check (cardinality(piezas) <= 60),
  version_antes   int not null,
  version_despues int not null,
  antes           jsonb not null check (jsonb_typeof(antes) = 'object'),
  despues         jsonb not null check (jsonb_typeof(despues) = 'object'),
  -- Escondió peso o medidas: el coach lo ve, sin la frase (decisión de Bryan, 10-nov).
  avisa_coach     boolean not null default false,
  deshecho_en     timestamptz
);

comment on table public.praxis_organizacion_cambios is
  '0179: historial de la organización (para deshacer y para que el coach vea que se escondió peso o medidas, sin la frase).';

create index if not exists praxis_organizacion_cambios_por_persona
  on public.praxis_organizacion_cambios (usuario_id, id desc);
create index if not exists praxis_organizacion_cambios_avisos
  on public.praxis_organizacion_cambios (creado_en desc) where avisa_coach;

alter table public.praxis_organizacion enable row level security;
alter table public.praxis_organizacion_cambios enable row level security;

revoke all on public.praxis_organizacion from public, anon, authenticated;
revoke all on public.praxis_organizacion_cambios from public, anon, authenticated;
grant select on public.praxis_organizacion to authenticated;
grant select on public.praxis_organizacion_cambios to authenticated;
grant all on public.praxis_organizacion to service_role;
grant all on public.praxis_organizacion_cambios to service_role;

drop policy if exists praxis_organizacion_leer on public.praxis_organizacion;
create policy praxis_organizacion_leer on public.praxis_organizacion
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_staff_id(auth.uid()));

drop policy if exists praxis_organizacion_cambios_leer on public.praxis_organizacion_cambios;
create policy praxis_organizacion_cambios_leer on public.praxis_organizacion_cambios
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_staff_id(auth.uid()));

-- ── Aplicar un cambio confirmado ────────────────────────────────────────────────────────────────────────────────────
-- p_cambio: {"tipo":"pieza","accion":"ocultar|fijar|mover_arriba|mover_abajo","pieza":"<id>"}
--         | {"tipo":"restablecer"} | {"tipo":"solo_lo_importante","piezas":["<id>", ...]}
-- p_version: la versión que el teléfono tenía al proponer (null = no comprobar).
-- Devuelve {"resultado":"aplicado"|"choque","version":n}. Un cambio que rompe una regla lanza 22023 (no se toca nada).
create or replace function public.praxis_organizacion_aplicar(p_cambio jsonb, p_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_fila    public.praxis_organizacion;
  v_tipo    text;
  v_accion  text;
  v_pieza   text;
  v_piezas  text[] := '{}';
  v_ocultas text[];
  v_fijadas text[];
  v_movidas jsonb;
  v_avisa   boolean := false;
  v_delta   int;
  v_version int;
begin
  if v_uid is null then raise exception 'praxis_organizacion: sin sesion' using errcode = '42501'; end if;
  if p_cambio is null or jsonb_typeof(p_cambio) <> 'object' then raise exception 'praxis_organizacion: cambio invalido' using errcode = '22023'; end if;
  v_tipo := p_cambio->>'tipo';

  perform pg_advisory_xact_lock(hashtext('praxis_organizacion:' || v_uid::text));
  insert into public.praxis_organizacion (usuario_id) values (v_uid) on conflict (usuario_id) do nothing;
  select * into v_fila from public.praxis_organizacion where usuario_id = v_uid for update;

  if p_version is not null and p_version <> v_fila.version then
    return jsonb_build_object('resultado', 'choque', 'version', v_fila.version);
  end if;
  if (select count(*) from public.praxis_organizacion_cambios c where c.usuario_id = v_uid and c.creado_en > now() - interval '1 hour') >= 60 then
    raise exception 'praxis_organizacion: demasiados cambios en una hora' using errcode = '54000';
  end if;

  v_ocultas := v_fila.ocultas; v_fijadas := v_fila.fijadas; v_movidas := v_fila.movidas;

  if v_tipo = 'pieza' then
    v_accion := p_cambio->>'accion';
    v_pieza := p_cambio->>'pieza';
    if v_pieza is null then raise exception 'praxis_organizacion: falta la pieza' using errcode = '22023'; end if;
    v_piezas := array[v_pieza];
    if v_accion = 'ocultar' then
      if not public.praxis_organizacion_es_ocultable(v_pieza) then raise exception 'praxis_organizacion: esa pieza no se esconde' using errcode = '22023'; end if;
      if v_pieza = any(v_ocultas) then raise exception 'praxis_organizacion: ya estaba escondida' using errcode = '22023'; end if;
      if cardinality(v_ocultas) >= 6 then raise exception 'praxis_organizacion: tope de 6 escondidas' using errcode = '22023'; end if;
      v_ocultas := v_ocultas || v_pieza;
      v_avisa := public.praxis_organizacion_esconde_peso(v_pieza);
    elsif v_accion in ('fijar', 'mover_arriba', 'mover_abajo') then
      if not public.praxis_organizacion_es_organizable(v_pieza) then raise exception 'praxis_organizacion: esa pieza no se organiza' using errcode = '22023'; end if;
      if v_accion = 'fijar' then
        if not v_pieza = any(v_fijadas) then v_fijadas := v_fijadas || v_pieza; end if;
      else
        v_delta := case when v_accion = 'mover_arriba' then -1 else 1 end;
        v_movidas := jsonb_set(v_movidas, array[v_pieza], to_jsonb(greatest(-20, least(20, coalesce((v_movidas->>v_pieza)::int, 0) + v_delta))));
      end if;
    else
      raise exception 'praxis_organizacion: accion desconocida' using errcode = '22023';
    end if;
  elsif v_tipo = 'restablecer' then
    v_accion := 'restablecer';
    v_ocultas := '{}'; v_fijadas := '{}'; v_movidas := '{}'::jsonb;
  elsif v_tipo = 'solo_lo_importante' then
    v_accion := 'solo_lo_importante';
    if jsonb_typeof(p_cambio->'piezas') <> 'array' then raise exception 'praxis_organizacion: faltan las piezas' using errcode = '22023'; end if;
    v_piezas := array(select distinct x from jsonb_array_elements_text(p_cambio->'piezas') x);
    if cardinality(v_piezas) not between 1 and 60 then raise exception 'praxis_organizacion: piezas fuera de rango' using errcode = '22023'; end if;
    if exists (select 1 from unnest(v_piezas) x where not public.praxis_organizacion_es_ocultable(x)) then
      raise exception 'praxis_organizacion: alguna pieza no se esconde' using errcode = '22023';
    end if;
    v_avisa := exists (select 1 from unnest(v_piezas) x where public.praxis_organizacion_esconde_peso(x) and not x = any(v_ocultas));
    v_ocultas := array(select distinct x from unnest(v_ocultas || v_piezas) x order by x);
  else
    raise exception 'praxis_organizacion: tipo desconocido' using errcode = '22023';
  end if;

  update public.praxis_organizacion
     set ocultas = v_ocultas, fijadas = v_fijadas, movidas = v_movidas, version = version + 1, actualizado_en = now()
   where usuario_id = v_uid
  returning version into v_version;

  insert into public.praxis_organizacion_cambios (usuario_id, accion, piezas, version_antes, version_despues, antes, despues, avisa_coach)
  values (v_uid, v_accion, v_piezas, v_fila.version, v_version,
          jsonb_build_object('ocultas', to_jsonb(v_fila.ocultas), 'fijadas', to_jsonb(v_fila.fijadas), 'movidas', v_fila.movidas),
          jsonb_build_object('ocultas', to_jsonb(v_ocultas), 'fijadas', to_jsonb(v_fijadas), 'movidas', v_movidas),
          v_avisa);

  return jsonb_build_object('resultado', 'aplicado', 'version', v_version);
end;
$$;

-- ── Deshacer el último cambio ───────────────────────────────────────────────────────────────────────────────────────
-- Devuelve el `antes` del último cambio sin deshacer, solo si la organización sigue igual a su `despues` (si cambió en
-- otro aparato: «choque», no se toca nada). Se puede repetir: cada vez devuelve UN cambio más atrás.
-- Devuelve {"resultado":"aplicado"|"choque"|"nada","version":n}.
create or replace function public.praxis_organizacion_deshacer()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_fila    public.praxis_organizacion;
  v_cambio  public.praxis_organizacion_cambios;
  v_version int;
begin
  if v_uid is null then raise exception 'praxis_organizacion: sin sesion' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('praxis_organizacion:' || v_uid::text));
  select * into v_fila from public.praxis_organizacion where usuario_id = v_uid for update;
  if not found then return jsonb_build_object('resultado', 'nada', 'version', 0); end if;

  select * into v_cambio from public.praxis_organizacion_cambios c
   where c.usuario_id = v_uid and c.deshecho_en is null
   order by c.id desc limit 1;
  if not found then return jsonb_build_object('resultado', 'nada', 'version', v_fila.version); end if;

  if jsonb_build_object('ocultas', to_jsonb(v_fila.ocultas), 'fijadas', to_jsonb(v_fila.fijadas), 'movidas', v_fila.movidas) <> v_cambio.despues then
    return jsonb_build_object('resultado', 'choque', 'version', v_fila.version);
  end if;

  update public.praxis_organizacion
     set ocultas = array(select jsonb_array_elements_text(v_cambio.antes->'ocultas')),
         fijadas = array(select jsonb_array_elements_text(v_cambio.antes->'fijadas')),
         movidas = v_cambio.antes->'movidas',
         version = version + 1,
         actualizado_en = now()
   where usuario_id = v_uid
  returning version into v_version;

  update public.praxis_organizacion_cambios set deshecho_en = now() where id = v_cambio.id;
  return jsonb_build_object('resultado', 'aplicado', 'version', v_version);
end;
$$;

revoke all on function public.praxis_organizacion_aplicar(jsonb, int) from public, anon;
revoke all on function public.praxis_organizacion_deshacer() from public, anon;
grant execute on function public.praxis_organizacion_aplicar(jsonb, int) to authenticated;
grant execute on function public.praxis_organizacion_deshacer() to authenticated;

commit;
