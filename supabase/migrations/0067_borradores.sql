-- App Alpha Athletics · Migración 0067 · Borradores que esperan firma
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- ============================================================================
-- QUÉ ES ESTO
-- ============================================================================
--
-- Desde el 2026-09-10 el domingo salen veintitrés vídeos, uno por persona, con
-- la cara y la voz clonadas de Bryan diciendo sus números. Antes de salir pasan
-- por la bandeja de quien firma: el coach la suya, la nutricionista la suya.
--
-- Un borrador es un mensaje que TODAVÍA NO ES un mensaje. Vive en `mensajes`
-- —para no duplicar el hilo, los adjuntos ni el orden— y se distingue por su
-- `origen`, que pasa de dos valores a cuatro:
--
--     humano · alpha · borrador-coach · borrador-nutri
--
-- ============================================================================
-- EL AGUJERO QUE ESTO CIERRA, Y QUE NO ESTABA EN EL ENCARGO
-- ============================================================================
--
-- La política de lectura de `mensajes` dice, desde la 0001:
--
--     using (de_id = auth.uid() or para_id = auth.uid())
--
-- Es decir: **el destinatario ve la fila en cuanto existe**. Si un borrador se
-- escribe ahí tal cual, el asesorado lo ve ANTES de que nadie lo haya firmado
-- —y con vídeo de por medio, vería y oiría a Bryan diciéndole cosas que Bryan
-- todavía no ha aprobado que se digan—. No haría falta ningún fallo: bastaría
-- con guardar el borrador.
--
-- Por eso aquí no se añade solo un valor a una restricción: se REESCRIBE la
-- política de lectura para que un borrador solo lo vea quien lo tiene que
-- firmar. El día que el borrador se aprueba, su `origen` pasa a `humano` y la
-- misma política lo deja ver: no hay que mover la fila de sitio.

-- ── 1 · El origen pasa de dos valores a cuatro ──────────────────────────────

alter table public.mensajes
  drop constraint if exists mensajes_origen_valido;

alter table public.mensajes
  add constraint mensajes_origen_valido
  check (origen in ('humano', 'alpha', 'borrador-coach', 'borrador-nutri'));

-- ── 2 · Quién firma cada borrador ───────────────────────────────────────────
--
-- `es_coach()` ya existía; la nutricionista no tenía la suya —solo `es_staff()`,
-- que las junta a las dos, y juntarlas aquí sería justo lo que no se quiere: con
-- `es_staff()`, Manuela podría firmar los borradores del coach.

create or replace function public.es_nutricionista()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = auth.uid() and rol = 'nutricionista'
  );
$$;

-- Si este borrador es MÍO de firmar. Un `origen` que no sea de borrador no entra
-- por aquí: esta función responde solo por la bandeja.
create or replace function public.firmo_yo(p_origen text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case p_origen
           when 'borrador-coach' then public.es_coach()
           when 'borrador-nutri' then public.es_nutricionista()
           else false
         end;
$$;

-- ── 3 · Un borrador NO lo ve su destinatario ────────────────────────────────

drop policy if exists mensajes_leer on public.mensajes;
create policy mensajes_leer on public.mensajes
  for select using (
    -- Quien lo escribió lo ve siempre: es su hilo.
    de_id = auth.uid()
    -- El destinatario lo ve cuando YA NO es un borrador.
    or (para_id = auth.uid() and origen not like 'borrador-%')
    -- Y quien firma ve los suyos, aunque no sea ni emisor ni destinatario.
    or public.firmo_yo(origen)
  );

-- ── 4 · Cada firmante toca SOLO sus borradores ──────────────────────────────
--
-- La de siempre (`mensajes_marcar_leido`) se queda como está: es del
-- destinatario y solo marca leído. Esta es otra, y la de verdad importante:
-- corregir o aprobar un borrador. Manuela editando uno del coach tiene que
-- afectar CERO filas — no dar error, afectar cero, que es como se comporta RLS.
--
-- El `with check` repite la condición a propósito: sin él se podría cambiar el
-- `origen` de un borrador propio a `borrador-coach` y dejarlo ahí. Con él, la
-- fila resultante también tiene que seguir siendo de quien la toca... salvo
-- cuando se aprueba, que es el caso de abajo.

drop policy if exists mensajes_firmar_borrador on public.mensajes;
create policy mensajes_firmar_borrador on public.mensajes
  for update
  using (public.firmo_yo(origen))
  -- Al aprobar, el borrador se convierte en mensaje (`humano`), y esa fila ya no
  -- la firma nadie. Por eso el check admite los dos estados: seguir siendo mi
  -- borrador, o haber pasado a ser un mensaje de verdad.
  with check (public.firmo_yo(origen) or origen = 'humano');

-- ============================================================================
-- COMPROBACIÓN
-- ============================================================================
-- En `supabase/comprobar-0067.sql`. Las tres que importan:
--   · un origen inventado lo rechaza la base;
--   · el destinatario NO ve un borrador dirigido a él;
--   · la nutricionista tocando un borrador del coach afecta 0 filas.
