/**
 * Las tipografías de las tragaperras, cargadas solo cuando hacen falta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO VAN EN LA HOJA DE ESTILOS
 * ─────────────────────────────────────────────────────────────────────────────
 * Vivían en un `@import` dentro de `tokens.css`. Medido el 2026-08-16: **314 KB
 * en 19 archivos**, y lo caro no era el peso sino el sitio. Un `@import` dentro
 * de una hoja ya descargada encadena tres viajes antes del primer pintado —hoja
 * → CSS de Google → archivos de fuente— y bloquea el render de TODAS las
 * pantallas. También la de nutrición, donde no hay ninguna máquina.
 *
 * Esta app se usa de pie en un gimnasio con la conexión que haya. Segundos de
 * pantalla en blanco a cambio de la tipografía de un adorno es un mal cambio.
 *
 * Ahora la petición sale cuando monta la primera máquina, no bloquea nada y
 * llega mientras el gabinete ya se está pintando. Con `display=swap` el texto
 * se ve desde el primer fotograma en la fuente de sistema y salta a la buena
 * cuando llega: se pierde el efecto durante un instante, no el dato.
 *
 * Nadie se descarga esto por abrir la app. Solo quien entrena.
 */

const ID = 'fuentes-del-gabinete'

const HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Playfair+Display:ital,wght@0,900;1,700' +
  '&family=Alfa+Slab+One' +
  '&family=Anton' +
  '&family=Cinzel:wght@600;900' +
  '&family=Bungee' +
  '&display=swap'

/**
 * Idempotente: la llaman todas las máquinas de la sesión y solo la primera
 * inyecta. Sin esto, cinco ejercicios pedirían cinco veces lo mismo.
 */
export function cargarFuentesDelGabinete(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(ID)) return

  const link = document.createElement('link')
  link.id = ID
  link.rel = 'stylesheet'
  link.href = HREF
  // Si Google no responde, la máquina se queda con la fuente de sistema y no
  // pasa nada más: no hay pantalla rota ni error en consola.
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}
