import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Un emoji no puede volver a hacer de icono.
 *
 * EL HUECO QUE CIERRA (2026-08-19). Media docena de pantallas pintaban un emoji
 * donde va un icono: la claqueta de Contenidos repetida en las diez filas, la
 * campana del recordatorio, la regla de «Mis medidas», ♥/🏋/🍽 en las rachas,
 * 🏅/🔒 en las medallas, ⭐ en los premios, ❓/💬 en el panel del coach.
 *
 * No es cosmético. Un emoji lo dibuja el sistema operativo, no la app: el mismo
 * carácter es distinto en Android, iOS y Windows, y no acepta `currentColor`. En
 * Logros se veía sin buscarlo — ♥ salía monocromo y 🏋 a todo color, uno al lado
 * del otro, en tarjetas idénticas.
 *
 * ESTE TEST NO PROHÍBE NADA. Obliga a escribir el motivo aquí, igual que
 * `codigo-huerfano.test.ts`. Si un archivo necesita un emoji, se añade con su
 * porqué y el test pasa.
 *
 * LA LÍNEA QUE SE TRAZÓ: un emoji que ABRE una etiqueta hace de icono y va
 * fuera; un emoji que CIERRA una frase es la voz del entrenador y se queda.
 * «¡Bien hecho! 💪» no es iconografía, es calidez, y cambiarlo por un SVG haría
 * que el mensaje dejara de sonar a persona.
 */

const raiz = join(__dirname, '..')

/**
 * Marcas tipográficas, no emojis: son monocromas, aceptan `currentColor` y se
 * dibujan igual en todos los sistemas. La app las usa como texto desde siempre.
 */
const MARCAS_TIPOGRAFICAS = new Set(['✓', '✔', '✕', '✖', '✗', '✘', '◦', '○', '●', '★', '☆'])

/**
 * Archivos que pueden llevar emoji, con el porqué.
 *
 * Si añades una entrada, escribe un motivo de verdad. «Queda bonito» no es un
 * motivo; «es la voz del coach al terminar la sesión» sí.
 */
const EMOJI_PERMITIDO: Record<string, string> = {
  'features/entrenar/frasesMotivacionales.ts':
    'Las frases que celebran una serie registrada. Son la voz del entrenador, no iconos.',
  'features/entrenar/reflexionSesion.ts':
    'El cierre que lee el asesorado al terminar la sesión, escrito como se lo diría su coach.',
  'features/entrenar/DescansoTimer.tsx':
    '«¡DALE, VAMOS! 🔥» al acabar el descanso. Es un grito de ánimo, y el emoji va al final.',
  'features/hoy/HoyPage.tsx':
    '«Microciclo completo 💪» celebra el cierre de la semana. Emoji al final de la frase.',
  'features/logros/LogrosPage.tsx':
    'El consuelo cuando se rompe una racha. Termina en 🔥 a propósito: es tono, no icono.',
  'features/logros/RankingEquipo.tsx':
    '«… del podio 💪» en el ranking del equipo. Cierra la frase.',
  'features/nutricion/AdherenciaDia.tsx':
    '«Racha: N 🔥» en el diario de adherencia. Cierra la frase.',
  'features/bienestar/recordatorio.ts':
    'Cuerpo de la notificación push. Lo pinta el sistema operativo de todas formas.',
  'features/coach/AsesoradoDetallePage.tsx':
    '«Generar microciclo ⚡» en el botón del coach. Remate de la frase, no icono de la acción.',
  'data/seed/mensajes.ts':
    'Mensajes de ejemplo del coach en el modo demo. Es copia, no interfaz.',
}

/** Pictograma a color: lo dibuja el sistema, no la app. */
function esEmoji(caracter: string): boolean {
  const punto = caracter.codePointAt(0) ?? 0
  const enRango =
    (punto >= 0x1f300 && punto <= 0x1faff) ||
    (punto >= 0x2600 && punto <= 0x27bf) ||
    (punto >= 0x2b00 && punto <= 0x2bff)
  return enRango && !MARCAS_TIPOGRAFICAS.has(caracter)
}

/** Las líneas de comentario no se pintan: ahí un emoji es prosa para quien lee el código. */
function esComentario(linea: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(linea)
}

function fuentesQueSePintan(dir: string, encontrados: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      fuentesQueSePintan(ruta, encontrados)
    } else if (/\.tsx?$/.test(entrada) && !entrada.includes('.test.')) {
      encontrados.push(ruta)
    }
  }
  return encontrados
}

function emojisDe(ruta: string): string[] {
  const hallados = new Set<string>()
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    if (esComentario(linea)) continue
    for (const caracter of linea) {
      if (esEmoji(caracter)) hallados.add(caracter)
    }
  }
  return [...hallados]
}

describe('emojis como iconos', () => {
  const carpetas = ['features', 'components', 'data/seed'].map((c) => join(raiz, c))
  const archivos = carpetas.flatMap((c) => fuentesQueSePintan(c))

  it('encuentra las pantallas, por si alguien mueve las carpetas', () => {
    expect(archivos.length).toBeGreaterThan(60)
  })

  it('ningún archivo pinta emojis sin tener escrito el motivo', () => {
    const sinMotivo = archivos
      .map((ruta) => ({ ruta, emojis: emojisDe(ruta) }))
      .filter(({ emojis }) => emojis.length > 0)
      .map(({ ruta, emojis }) => ({
        clave: ruta.slice(raiz.length + 1).replace(/\\/g, '/'),
        emojis: emojis.join(' '),
      }))
      .filter(({ clave }) => EMOJI_PERMITIDO[clave] === undefined)

    expect(
      sinMotivo,
      'Un emoji que abre una etiqueta hace de icono: usa `components/ui/Icono.tsx`. ' +
        'Si de verdad es voz y va al final de una frase, añádelo a EMOJI_PERMITIDO con su motivo.',
    ).toEqual([])
  })

  it('la lista de permitidos no acumula entradas muertas', () => {
    // Si un archivo deja de tener emojis, su entrada sobra: que no se quede el
    // motivo de algo que ya no existe.
    const conEmoji = new Set(
      archivos
        .filter((ruta) => emojisDe(ruta).length > 0)
        .map((ruta) => ruta.slice(raiz.length + 1).replace(/\\/g, '/')),
    )
    const sobran = Object.keys(EMOJI_PERMITIDO).filter((clave) => !conEmoji.has(clave))

    expect(sobran, 'estas entradas ya no tienen emoji: quítalas de EMOJI_PERMITIDO').toEqual([])
  })

  it('cada motivo dice algo, no es un hueco', () => {
    for (const [clave, motivo] of Object.entries(EMOJI_PERMITIDO)) {
      expect(motivo.length, `${clave}: el motivo es demasiado corto`).toBeGreaterThan(40)
      expect(motivo.toLowerCase(), `${clave}: «pendiente» no es un motivo`).not.toMatch(
        /^(pendiente|todo|por hacer|temporal)/,
      )
    }
  })
})
