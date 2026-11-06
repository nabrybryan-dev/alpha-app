-- 0164 · Un asesorado solo puede escribirle al equipo, no a otro asesorado.
--
-- POR QUÉ. Desde la 0001, la regla para enviar mensajes solo exigía que quien
-- escribe fuera quien dice ser (`de_id = auth.uid()`); el destinatario podía ser
-- cualquiera. La app siempre manda al coach o a la nutricionista, pero una cuenta
-- de asesorado, fuera de la app, podía escribirle a otro asesorado. Lo encontró
-- el revisor ciego 2 de la pantalla de derechos (6-nov-2026, MEDIO-4).
--
-- QUÉ CAMBIA. Para enviar: quien escribe es quien dice ser Y (es del equipo o le
-- escribe a alguien del equipo). El equipo sigue pudiendo escribirle a cualquiera.
-- Nada más cambia: leer, marcar leído y firmar borradores quedan como estaban.
--
-- «Del equipo» es lo mismo que ya usa `es_staff()` (0106): rol coach o
-- nutricionista, o la capacidad puesto_de_coach. Hace falta una versión que mire
-- a OTRA persona (el destinatario), porque `es_staff()` solo mira a quien llama.
--
-- NO APLICADA. Escrita el 6-nov-2026 por orden de Bryan («escribo las dos
-- migraciones, sin aplicarlas»). La aplica Bryan con orden escrita.

create or replace function public.es_staff_id(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = p_usuario and rol in ('coach', 'nutricionista')
  ) or exists (
    select 1 from public.capacidades_staff
    where usuario_id = p_usuario and capacidad = 'puesto_de_coach'
  );
$$;

revoke all on function public.es_staff_id(uuid) from public, anon;
grant execute on function public.es_staff_id(uuid) to authenticated, service_role;

comment on function public.es_staff_id(uuid) is
  '0164: true si esa persona es del equipo (coach, nutricionista o puesto_de_coach). Para la regla de envío de mensajes.';

alter policy mensajes_enviar on public.mensajes
  with check (
    de_id = (select auth.uid())
    and ((select public.es_staff()) or public.es_staff_id(para_id))
  );

-- DESHACER (si algo del chat deja de funcionar):
--   alter policy mensajes_enviar on public.mensajes with check (de_id = (select auth.uid()));
--   drop function if exists public.es_staff_id(uuid);
