-- ============================================================================
-- 0084 · «Reanudar» y «Preparar para firmar» desde la consola
-- ============================================================================
--
-- Contrato: `vigia-codex/consola-20260924/CONTRATO-FIRMA-Y-REANUDAR.md` (25-sep-2026,
-- decisiones de Bryan). Es la única fuente de verdad de esta migración; no se cambian
-- nombres respecto a él.
--
-- NÚMERO. Comprobado el 25-sep contra `origin/main` (llega a la 0083), TODAS las ramas
-- remotas vivas (incluida `revision/la-firma`, que resultó estar idéntica a `main` — sin
-- diff, sin migración propia) y `mcp__supabase__list_migrations` (registro desplegado:
-- la última es la 0083 `consola_servidor_y_permisos`, 24/25-sep). Ninguna trae una 0084.
-- Es el siguiente número libre en las tres fuentes a la vez, igual que hizo la 0083
-- consigo misma frente a la 0079 (reservada por el PR #296, sin fusionar).
--
-- QUÉ ENTRA AQUÍ, Y QUÉ NO.
--   1. `ordenes.tipo` admite además `reanudar` (capacidad `detener_publicacion`, la MISMA
--      que `detener` — decisión de Bryan: «cualquiera del equipo puede reanudar») y
--      `preparar_firma` (capacidad `leer_entrenamiento`). Mismo `objetivo` que las dos
--      órdenes existentes: `{usuario_id, semana_inicio, motivo}`.
--   2. `casos_firma`: el estado del ciclo de firma por descarga y subida, que gobierna el
--      equipo de mesa (repo de agentes, fase 2, fuera de esta migración) y que la consola
--      solo LEE y hace avanzar en un único punto: la RPC del final.
--   3. Bucket privado `firmas` + políticas de Storage: el navegador lee el `.json` sin
--      firmar (la decisión, subida por el equipo de mesa) y sube SOLO el `.sig`
--      (la firma, generada en el portátil con `FIRMAR-CASO.ps1`). Nunca puede subir ni
--      reemplazar el `.json`, y nunca puede reemplazar un `.sig` ya subido: no hay
--      política de `update` para ninguno de los dos, en ninguna carpeta.
--   4. RPC `registrar_firma(caso_id)`: el ÚNICO camino por el que una fila de
--      `casos_firma` pasa de `listo_para_firmar` a `firmado` desde el navegador. El actor
--      sale de `auth.uid()`, igual que `responder_como_staff` en la 0083 (Q2 de Astra: un
--      valor que manda el cliente «no acredita autoría»). No verifica la firma — eso
--      sigue siendo del equipo de mesa, fuera de la base — solo comprueba que el `.sig`
--      ya está subido en su ruta.
--
-- SEGURIDAD, la misma regla de siempre (`GUIA-BRYAN.md` §10, ya citada por la 0083): toda
-- función en `public` queda expuesta como RPC a `anon` en cuanto se crea. `registrar_firma`
-- lleva `set search_path = public` fijo y su propio `revoke … from public, anon`.
-- `casos_firma` enciende RLS en el mismo `create table` y pierde sus privilegios por
-- defecto con `revoke all from anon, public` antes de conceder nada.
--
-- STORAGE EN EL CI. El check `base-de-datos` (`.github/workflows/ci.yml`) aplica las
-- migraciones sobre un `pgvector/pgvector:pg16` puro; lo que existe de Storage ahí es
-- SOLO lo que `supabase/test/00-suplantar-supabase.sql` monta a mano (`storage.buckets`,
-- `storage.objects` con `id/bucket_id/name/owner`, `storage.foldername()`) — ya lo usan
-- sin guardas las migraciones 0022/0061/0065/0068, así que el `insert into
-- storage.buckets` y las políticas de `storage.objects` de aquí van IGUAL DE
-- DESPROTEGIDAS que esas. Lo que el CI NO tiene es columnas o funciones más allá de esas
-- cuatro cosas (la lección de la 0082 con `file_size_limit`) — y esta migración no toca
-- ninguna, así que no hace falta un `do $$ if exists … $$` aquí.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · ORDENES: dos tipos nuevos
-- ────────────────────────────────────────────────────────────────────────────
-- El `check` de `tipo` no llevaba nombre explícito en la 0083, así que Postgres le puso
-- uno por defecto. Se localiza por definición (contiene `tipo` y es un `check` de esta
-- tabla) en vez de fiarse a ciegas del nombre adivinado `ordenes_tipo_check`: si el
-- nombre real fuera otro, un `drop constraint if exists ordenes_tipo_check` no
-- encontraría nada, el `add constraint` de abajo crearía un check SEGUNDO con el mismo
-- nombre que uno inexistente, y el check VIEJO (solo 4 valores) seguiría vigente sin que
-- nada lo avisara — `reanudar` y `preparar_firma` seguirían rechazados en silencio.
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.ordenes'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%tipo%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.ordenes drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.ordenes
  add constraint ordenes_tipo_check
  check (tipo in ('detener', 'reportar_riesgo', 'pedir_correccion', 'responder', 'reanudar', 'preparar_firma'));

comment on constraint ordenes_tipo_check on public.ordenes is
  '0084: añade reanudar (misma capacidad que detener) y preparar_firma (leer_entrenamiento) '
  'a los cuatro tipos de la 0083.';

-- La política de alta se REEMPLAZA entera (no se puede `alter policy` una expresión):
-- misma forma que la 0083, con los dos `when` nuevos al final.
drop policy if exists ordenes_crear_segun_capacidad on public.ordenes;
create policy ordenes_crear_segun_capacidad on public.ordenes
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and case tipo
      when 'detener'           then (select public.tiene_capacidad('detener_publicacion'))
      when 'reportar_riesgo'   then (select public.tiene_capacidad('reportar_riesgo'))
      when 'pedir_correccion'  then (select public.tiene_capacidad('leer_entrenamiento'))
      when 'responder'         then (select public.tiene_capacidad('responder_por_asesorado'))
      -- Misma capacidad que 'detener' a propósito: Bryan decidió que reanudar no exige
      -- un permiso más estricto que el de detener (§ del contrato, "cualquiera del
      -- equipo puede reanudar").
      when 'reanudar'          then (select public.tiene_capacidad('detener_publicacion'))
      when 'preparar_firma'    then (select public.tiene_capacidad('leer_entrenamiento'))
      else false
    end
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · CASOS_FIRMA
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.casos_firma (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios_app(id) on delete cascade,
  semana_inicio   date not null,
  -- NULL solo cuando el caso nace `rechazado` sin nada que firmar: el equipo de mesa
  -- localiza la corrida y no encuentra ni retiros que justifiquen un BLOQUEADO ni una
  -- negación de R2 por sesiones — no hay tipo que asignarle a un caso que no existe como
  -- decisión. Fuera de ese único cruce (`rechazado` + tipo null), sigue exigiendo uno de
  -- los dos valores: un caso `preparando`/`listo_para_firmar`/`firmado`/`verificado` SIN
  -- tipo sería un caso a medio llenar, no uno vacío a propósito.
  -- `tipo in (...)` con `tipo` NULL da NULL (ni true ni false), y un CHECK trata NULL
  -- como si pasara — así que la rama de "tiene un tipo válido" necesita `tipo is not
  -- null` explícito, o el caso `listo_para_firmar` con tipo NULL de más abajo se cuela
  -- (se cayó así la primera versión de esta migración: CI lo atrapó al aplicar 80-
  -- consola-firma-y-reanudar.sql).
  tipo            text
                    check (
                      (tipo is not null and tipo in ('retiro', 'recorte'))
                      or (tipo is null and estado = 'rechazado')
                    ),
  estado          text not null default 'preparando'
                    check (estado in (
                      'preparando', 'listo_para_firmar', 'firmado', 'verificado',
                      'rechazado', 'caducado'
                    )),
  -- Ruta del `.json` SIN firmar en el bucket `firmas` (la sube el equipo de mesa). La
  -- firma vive en `ruta_decision || '.sig'`: no hace falta una columna aparte para ella
  -- antes de que exista — `registrar_firma` la calcula y la guarda en `ruta_firma` recién
  -- cuando confirma que el archivo está subido.
  ruta_decision   text,
  ruta_firma      text,
  valida_hasta    timestamptz,
  -- La orden `preparar_firma` que originó este caso. Sin `on delete cascade`: una orden
  -- es un registro de auditoría que no se borra, y un caso no debería desaparecer porque
  -- alguien intente borrar la orden que lo pidió (aquí nadie puede borrar `ordenes` de
  -- todos modos — la 0083 no da política de `delete`).
  orden_id        uuid references public.ordenes(id),
  -- Lenguaje llano para la consola: «esta semana no tiene retiros ni recortes pendientes
  -- de firma», el motivo de un `rechazado`, etc. NULL mientras no hay nada que contar.
  error           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table public.casos_firma is
  'El ciclo de firma por descarga y subida (2026-09-25): preparando → listo_para_firmar → '
  'firmado → verificado | rechazado | caducado. Lo escribe el equipo de mesa '
  '(service_role) y, en un único paso (listo_para_firmar → firmado), la RPC '
  'registrar_firma tras comprobar que el .sig ya está en Storage. `tipo` es NULL solo '
  'cuando nace rechazado sin nada que firmar (nada de retiros ni recortes esa semana).';

create index if not exists casos_firma_por_usuario_semana
  on public.casos_firma (usuario_id, semana_inicio, creado_en desc);
create index if not exists casos_firma_por_orden
  on public.casos_firma (orden_id);

alter table public.casos_firma enable row level security;

-- Lectura: literal el encargo — «para quien tenga leer_entrenamiento», no también
-- es_coach() ni usuario_id = auth.uid() como en las tablas de la 0083. A propósito: este
-- ciclo es del STAFF (quien prepara y sube la firma), no del asesorado, que no tiene
-- ninguna acción que hacer aquí. Bryan ya tiene `leer_entrenamiento` desde el bloque de
-- capacidades de la 0083 (aplicado antes que esto pueda importar en producción), así que
-- la lectura no queda huérfana esperando un `es_coach()` de respaldo.
create policy casos_firma_leer on public.casos_firma
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

-- Sin política de insert/update/delete para `authenticated`: el ciclo lo escribe
-- service_role (equipo de mesa), salvo el único avance que hace `registrar_firma` más
-- abajo — y esa función corre `security definer`, así que no necesita que authenticated
-- tenga privilegio de UPDATE en la tabla.
--
-- El `revoke insert, update, delete, truncate ... from authenticated` de más abajo no es
-- redundante con la ausencia de políticas: `00-suplantar-supabase.sql` (y, en el proyecto
-- real, los privilegios por defecto de Supabase) conceden `ALL` sobre las tablas nuevas de
-- `public` a `authenticated` en el momento de crearlas, así que sin este `revoke` el
-- privilegio de tabla se queda de sobra — RLS igual bloquearía el efecto (un UPDATE sin
-- política de `update` afecta CERO filas, no lanza), pero un intento se vería como
-- «tuvo permiso y no cambió nada» en vez de lo que es: sin permiso, punto. Mismo patrón
-- que la 0078 con `errores_navegador`.
revoke all on public.casos_firma from anon, public;
revoke insert, update, delete, truncate on public.casos_firma from authenticated;
grant select on public.casos_firma to authenticated;
grant all on public.casos_firma to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · BUCKET `firmas` + políticas de Storage
-- ────────────────────────────────────────────────────────────────────────────
-- PRIVADO: son decisiones clínicas (retiro/recorte) de una persona concreta, mismo motivo
-- que `medios-app` (0061) es privado por la cara. Rutas del contrato:
--   casos/<usuario_id>/<semana_inicio>/<caso_id>.json      -- la decisión SIN firmar
--   casos/<usuario_id>/<semana_inicio>/<caso_id>.json.sig  -- la firma

insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false)
on conflict (id) do nothing;

-- Leer: cualquier archivo del bucket (el `.json` para descargar el caso, y de paso el
-- propio `.sig` si algún día hiciera falta releerlo) con la capacidad leer_entrenamiento.
-- Sin distinguir por carpeta: a diferencia de `medios-app` (0065/0068, cada quien su
-- video), aquí TODO el bucket es del staff — no hay una carpeta "de cada quien" que un
-- asesorado pudiera reclamar como propia.
drop policy if exists "firmas: lee quien tiene leer_entrenamiento" on storage.objects;
create policy "firmas: lee quien tiene leer_entrenamiento"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'firmas'
    and (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Subir: SOLO nombres que terminen en `.sig`. Un intento de subir `algo.json` (o
-- cualquier otra cosa) desde el navegador no tiene política que lo autorice y RLS lo
-- deniega antes de mirar nada más — el `.json` sin firmar solo lo sube el equipo de mesa,
-- con service_role, que se salta RLS.
drop policy if exists "firmas: sube solo la firma .sig" on storage.objects;
create policy "firmas: sube solo la firma .sig"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'firmas'
    and name like '%.sig'
    and (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin política de update ni delete, en ninguna carpeta y para ningún rol autenticado: es
-- lo que hace cierto "sin reemplazar nada" del encargo. Un `upload(..., { upsert: true })`
-- sobre un `.sig` que ya existe necesita privilegio de UPDATE además de INSERT — al no
-- haberlo, el segundo intento falla, suba lo que suba el cliente.

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · RPC registrar_firma(caso_id uuid)
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.registrar_firma(caso_id uuid)
returns public.casos_firma
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  quien     uuid := auth.uid();
  fila      public.casos_firma%rowtype;
  ruta_sig  text;
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('leer_entrenamiento') then
    raise exception 'No tienes permiso para registrar esta firma' using errcode = '42501';
  end if;

  select c.* into fila from public.casos_firma c where c.id = caso_id for update;
  if not found then
    raise exception 'El caso no existe' using errcode = 'P0002';
  end if;

  if fila.estado <> 'listo_para_firmar' then
    raise exception 'El caso no está listo para firmar (estado actual: %)', fila.estado
      using errcode = '22023';
  end if;

  if fila.ruta_decision is null then
    raise exception 'El caso no tiene una decisión asociada' using errcode = '22023';
  end if;

  ruta_sig := fila.ruta_decision || '.sig';

  -- No verifica la firma en sí (eso lo hace el equipo de mesa, fuera de la base, con la
  -- clave de firma de GitHub) — solo comprueba que el archivo ya llegó a Storage. Sin
  -- esto, un clic en "Confirmar" antes de terminar de subir dejaría el caso en `firmado`
  -- sin que exista firma alguna que verificar.
  if not exists (select 1 from storage.objects where bucket_id = 'firmas' and name = ruta_sig) then
    raise exception 'No se encontró la firma (.sig) subida para este caso' using errcode = 'P0002';
  end if;

  update public.casos_firma
     set estado = 'firmado',
         ruta_firma = ruta_sig,
         actualizado_en = now()
   where id = caso_id
  returning * into fila;

  return fila;
end;
$$;

revoke all on function public.registrar_firma(uuid) from public, anon;
grant execute on function public.registrar_firma(uuid) to authenticated, service_role;

comment on function public.registrar_firma(uuid) is
  'Pasa un caso de listo_para_firmar a firmado tras comprobar que el .sig ya está en '
  'Storage. El actor sale de auth.uid(); no verifica la firma, eso es del equipo de mesa.';

commit;
