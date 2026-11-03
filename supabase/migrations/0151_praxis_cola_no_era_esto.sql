-- ============================================================================
-- 0151 · Praxis: «No era esto» entra en la cola de dudas del equipo
-- ============================================================================
--
-- APLICADA el 30-oct-2026, con el OK de Bryan. Si faltara, nada se rompe: el panel dice que no pudo
-- anotarlo. Comprobarla con su fila en `comprobar-migraciones.sql`.
--
-- QUÉ PEDIDO RESUELVE. La cola solo recibía lo que el portero no resolvió (`arriba`, `aclarar`). Si contesta
-- con seguridad una ficha equivocada, la frase nunca llega a nadie. Con «No era esto», la persona del equipo
-- deja esa frase con `origen = 'no_era_esto'` y la ficha mostrada en `portero_fichas`.
--
-- El juez no corre aquí: `ficha_juez` queda en null y el taller descarta esas filas. Las revisa una persona.
-- Las políticas de la 0117 no cambian: solo el equipo inserta y lee. De los asesorados no se guarda nada.
-- ============================================================================

begin;

alter table public.praxis_cola_dudas drop constraint if exists praxis_cola_dudas_origen_check;
alter table public.praxis_cola_dudas add constraint praxis_cola_dudas_origen_check
  check (origen in ('arriba', 'aclarar', 'no_era_esto'));

commit;
