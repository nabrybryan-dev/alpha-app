-- ============================================================================
-- 0100 · Las vistas `mis_comentarios` (0095) y `decisiones_con_estado` (0094) pasan a
--        security_invoker = on
-- ============================================================================
--
-- El advisor de Supabase marca como ERROR «Security Definer View» las dos vistas: corren con
-- los privilegios de su dueño y se saltan la RLS de las tablas base. Aquí pasan a
-- `security_invoker = on` SIN cambiar lo que devuelve cada rol.
--
-- decisiones_con_estado
--   · La vista solo filtraba con `es_coach() or tiene_capacidad('decisiones_compartidas')`,
--     que es EXACTAMENTE la política `decisiones_leer` de la tabla. Con invoker la tabla ya
--     filtra igual: mismas filas para Bryan, Manuela, un staff sin la capacidad (cero) y un
--     asesorado (cero). anon no tiene privilegio (sigue fallando).
--   · Los nombres (`decidido_por_nombre`, `firma_de_nombre`) salen de `usuarios_app`, cuya
--     política `usuarios_leer` (0006/0045) deja a todo el staff leer a todos y a cualquiera
--     leer a coach/nutricionista, que son las únicas personas que deciden o firman. No cambia.
--   · Se conserva el `where` de la vista como segundo cinturón (no cuesta nada).
--
-- mis_comentarios
--   · Aquí SÍ había pérdida: la tabla `comentarios_app` solo la leen el coach y quien tría
--     (`comentarios_app_leer_equipo`). Con invoker a secas, el asesorado perdería sus propias
--     filas. Dos salidas: (a) una política «leer lo propio» sobre la tabla, o (b) mantener la
--     tabla cerrada y leer lo propio por una función. Se elige (b): (a) dejaría al asesorado
--     leer la tabla directa con los campos internos del triaje (`contrato_id`, `triado_por`,
--     `texto_saneado`, `cerrado_por`…), justo lo que la 0095 quiso esconder y que su prueba
--     (130) exige (cero filas en la tabla directa, sin `contrato_id` en la vista).
--   · `mis_comentarios_datos()` es `security definer` con `search_path` fijo, filtra por
--     `auth.uid()` y devuelve SOLO las seis columnas públicas. La vista (invoker) la envuelve
--     con las mismas columnas y tipos de antes, así el front (`VISTA_MIS_COMENTARIOS`) no
--     cambia. La función queda sin execute para public y anon.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · decisiones_con_estado: misma definición, ahora con los permisos de quien llama
-- ────────────────────────────────────────────────────────────────────────────
alter view public.decisiones_con_estado set (security_invoker = on);

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · mis_comentarios: la función entrega lo propio; la vista la envuelve
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.mis_comentarios_datos()
returns table (
  id        bigint,
  creado_en timestamptz,
  tipo      text,
  pantalla  text,
  texto     text,
  estado    text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.creado_en, c.tipo, c.pantalla, c.texto, c.estado
    from public.comentarios_app c
   where c.usuario_id = auth.uid();
$$;

revoke all on function public.mis_comentarios_datos() from public, anon;
grant execute on function public.mis_comentarios_datos() to authenticated, service_role;

comment on function public.mis_comentarios_datos() is
  'Lo propio de cada quien en comentarios_app, sin campos internos del triaje (0100). '
  'security definer + search_path fijo; filtra por auth.uid(). La envuelve mis_comentarios.';

create or replace view public.mis_comentarios
  with (security_invoker = on) as
select f.id, f.creado_en, f.tipo, f.pantalla, f.texto, f.estado
  from public.mis_comentarios_datos() f;

revoke all on public.mis_comentarios from anon, authenticated, public;
grant select on public.mis_comentarios to authenticated;
grant all on public.mis_comentarios to service_role;

commit;
