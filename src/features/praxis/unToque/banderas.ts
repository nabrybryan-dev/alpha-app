/**
 * «Praxis a un toque»: el botón de Praxis abre, con UN toque, una capa sobre la pantalla donde estés
 * (diseño: `docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md`; maqueta y frases aprobadas
 * del 11-nov-2026).
 *
 * APAGADA: la app queda EXACTAMENTE como hoy. El botón de Praxis de la barra del equipo sigue siendo el
 * enlace a `/praxis` y no se monta ninguna capa. `banderas.apagadas.test.tsx` compara el HTML de la barra
 * con el que tenía `main` antes de este cambio.
 *
 * ENCENDIDA (solo en local, con un cambio de código y su PR): el botón de Praxis del equipo deja de navegar y
 * abre/cierra la capa. La capa solo se monta para quien `puedeVerPraxis` deja entrar; mientras
 * `PRAXIS_ABIERTA_A_ASESORADOS` siga en `false`, solo el equipo. Cambiarla no abre Praxis a asesorados.
 */
export const PRAXIS_UN_TOQUE_ACTIVO = false

/**
 * La charla con modelo (preguntas de conocimiento). APAGADA, y aun encendida este PR NO llama a ningún modelo:
 * solo deja un punto de enganche vacío (`engancheDeCharla.ts`) para la función `praxis-charla` (PR #479 y #480,
 * en borrador). Solo tiene efecto si `PRAXIS_UN_TOQUE_ACTIVO` también está encendida.
 */
export const PRAXIS_UN_TOQUE_CHARLA = false
