-- ============================================================================
-- 0178 · Tablero de creadores: segundo camino de entrada desde la landing (PRAXIS)
-- ============================================================================
--
-- SIN APLICAR. Escrita el 11-nov-2026. Revisar `list_migrations` / `schema_migrations` justo
-- antes de aplicarla: este repo numera las migraciones a mano y puede haber choques, como pasó
-- con la 0176 (nació como 0175 y tuvo que renumerarse porque otra rama ya tenía ese número).
-- La prueba `supabase/test/274-creadores-desde-landing.sql` corre en el CI.
--
-- PARA QUÉ. Hoy `creadores_candidatos` (0090) solo la llena el importador de casa
-- (`bola-de-nieve/tablero/subir_creadores.py`), que descubre creadores en Instagram y entra con
-- `creador_id = 'ig:<id numérico>'`. La landing pública va a tener su propio PRAXIS
-- (agente conversacional) para que un creador se postule solo; cuando complete ese formulario
-- conversado, la Edge Function `creadores-landing` de este repo lo mete en el MISMO tablero
-- — sin tocar ni una línea del importador existente.
--
-- QUÉ CAMBIA.
--   1. `creadores_candidatos.creador_id`: el check solo aceptaba `ig:<dígitos>`. Un creador que
--      llega por la landing y que el radar no tiene no trae ese id numérico — solo el @ que
--      escribió en el chat —, así que se acepta TAMBIÉN `land:<usuario_ig>`.
--   2. `creadores_candidatos.origen`: columna nueva, aditiva, con default `'importador'`. El
--      importador no manda esta columna y el default la cubre: no se rompe nada de lo que ya
--      corre. Solo las filas que CREA `creadores_landing_registrar` llevan `'landing-praxis'`.
--   3. `creadores_eventos.actor`: se añade `'landing'` a la lista cerrada.
--   4. `creadores_contactos`: tabla nueva, una fila por contacto recibido (WhatsApp o correo,
--      con su valor). El contacto NO va en `metricas`: la 0090 las define «sin datos personales»
--      y el importador las reescribe en cada pasada. Aquí cada envío queda guardado con su valor,
--      también el segundo y el tercero del mismo @.
--   5. `creadores_landing_registrar(...)`: la única puerta de escritura de este camino (SQL
--      libre: cero — la Edge Function solo llama RPC, igual que `cadena-agentes`).
--   6. `creadores_candidatos.no_contactar` + `p_declina` (Bryan, 11-nov): columna nueva, aditiva,
--      default `false`. Cubre «si dice que no o está en la lista de exclusión: no se le vuelve a
--      contactar y se guarda solo lo mínimo»:
--        a) el creador DECLINA el interés (`p_declina = true`): se guarda (o se marca, si ya
--           existía) con `no_contactar = true`, SIN crear fila en `creadores_contactos` aunque la
--           Edge Function mande un contacto — se ignora a propósito, última línea de defensa,
--           igual que ya hace con `mayor_edad`. Si la fila es nueva, el carril es `'descartado'`,
--           no `'encuesta'`. Si la fila YA existía (también una `ig:` del radar), su `carril` NO
--           se toca — es del importador — solo se enciende `no_contactar`.
--        b) la fila YA tenía `no_contactar = true` (de un declina anterior o de una exclusión
--           futura importada desde otro camino): un contacto nuevo por la landing NO reactiva
--           nada — ni `creadores_contactos`, ni `carril`, ni `metricas` — solo un evento con
--           motivo «contacto bloqueado por exclusión». La función nunca le dice al creador que
--           está excluido: la landing cierra la conversación igual para todos.
--      LIMITACIÓN A PROPÓSITO: esta función es hoy la única fuente de `no_contactar = true`. Si el
--      radar del ASUS mantiene su propia lista de exclusión, no se lee desde aquí — sin acceso de
--      este repo al ASUS. El campo y la regla quedan listos para cuando esa lista se importe a
--      esta tabla; hasta entonces, un @ excluido SOLO en el ASUS que llega por la landing se trata
--      como interesado normal.
--
-- EL @ YA ESTÁ EN EL TABLERO (el caso normal). Bryan escribe por DM a alguien que el radar ya
-- tiene como `ig:<id>` y esa persona llega a la landing. La función busca primero por
-- `usuario_ig` (prefiere la fila `ig:` si hay de los dos tipos):
--   · Si hay una `ig:`, NO crea `land:`: guarda el contacto contra esa fila, le añade
--     «dejó contacto en la landing» a `motivos` y toca `actualizado_en`. No toca su carril, sus
--     métricas ni su `origen`: son del importador. OJO: el importador puede reescribir los
--     `motivos` de una fila `ig:` en su siguiente pasada; lo que DURA es el evento (actor
--     `landing`) y la fila de `creadores_contactos`.
--   · Si solo hay una `land:` (volvió a pasar por la landing), igual: contacto, motivo y evento.
--   · Si no hay ninguna, crea la `land:` en el carril `encuesta` (= «Encuesta de ingreso»),
--     segmento `aliado`, `origen = 'landing-praxis'`.
-- En los dos primeros casos `es_nuevo = false` y se devuelve el `creador_id` que ya existía.
-- Un candado por @ (`pg_advisory_xact_lock`) ordena dos envíos simultáneos del mismo @, para que
-- el segundo vea la fila del primero en vez de crear otra.
--
-- MAYOR DE EDAD. La función exige `mayor_edad = true`: es la última línea de defensa, porque el
-- candado real vive también en la Edge Function, antes de llegar aquí.
--
-- QUIÉN PUEDE QUÉ. `creadores_contactos` sigue el molde de las otras tres tablas: RLS, sin
-- privilegios para anon/authenticated salvo `select`, lectura con `puede_ver_creadores()` (el
-- coach y quien tiene `revisar_creadores`), escribe solo `service_role`.
-- `creadores_landing_registrar` es `security definer` y solo `service_role` tiene `EXECUTE`. El
-- `revoke` nombra a `authenticated` a propósito: en Supabase los privilegios por defecto de
-- `public` dan EXECUTE de cada función nueva a anon, authenticated y service_role DIRECTAMENTE,
-- no vía PUBLIC; revocar solo `from public, anon` dejaría a cualquier asesorado con sesión
-- metiendo filas en el tablero.
--
-- EL EVENTO. `event_id = 'land:<usuario_ig>:<epoch en segundos>'`; si el mismo @ llega dos veces
-- en el mismo segundo (doble envío), el segundo evento se descarta (`on conflict do nothing`) en
-- vez de devolver un 500 (el contacto sí se guarda). Para un candidato que ya existía,
-- `carril_anterior` y `carril_nuevo` llevan su carril VIGENTE: la historia no cuenta un
-- movimiento que no hubo.
--
-- CÓMO REVERTIRLA:
--   begin;
--   drop function if exists public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean, boolean);
--   drop table if exists public.creadores_contactos;
--   alter table public.creadores_eventos
--     drop constraint creadores_eventos_actor_check,
--     add constraint creadores_eventos_actor_check
--       check (actor in ('radar', 'claude', 'astra', 'bryan', 'manuela', 'importador'));
--   alter table public.creadores_candidatos drop column no_contactar;
--   alter table public.creadores_candidatos drop column origen;
--   alter table public.creadores_candidatos
--     drop constraint creadores_candidatos_creador_id_check,
--     add constraint creadores_candidatos_creador_id_check check (creador_id ~ '^ig:[0-9]+$');
--   commit;
--   (Se pierden los contactos recibidos. Y las filas con creador_id 'land:…' y los eventos con
--   actor 'landing' dejan de cumplir los checks viejos: borrarlos a mano ANTES de revertir si ya
--   hay alguno, o el `add constraint` falla.)
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Relaja el check de creador_id: también 'land:<usuario_ig>'
-- ────────────────────────────────────────────────────────────────────────────
-- El nombre del constraint se busca por catálogo (patrón de la 0090 con
-- capacidades_staff_capacidad_check), para no asumirlo.
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.creadores_candidatos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%creador_id%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.creadores_candidatos drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.creadores_candidatos
  add constraint creadores_candidatos_creador_id_check
  check (creador_id ~ '^(ig:[0-9]+|land:[a-z0-9._]{1,30})$');

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Columna origen — de dónde entró el candidato (aditiva)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.creadores_candidatos
  add column if not exists origen text not null default 'importador'
    check (origen in ('importador', 'landing-praxis'));

comment on column public.creadores_candidatos.origen is
  'Camino de entrada: importador (radar de casa, 0090) o landing-praxis (0178, formulario '
  'conversado en la landing pública). Aditiva: el importador no la manda y el default la cubre.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2b · Columna no_contactar — «no se le vuelve a contactar» (aditiva)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.creadores_candidatos
  add column if not exists no_contactar boolean not null default false;

comment on column public.creadores_candidatos.no_contactar is
  'Declinó el interés o está excluido (0178): true = no se le vuelve a contactar. Solo '
  'creadores_landing_registrar la enciende hoy; aditiva, default false, no rompe al importador.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · creadores_eventos.actor: se añade 'landing'
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.creadores_eventos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%actor%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.creadores_eventos drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.creadores_eventos
  add constraint creadores_eventos_actor_check
  check (actor in ('radar', 'claude', 'astra', 'bryan', 'manuela', 'importador', 'landing'));

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · CREADORES_CONTACTOS — una fila por contacto recibido
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.creadores_contactos (
  id           uuid primary key default gen_random_uuid(),
  creador_id   text not null references public.creadores_candidatos(creador_id) on delete cascade,
  tipo         text not null check (tipo in ('whatsapp', 'correo')),
  valor        text not null check (char_length(valor) between 1 and 200),
  origen       text not null default 'landing-praxis' check (origen in ('importador', 'landing-praxis')),
  recibido_en  timestamptz not null default now()
);

comment on table public.creadores_contactos is
  'Contactos de creadores (0178, 2026-11-11): una fila por envío, con su valor. Dato personal: '
  'por eso NO va en creadores_candidatos.metricas. La escribe solo service_role '
  '(creadores_landing_registrar); el navegador lee con puede_ver_creadores().';

create index if not exists creadores_contactos_por_creador
  on public.creadores_contactos (creador_id, recibido_en desc);

alter table public.creadores_contactos enable row level security;
revoke all on public.creadores_contactos from anon, authenticated, public;
grant select on public.creadores_contactos to authenticated;
grant all on public.creadores_contactos to service_role;

drop policy if exists creadores_contactos_leer on public.creadores_contactos;
create policy creadores_contactos_leer on public.creadores_contactos
  for select to authenticated
  using ((select public.puede_ver_creadores()));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · creadores_landing_registrar — única puerta de escritura para este camino
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.creadores_landing_registrar(
  p_usuario_ig text,
  p_nicho text,
  p_ciudad text,
  p_rango_seguidores text,
  p_ya_crea_contenido boolean,
  p_contacto_tipo text,
  p_contacto text,
  p_mayor_edad boolean,
  p_declina boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contacto    text := btrim(p_contacto);
  v_id          text;
  v_carril      text;
  v_existia     boolean;
  v_excluido    boolean;
  v_motivo      text;
  v_declina     boolean := coalesce(p_declina, false);
begin
  -- Última línea de defensa: el candado real de edad vive en la Edge Function, antes de
  -- llegar aquí. Esta función nunca guarda a quien no confirmó ser mayor de edad, decline o no.
  if p_mayor_edad is not true then
    raise exception 'mayor_edad requerido' using errcode = '22023';
  end if;
  if p_usuario_ig is null or p_usuario_ig !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'usuario_ig inválido' using errcode = '22023';
  end if;
  -- Si declina, el contacto no hace falta (y si llega, esta función lo ignora más abajo).
  if not v_declina then
    if p_contacto_tipo is null or p_contacto_tipo not in ('whatsapp', 'correo') then
      raise exception 'contacto_tipo inválido' using errcode = '22023';
    end if;
    if v_contacto is null or char_length(v_contacto) not between 1 and 200 then
      raise exception 'contacto inválido' using errcode = '22023';
    end if;
  end if;

  -- Dos envíos simultáneos del mismo @ se ordenan: el segundo ve la fila del primero.
  perform pg_advisory_xact_lock(hashtext('creadores_landing:' || p_usuario_ig));

  -- ¿Ya está en el tablero con ese @? Primero la fila del radar (ig:), luego la de la landing.
  select c.creador_id, c.carril, c.no_contactar into v_id, v_carril, v_excluido
    from public.creadores_candidatos c
   where c.usuario_ig = p_usuario_ig
   order by (c.creador_id like 'ig:%') desc, c.actualizado_en desc, c.creador_id
   limit 1;
  v_existia := found;
  v_excluido := coalesce(v_excluido, false);

  if v_existia and v_excluido then
    -- Ya excluido (declina anterior, o una exclusión importada a futuro): un contacto nuevo
    -- NO reactiva nada. Ni creadores_contactos, ni carril, ni metricas. Solo un evento, para que
    -- quede registrado el intento sin guardar un dato de más.
    update public.creadores_candidatos
       set actualizado_en = now(),
           motivos = motivos || jsonb_build_array('nuevo contacto desde landing pese a exclusión')
     where creador_id = v_id;
    insert into public.creadores_eventos (
      event_id, creador_id, carril_anterior, carril_nuevo, motivo, actor, fecha_dato
    )
    values (
      'land:' || p_usuario_ig || ':' || extract(epoch from now())::bigint,
      v_id, v_carril, v_carril, 'contacto bloqueado por exclusión', 'landing', now()
    )
    on conflict (event_id) do nothing;
    return jsonb_build_object('creador_id', v_id, 'es_nuevo', false, 'no_contactar', true);
  end if;

  if not v_existia then
    v_id := 'land:' || p_usuario_ig;
    v_carril := case when v_declina then 'descartado' else 'encuesta' end;
    v_motivo := case when v_declina then 'declinó el interés en el PRAXIS de la landing'
                      else 'alta desde landing' end;
    insert into public.creadores_candidatos (
      creador_id, usuario_ig, segmento, carril, motivos, metricas, fecha_dato, fecha_recepcion,
      origen, no_contactar
    )
    values (
      v_id, p_usuario_ig, 'aliado', v_carril,
      jsonb_build_array(v_motivo),
      -- Si declina, metricas queda vacía a propósito: no se guarda nicho/ciudad/rango aunque
      -- la Edge Function los mande — "se guarda solo lo mínimo" es el @ y ya.
      case when v_declina then '{}'::jsonb else jsonb_build_object(
        'nicho', p_nicho,
        'ciudad', p_ciudad,
        'rango_seguidores', p_rango_seguidores,
        'ya_crea_contenido', p_ya_crea_contenido
      ) end,
      now(), now(), 'landing-praxis', v_declina
    );
  else
    -- Nunca pisa carril, fecha_dato, métricas ni origen: solo anota el motivo y, si declina,
    -- enciende no_contactar (sin tocar carril, ni siquiera si la fila es ig: del importador).
    v_motivo := case when v_declina then 'declinó el interés en el PRAXIS de la landing'
                      when v_id like 'ig:%' then 'dejó contacto en la landing'
                      else 'nuevo contacto desde landing' end;
    update public.creadores_candidatos
       set actualizado_en = now(),
           no_contactar = no_contactar or v_declina,
           motivos = motivos || jsonb_build_array(v_motivo)
     where creador_id = v_id;
  end if;

  -- Solo se guarda un contacto de verdad cuando NO declina: declinar es "lo mínimo", sin valor
  -- de contacto en creadores_contactos aunque la Edge Function lo mande.
  if not v_declina then
    insert into public.creadores_contactos (creador_id, tipo, valor, origen)
    values (v_id, p_contacto_tipo, v_contacto, 'landing-praxis');
  end if;

  insert into public.creadores_eventos (
    event_id, creador_id, carril_anterior, carril_nuevo, motivo, actor, fecha_dato
  )
  values (
    'land:' || p_usuario_ig || ':' || extract(epoch from now())::bigint,
    v_id,
    case when v_existia then v_carril else null end,
    v_carril,
    v_motivo,
    'landing',
    now()
  )
  -- El event_id va al segundo: un doble envío del mismo @ en el mismo segundo no es un 500.
  on conflict (event_id) do nothing;

  return jsonb_build_object('creador_id', v_id, 'es_nuevo', not v_existia, 'no_contactar', v_declina);
end
$$;

comment on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean, boolean) is
  'Contacto de un creador llegado por el PRAXIS de la landing (0178). Si el @ ya está en el '
  'tablero (prefiere la fila ig: del radar) no crea otra: guarda el contacto y anota el evento. '
  'Si no, crea la fila land: en el carril encuesta. p_declina = true (o un @ ya con '
  'no_contactar) guarda/marca solo lo mínimo y no vuelve a contactar. Única puerta de escritura '
  'de este camino; la llama solo la Edge Function creadores-landing.';

revoke all on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.creadores_landing_registrar(text, text, text, text, boolean, text, text, boolean, boolean) to service_role;

commit;
