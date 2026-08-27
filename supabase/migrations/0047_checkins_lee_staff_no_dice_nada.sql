-- `checkins_lee_staff` no concede nada que no estuviera ya concedido.
--
-- Quedó así por acumulación, no por descuido de nadie:
--
--   0006  la creó como `using (public.es_staff())`, para que la nutricionista
--         leyera los check-ins.
--   0013  la acotó a `using (public.es_coach())` -«la nutricionista deja de
--         leer la fila entera»-, que es lo que buscaba esa migración.
--
-- Pero `checkins_todo_propio` es `for all`, y un `for all` cubre también el
-- SELECT. Su condición es `(usuario_id = auth.uid() OR es_coach())`. Desde el
-- momento en que la 0013 dejó a `checkins_lee_staff` en `es_coach()` a secas,
-- lo que concede está enteramente contenido en la otra:
--
--   (usuario_id = uid OR es_coach())  OR  es_coach()  =  (usuario_id = uid OR es_coach())
--
-- Las permisivas se combinan con OR, así que sobra. Y no sale gratis: es una
-- segunda evaluación de `es_coach()` en CADA lectura de `checkins`, que es la
-- tabla más hidratada después de `microciclos`.
--
-- Sus dos hermanas NO son redundantes y por eso no se tocan:
-- `adherencias_lee_staff` e `hidratacion_lee_staff` siguen en `es_staff()`,
-- que incluye a la nutricionista. Eso `*_todo_propio` no lo da, porque solo
-- llega hasta `es_coach()`. Borrarlas dejaría a la nutricionista sin ver la
-- adherencia ni la hidratación.
--
-- ── Por qué esto se comprueba solo ───────────────────────────────────────────
--
-- Soltar una política es de las pocas cosas que pueden abrir o cerrar acceso
-- en silencio, y el razonamiento de arriba depende de dos supuestos sobre el
-- estado real de la base. Si alguno no se cumple, esta migración ABORTA en vez
-- de dejar `checkins` en un estado que nadie revisó.

begin;

do $$
begin
  -- Supuesto 1: `checkins_todo_propio` cubre el SELECT y concede a es_coach().
  -- Si no, borrar la otra le quitaría la lectura al coach.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'checkins'
      and policyname = 'checkins_todo_propio'
      and permissive = 'PERMISSIVE'
      and cmd        = 'ALL'
      and qual like '%es_coach%'
  ) then
    raise exception
      'Abortado: checkins_todo_propio no cubre el SELECT con es_coach(). '
      'Borrar checkins_lee_staff le quitaria la lectura al coach.';
  end if;

  -- Supuesto 2: la que vamos a borrar es PERMISIVA. Si fuera RESTRICTIVE,
  -- borrarla AMPLIARIA el acceso en vez de reducirlo -las restrictivas se
  -- combinan con AND-, que es justo lo contrario de lo que se busca.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'checkins'
      and policyname = 'checkins_lee_staff'
      and permissive <> 'PERMISSIVE'
  ) then
    raise exception
      'Abortado: checkins_lee_staff es RESTRICTIVE. Borrarla ampliaria el '
      'acceso a checkins en vez de reducirlo.';
  end if;
end $$;

drop policy if exists checkins_lee_staff on public.checkins;

commit;

-- ── Comprobación ─────────────────────────────────────────────────────────────
--
-- Debe quedar UNA sola permisiva de lectura en checkins, y ser `todo_propio`:
--
--   select policyname, cmd, permissive, qual
--   from pg_policies
--   where schemaname='public' and tablename='checkins' and cmd in ('SELECT','ALL');
--
-- Y la prueba que de verdad importa, porque el catálogo puede decir lo
-- correcto y el efecto ser otro: entrar como coach y comprobar que sigue
-- viendo los check-ins de sus asesoradas, y entrar como asesorada y comprobar
-- que sigue viendo los suyos y NINGUNO ajeno.
