import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Auditoría de la maqueta «Praxis única» (build-v8, v17) contra `tokens.css`: congela los tokens que HOY son
 * idénticos en los dos temas. No define ni cambia ningún valor de `tokens.css`; solo lo mira.
 *
 * Cómo se leyó: el tema oscuro es la suma de todos los bloques `:root, [data-theme="dark"]` y `:root` de nivel superior;
 * el claro es ese oscuro con encima los bloques `[data-theme="light"]` (así lo resuelve el navegador). Los
 * `var(--x)` se resuelven, los colores se pasan a `rgb(r,g,b)` y se quitan espacios sobrantes, para que
 * `#d9d7d0`, `rgb(217 215 208)` y `rgb(var(--linea-rgb))` se comparen como lo mismo.
 *
 * DIFERENCIAS DELIBERADAS (a propósito NO están en la tabla; NO se congelan aquí, las decide Bryan, pieza A2):
 *   · `--rojo`: la app usa 255 70 70 en oscuro y 192 13 18 en claro; la maqueta usa #ff1e1e y #d51216. En claro
 *     el #ff1e1e daba 3,59 a 1 (no pasa AA); la app lo sube por contraste (ver `contraste-tokens.test.ts`).
 *   · `--ambar` en claro: app 130 84 0; maqueta #a86e07 (mismo motivo, contraste). En oscuro SÍ coincide.
 *   · Radio de la Card base: `Card.tsx` usa `rounded-panel` (24 px, con vidrio); la maqueta usa 22 px opaco
 *     `--s1`. No es un token de `tokens.css`, se anota aquí para que no se pierda.
 *   · Vidrio `--glass-bg` (.62 oscuro / .72 claro en la app; .72 / .76 en la maqueta).
 *   · Pilas de fuentes `--font-ui` y `--font-mono` (la app añade «SFMono-Regular»; la maqueta no).
 *   · Los cinco `--muelle-*`: la app los define con `linear()` generado; ya los fija otra prueba.
 *   · La maqueta nombra algunas superficies distinto (`--s1..s3`, `--glass`, `--scrim`, `--cosmos-*`,
 *     `--salon-*` sin `-3d`, `--cifra-*`…): no existen en la app, y no se miran aquí (pieza A3).
 *
 * Si una de estas diferencias se decide y se iguala, el valor se AÑADE a la tabla en ese mismo cambio.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')

/** Igual que el normalizador del script que armó la tabla: mismo texto de entrada, misma forma de salida. */
function canon(v: string, mapa: Record<string, string>, nivel = 0): string {
  let x = nivel > 6 ? v : v.replace(/var\((--[\w-]+)\)/g, (m, n: string) => (n in mapa ? canon(mapa[n], mapa, nivel + 1) : m))
  x = x.toLowerCase().trim()
  x = x.replace(/#([0-9a-f]{6})\b/g, (_m, h: string) => `rgb(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4), 16)})`)
  x = x.replace(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)/g, (_m, r: string, g: string, b: string, a?: string) =>
    a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`)
  return x.replace(/(^|[^0-9])\.(\d)/g, '$10.$2').replace(/\s*([,()])\s*/g, '$1').replace(/\s+/g, ' ').trim()
}

function declaraciones(texto: string): Record<string, string> {
  const m: Record<string, string> = {}
  for (const x of texto.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) m[x[1]] = x[2].trim()
  return m
}

/** Bloques de nivel superior (fuera de @media, @supports…) con su selector. */
function bloquesDeNivelSuperior(): Array<[string, string]> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const bloques: Array<[string, string]> = []
  let profundidad = 0
  let inicio = 0
  let selector = ''
  for (let i = 0; i < sinComentarios.length; i++) {
    const c = sinComentarios[i]
    if (c === '{') {
      if (profundidad === 0) { selector = sinComentarios.slice(inicio, i).trim(); inicio = i + 1 }
      profundidad++
    } else if (c === '}') {
      profundidad--
      if (profundidad === 0) { bloques.push([selector, sinComentarios.slice(inicio, i)]); inicio = i + 1 }
    }
  }
  return bloques
}

const SEL_OSCURO = ':root,\n[data-theme="dark"]'
const SEL_CLARO = '[data-theme="light"]'
const bloques = bloquesDeNivelSuperior()
const oscuro: Record<string, string> = {}
const claroSolo: Record<string, string> = {}
for (const [sel, cuerpo] of bloques) {
  // Un `:root` a secas (p. ej. el bloque de movimiento) vale para los dos temas: entra en la base, en orden.
  if (sel.endsWith(SEL_OSCURO) || sel === ':root') Object.assign(oscuro, declaraciones(cuerpo))
  if (sel === SEL_CLARO) Object.assign(claroSolo, declaraciones(cuerpo))
}
const claro = { ...oscuro, ...claroSolo }

// Valores de la maqueta (1-css.css y dark.vars), ya normalizados. Solo los que hoy coinciden con la app.
const CLARO: Record<string, string> = {
  'bg': 'rgb(247,247,245)',
  'linea': 'rgb(217,215,208)',
  'texto': 'rgb(17,17,17)',
  'tenue': 'rgb(95,94,90)',
  'rojo-osc': 'rgb(143,17,25)',
  'placa': 'rgb(95,94,90)',
  'azul': 'rgb(20,98,184)',
  'rojo-relleno': 'rgb(213,18,22)',
  'hairline': 'rgba(0,0,0,0.07)',
  'hairline-fuerte': 'rgba(0,0,0,0.12)',
  'sombra-card': '0 4px 14px rgba(0,0,0,0.12)',
  'brillo': 'inset 0 1px 0 rgba(255,255,255,0.9)',
  'sombra-alzado': '0 4px 12px rgba(0,0,0,0.16),inset 0 1px 0 rgba(255,255,255,0.95),inset 0 -1px 0 rgba(0,0,0,0.1)',
  'sombra-hundido': 'inset 0 1px 0 rgba(0,0,0,0.14),inset 0 6px 14px rgba(0,0,0,0.2),inset 0 -1px 0 rgba(255,255,255,0.85)',
  'relleno-alzado': 'linear-gradient(180deg,rgba(255,255,255,0.85)0%,rgba(255,255,255,0.15)46%,rgba(0,0,0,0.05)100%)',
  'relleno-hundido': 'linear-gradient(180deg,rgba(0,0,0,0.11)0%,rgba(0,0,0,0.015)58%,rgba(255,255,255,0.55)100%)',
  'canto': 'rgb(201,198,189)',
  'hero-a': 'rgb(74,15,20)',
  'hero-b': 'rgb(22,22,22)',
  'hero-texto': 'rgb(242,242,242)',
  'hero-tenue': 'rgb(201,201,205)',
  'hero-linea': 'rgba(255,255,255,0.16)',
  'on-rojo': 'rgb(255,255,255)',
  'btn-a': 'rgb(255,74,74)',
  'btn-c': 'rgb(196,15,15)',
  'btn-luz': 'rgba(255,255,255,0.45)',
  'btn-luz-2': 'rgba(255,255,255,0.3)',
  'btn-sombra': 'rgba(0,0,0,0.35)',
  'btn-sombra-2': 'rgba(0,0,0,0.3)',
  'btn-texto-sombra': 'rgba(0,0,0,0.35)',
  'canto-1': 'rgb(165,15,15)',
  'canto-2': 'rgb(140,12,12)',
  'canto-3': 'rgb(115,10,10)',
  'canto-4': 'rgb(90,7,7)',
  'canto-5': 'rgb(66,5,5)',
  'ease-salida': 'cubic-bezier(0.23,1,0.32,1)',
  'ease-mov': 'cubic-bezier(0.77,0,0.175,1)',
  'ease-cajon': 'cubic-bezier(0.32,0.72,0,1)',
  'ease-rebote': 'cubic-bezier(0.34,1.2,0.4,1)',
  'dur-toque': '160ms',
  'dur-base': '240ms',
  'dur-panel': '360ms',
  'dur-escena': '520ms',
  'dur-protagonista': '455ms',
  'dur-informativo': '542ms',
  'dur-transicional': '471ms',
  'dur-ambiental': '792ms',
  'dur-microinteraccion': '459ms',
  'perspectiva': '650px',
  'giro-lectura': '6deg',
  'salon-3d-piel': 'rgb(195,199,205)',
  'salon-3d-base': 'rgb(163,168,176)',
  'salon-3d-apagada': 'rgb(182,186,193)',
  'salon-3d-luz': 'rgb(38,43,51)',
  'salon-3d-hueso': 'rgb(241,238,230)',
  'salon-3d-cielo': 'rgb(255,255,255)',
  'salon-3d-tierra': 'rgb(141,138,131)',
  'salon-3d-sombra': '0.2',
  'salon-3d-brillo': '0',
  'pt-luz': 'rgba(255,255,255,0.95)',
  'pt-canto-1': 'rgb(220,220,223)',
  'pt-canto-2': 'rgb(209,209,213)',
  'pt-canto-3': 'rgb(198,198,203)',
  'pt-canto-4': 'rgb(187,187,193)',
  'pt-sombra': 'rgba(0,0,0,0.14)',
}

const OSCURO: Record<string, string> = {
  'bg': 'rgb(10,10,10)',
  'linea': 'rgb(46,46,49)',
  'texto': 'rgb(242,242,242)',
  'tenue': 'rgb(168,168,173)',
  'rojo-osc': 'rgb(143,17,25)',
  'placa': 'rgb(194,200,207)',
  'ambar': 'rgb(245,166,35)',
  'azul': 'rgb(59,157,255)',
  'rojo-relleno': 'rgb(213,18,22)',
  'hairline': 'rgba(255,255,255,0.08)',
  'hairline-fuerte': 'rgba(255,255,255,0.14)',
  'sombra-card': '0 4px 14px rgba(0,0,0,0.55)',
  'brillo': 'inset 0 1px 0 rgba(255,255,255,0.07)',
  'sombra-alzado': '0 4px 12px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.15),inset 0 -1px 0 rgba(0,0,0,0.55)',
  'sombra-hundido': 'inset 0 1px 0 rgba(0,0,0,0.9),inset 0 6px 14px rgba(0,0,0,1),inset 0 -1px 0 rgba(255,255,255,0.11)',
  'relleno-alzado': 'linear-gradient(180deg,rgba(255,255,255,0.09)0%,rgba(255,255,255,0.012)46%,rgba(0,0,0,0.13)100%)',
  'relleno-hundido': 'linear-gradient(180deg,rgba(0,0,0,0.38)0%,rgba(0,0,0,0.06)58%,rgba(255,255,255,0.035)100%)',
  'canto': 'rgb(58,58,62)',
  'hero-a': 'rgb(74,15,20)',
  'hero-b': 'rgb(22,22,22)',
  'hero-texto': 'rgb(242,242,242)',
  'hero-tenue': 'rgb(201,201,205)',
  'hero-linea': 'rgba(255,255,255,0.16)',
  'on-rojo': 'rgb(255,255,255)',
  'btn-a': 'rgb(255,74,74)',
  'btn-c': 'rgb(196,15,15)',
  'btn-luz': 'rgba(255,255,255,0.45)',
  'btn-luz-2': 'rgba(255,255,255,0.3)',
  'btn-sombra': 'rgba(0,0,0,0.35)',
  'btn-sombra-2': 'rgba(0,0,0,0.3)',
  'btn-texto-sombra': 'rgba(0,0,0,0.35)',
  'canto-1': 'rgb(165,15,15)',
  'canto-2': 'rgb(140,12,12)',
  'canto-3': 'rgb(115,10,10)',
  'canto-4': 'rgb(90,7,7)',
  'canto-5': 'rgb(66,5,5)',
  'ease-salida': 'cubic-bezier(0.23,1,0.32,1)',
  'ease-mov': 'cubic-bezier(0.77,0,0.175,1)',
  'ease-cajon': 'cubic-bezier(0.32,0.72,0,1)',
  'ease-rebote': 'cubic-bezier(0.34,1.2,0.4,1)',
  'dur-toque': '160ms',
  'dur-base': '240ms',
  'dur-panel': '360ms',
  'dur-escena': '520ms',
  'dur-protagonista': '455ms',
  'dur-informativo': '542ms',
  'dur-transicional': '471ms',
  'dur-ambiental': '792ms',
  'dur-microinteraccion': '459ms',
  'perspectiva': '650px',
  'giro-lectura': '6deg',
  'salon-3d-piel': 'rgb(169,175,184)',
  'salon-3d-base': 'rgb(43,48,56)',
  'salon-3d-apagada': 'rgb(59,65,75)',
  'salon-3d-luz': 'rgb(233,238,244)',
  'salon-3d-hueso': 'rgb(217,212,200)',
  'salon-3d-cielo': 'rgb(207,216,227)',
  'salon-3d-tierra': 'rgb(11,14,18)',
  'salon-3d-sombra': '0.45',
  'salon-3d-brillo': '0.22',
  'pt-luz': 'rgba(255,255,255,0.14)',
  'pt-canto-1': 'rgb(40,40,45)',
  'pt-canto-2': 'rgb(33,33,38)',
  'pt-canto-3': 'rgb(26,26,30)',
  'pt-canto-4': 'rgb(19,19,22)',
  'pt-sombra': 'rgba(0,0,0,0.7)',
}

describe('tokens de la maqueta que hoy coinciden con tokens.css', () => {
  it('la lectura de tokens.css encontró los dos temas', () => {
    expect(Object.keys(oscuro).length).toBeGreaterThan(100)
    expect(Object.keys(claroSolo).length).toBeGreaterThan(50)
  })

  it.each(Object.keys(OSCURO))('oscuro --%s es el de la maqueta', (n) => {
    expect(`--${n}` in oscuro, `falta --${n} en tokens.css (oscuro)`).toBe(true)
    expect(canon(oscuro[`--${n}`], oscuro)).toBe(OSCURO[n])
  })

  it.each(Object.keys(CLARO))('claro --%s es el de la maqueta', (n) => {
    expect(`--${n}` in claro, `falta --${n} en tokens.css (claro)`).toBe(true)
    expect(canon(claro[`--${n}`], claro)).toBe(CLARO[n])
  })
})
