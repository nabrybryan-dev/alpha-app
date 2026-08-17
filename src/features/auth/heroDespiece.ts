/**
 * El loop de la pantalla de entrada — dirección «Despiece».
 *
 * Un solo sitio para las tres rutas, porque las usan Splash y LoginPage y no
 * pueden divergir: si el póster del Splash y el del Login no son el mismo
 * fotograma, la transición entre las dos pantallas da un salto.
 *
 * ── Estado: el vídeo todavía no existe ──
 *
 * `despiece.webm` y `despiece.mp4` aún no están en `public/hero/`. Eso NO rompe
 * nada y es a propósito: `FondoVideo` pinta el póster como fondo del contenedor,
 * así que mientras las fuentes fallen se ve exactamente la imagen fija. El día
 * que los archivos se copien a `public/hero/`, la pantalla empieza a moverse
 * sola sin tocar una línea de código.
 *
 * El póster apunta de momento a la foto que el Login ya venía usando
 * (`LoginPage.tsx` la tenía escrita a mano), para no degradar la pantalla
 * mientras tanto. Cuando el paso 3 de la guía produzca el fotograma real,
 * **cambiar solo esta constante** por `/hero/despiece.jpg`.
 *
 * Presupuesto acordado en `docs/specs/2026-08-16-hero-loop-splash-diseno.md`:
 * webm ≤ 900 KB, mp4 ≤ 1,2 MB, jpg ≤ 120 KB.
 */
export const heroDespiece = {
  poster: '/fondos/atleta.jpeg',
  webm: '/hero/despiece.webm',
  mp4: '/hero/despiece.mp4',
} as const
