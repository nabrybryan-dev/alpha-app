-- XXXX · La firma AUTOMÁTICA de la revisión semanal (decisión de Bryan, 21-oct-2026).
--
-- BORRADOR SIN NÚMERO A PROPÓSITO. El número lo elige Bryan (CLAUDE.md §3: «mira la carpeta
-- antes de elegir número»). Al darle número hay que renombrar este archivo y el que lo lee,
-- `pruebas-sql/aprobacion-automatica.mjs` (constante MIGRACION). NO se aplica sola: las
-- migraciones se pegan a mano en el SQL Editor, y esta además NO sirve de nada hasta que se
-- encienda la bandera del puente (ver abajo).
--
-- QUÉ DECIDIÓ BRYAN. Los mensajes semanales con su voz clonada salen SOLOS, sin su aprobación
-- («Solos, sin freno», con el riesgo explicado). Hoy la firma es un acto humano en tres sitios:
-- el trigger deja `aprobado_en` en null al publicar (0081), `decidir_revision_semanal` exige
-- coach (0081) y las dos políticas RLS de la 0068 esconden lo no firmado. Medido el 22-oct:
-- 32 audios publicados (semanas del 28-sep y 5-oct), 0 firmados; nadie ha oído uno.
--
-- QUÉ HACE ESTA MIGRACIÓN, Y QUÉ NO.
--   · NO relaja ninguna política RLS. La 0068 sigue pidiendo `aprobado_en is not null`; lo que
--     cambia es QUIÉN lo escribe. La persona sigue sin ver nada que no esté firmado.
--   · Añade `aprobacion` ('coach' | 'automatica') para que una firma automática se distinga de
--     las 59 antiguas (todas con `aprobado_por` nulo: firmadas a mano con la clave de servicio).
--     Las antiguas se marcan 'coach': las hizo Bryan.
--   · `firmar_revisiones_automaticas(semana, usuarios)`: SOLO el proceso de servicio, SOLO a los
--     que el agente de mensajes marcó «publicar», y nunca una fila ya firmada, con corrección
--     pedida, sin guion, con ruta histórica o sin archivo en el almacén.
--   · EL INTERRUPTOR: una orden `detener` vigente para esa persona frena la firma. «Vigente» =
--     la orden MÁS RECIENTE entre `detener` y `reanudar` (misma regla que la consola:
--     AccionesRevision.tsx y tuberia/verificar_carga.py). La consola apunta `detener` a la
--     semana que SE VA A CARGAR (el lunes siguiente, no la que termina), así que se mira la
--     semana de la revisión Y la siguiente: quien está detenido para la próxima semana no
--     recibe un mensaje automático con la voz del coach.
--   · El trigger `versionar_revision_semanal` se reemplaza (mismo cuerpo que la 0081 más la
--     marca): al retirar la firma retira la marca; una firma que nadie marcó (p. ej. a mano en
--     el SQL Editor) queda como 'coach'. No se necesita tocar `decidir_revision_semanal`.
--
-- QUIÉN LA LLAMA. Un paso nuevo del puente (`revision-semanal.mjs --paso firmar`) detrás de una
-- bandera APAGADA por defecto (`%USERPROFILE%\.alpha\firma-automatica.activa`, o -FirmaAutomatica
-- en el .ps1). Mientras la bandera esté apagada esta función existe y no la llama nadie.
--
-- NO COMPROBADO EN VIVO: probada en PGlite (`pruebas-sql/aprobacion-automatica.mjs`), no contra
-- la base real. La forma de `ordenes.objetivo` (usuario_id + semana_inicio) sale de
-- AccionesRevision.test.tsx:95 y de orquestador/ejecucion_determinista.py:1515-1530 en
-- cerebro-alpha-agentes, no de una orden real.

begin;

-- 1 · La marca. Sin firma no hay marca; con firma, dice cómo se dio.
alter table public.videos_semanales
  add column if not exists aprobacion text;

alter table public.videos_semanales
  drop constraint if exists videos_semanales_aprobacion_check;
alter table public.videos_semanales
  add constraint videos_semanales_aprobacion_check
  check (aprobacion in ('coach', 'automatica'));

comment on column public.videos_semanales.aprobacion is
  'Cómo se firmó: coach (a mano, bandeja o consola) o automatica (firmar_revisiones_automaticas). NULL = sin firmar. Las firmas anteriores a esta migración se marcaron coach.';

-- 2 · El trigger de la 0081, con la marca. Mismo comportamiento que antes; lo nuevo está
--     marcado con «aprobacion».
create or replace function public.versionar_revision_semanal()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
    new.aprobacion := null;
  elsif row(new.path, new.guion, new.tipo, new.publicado_en)
      is distinct from row(old.path, old.guion, old.tipo, old.publicado_en) then
    new.version := old.version + 1;
    new.aprobado_en := null;
    new.aprobado_por := null;
    new.aprobacion := null;
    new.correccion_solicitada := null;
  else
    new.version := old.version;
    -- La marca acompaña a la firma: sin firma no hay marca, y una firma que nadie marcó la
    -- hizo una persona (la automática SIEMPRE se marca a sí misma).
    if new.aprobado_en is null then
      new.aprobacion := null;
    elsif new.aprobacion is null then
      new.aprobacion := 'coach';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.versionar_revision_semanal() from public, anon, authenticated;

-- 3 · Las firmas que ya existen las hizo Bryan. (El UPDATE pasa por el trigger de arriba: no
--     cambia path/guion/tipo/publicado_en, así que no sube versiones ni retira firmas.)
update public.videos_semanales
   set aprobacion = 'coach'
 where aprobado_en is not null and aprobacion is null;

-- 4 · La firma automática.
create or replace function public.firmar_revisiones_automaticas(p_semana date, p_usuarios uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  rol text;
begin
  -- Solo el proceso de servicio. Se leen las dos formas en que PostgREST publica el rol del
  -- JWT (la suelta, que usa la 0095:271, y el JSON), y si ninguna dice 'service_role' se
  -- niega: ante la duda, no firma. El REVOKE de abajo es la primera puerta; esta, la segunda.
  rol := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  if rol <> 'service_role' then
    raise exception 'Solo el proceso de servicio' using errcode = '42501';
  end if;

  if p_semana is null or p_usuarios is null or coalesce(array_length(p_usuarios, 1), 0) = 0 then
    return 0;
  end if;

  with firmadas as (
    update public.videos_semanales v
       set aprobado_en = now(), aprobacion = 'automatica'
     where v.semana = p_semana
       and v.usuario_id = any (p_usuarios)            -- solo los que el agente marcó «publicar»
       and v.aprobado_en is null                      -- nunca pisa una firma
       and v.correccion_solicitada is null
       and nullif(trim(v.guion), '') is not null
       and v.path ~ '^personas/[^/]+/[0-9-]+/[0-9a-f-]{36}\.[a-z0-9]+$'
       and exists (select 1 from storage.objects o
                    where o.bucket_id = 'medios-app' and o.name = v.path)
       -- El interruptor. Por cada semana que mira (la de la revisión y la siguiente) manda la
       -- orden MÁS RECIENTE entre detener y reanudar; si esa es un detener, no se firma.
       and not exists (
         select 1
           from (select distinct on (left(r.objetivo->>'semana_inicio', 10)) r.tipo
                   from public.ordenes r
                  where r.tipo in ('detener', 'reanudar')
                    and r.objetivo->>'usuario_id' = v.usuario_id::text
                    and left(r.objetivo->>'semana_inicio', 10) in (v.semana::text, (v.semana + 7)::text)
                  order by left(r.objetivo->>'semana_inicio', 10), r.creada_en desc) ultima
          where ultima.tipo = 'detener')
    returning 1)
  select count(*) into n from firmadas;
  return n;
end;
$$;

-- Ni `public` ni `anon` ni `authenticated`: una función security definer que escribe firmas
-- expuesta como RPC es justo el agujero que documenta CLAUDE.md §3 (funciones `tmp_`).
revoke all on function public.firmar_revisiones_automaticas(date, uuid[]) from public, anon, authenticated;
grant execute on function public.firmar_revisiones_automaticas(date, uuid[]) to service_role;

comment on function public.firmar_revisiones_automaticas(date, uuid[]) is
  'Firma como automatica las revisiones semanales de p_usuarios en p_semana. Solo service_role. No pisa firmas, ni correcciones pedidas, ni filas sin guion/archivo, ni personas con una orden detener vigente (semana de la revision o la siguiente). Devuelve cuantas firmó.';

commit;
