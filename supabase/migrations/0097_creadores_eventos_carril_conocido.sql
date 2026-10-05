-- ============================================================================
-- 0097 · creadores_eventos: solo carriles conocidos
-- ============================================================================
--
-- HALLAZGO (verificación externa, 28-sep-2026, gravedad media): `creadores_eventos`
-- (migración 0090) aceptaba cualquier texto en `carril_nuevo` y `carril_anterior`, mientras
-- `creadores_candidatos.carril` sí lo limita. La app (`embudo.ts`) descartaba en silencio
-- los eventos con un carril que no conoce, así que «contactos registrados» podía quedar por
-- debajo de la realidad sin que nadie lo notara.
--
-- ARREGLO: dos checks con LA MISMA lista que `creadores_candidatos.carril` (0090), uno por
-- columna; `carril_anterior` admite null (el primer evento de un creador no tiene anterior).
--
-- `NOT VALID`, A PROPÓSITO. Comprueba SOLO las filas nuevas o modificadas y no revisa las que
-- ya existen: así la migración no falla en producción si alguna fila vieja tuviera un carril
-- inventado (no se ha comprobado que no la haya: se corre a mano, sin registro de versiones).
-- CÓMO VALIDARLO DESPUÉS, cuando se sepa que está limpio:
--   1. Buscar los que violarían:
--        select event_id, carril_anterior, carril_nuevo from public.creadores_eventos
--         where carril_nuevo not in (<la lista de abajo>)
--            or (carril_anterior is not null and carril_anterior not in (<la lista de abajo>));
--   2. Si salen filas, corregirlas (o borrarlas con service_role, sabiendo que son historia).
--   3. Con cero filas:
--        alter table public.creadores_eventos validate constraint creadores_eventos_carril_nuevo_conocido;
--        alter table public.creadores_eventos validate constraint creadores_eventos_carril_anterior_conocido;
--   Un check `NOT VALID` ya protege lo que se escriba desde hoy; `validate` solo confirma el pasado.
-- ============================================================================

begin;

alter table public.creadores_eventos
  drop constraint if exists creadores_eventos_carril_nuevo_conocido;
alter table public.creadores_eventos
  add constraint creadores_eventos_carril_nuevo_conocido
  check (carril_nuevo in (
    'descubierto', 'etapa1', 'etapa2', 'tambaleando',
    'aprobado_contacto', 'mensaje_enviado', 'respondio', 'no_respondio',
    'encuesta', 'microprueba', 'piloto', 'continua', 'pausa',
    'descartado', 'entrenador'))
  not valid;

alter table public.creadores_eventos
  drop constraint if exists creadores_eventos_carril_anterior_conocido;
alter table public.creadores_eventos
  add constraint creadores_eventos_carril_anterior_conocido
  check (carril_anterior is null or carril_anterior in (
    'descubierto', 'etapa1', 'etapa2', 'tambaleando',
    'aprobado_contacto', 'mensaje_enviado', 'respondio', 'no_respondio',
    'encuesta', 'microprueba', 'piloto', 'continua', 'pausa',
    'descartado', 'entrenador'))
  not valid;

commit;
