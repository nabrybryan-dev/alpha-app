import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL TEXTO DEL SALÓN LLEGA A 4,5:1 EN LOS DOS TEMAS, MEDIDO.
 *
 * El salón dejó de ser siempre oscuro (zona 8): en claro, el cuerpo, el rojo de
 * «por trabajar», los números de las paredes, la banda del día y el cronómetro se
 * leen sobre la pared clara. Aquí se lee `tokens.css` y se recalcula el cociente de
 * `--salon-3d-texto`, `--salon-3d-tenue` y `--salon-3d-accion` contra la pared y
 * contra las superficies del salón, y el de las cifras del marcador contra su panel.
 */
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(/\r\n/g, '\n')

function bloques(selector: RegExp): string {
  const partes: string[] = []
  let desde = 0
  while (desde < css.length) {
    const encontrado = selector.exec(css.slice(desde))
    if (!encontrado) break
    const inicio = desde + encontrado.index
    const fin = css.indexOf('\n}', inicio)
    if (fin < 0) break
    partes.push(css.slice(inicio, fin))
    desde = fin + 1
  }
  return partes.join('\n')
}

const claro = bloques(/\[data-theme="light"\]\s*\{/)
const oscuro = bloques(/:root,\s*\[data-theme="dark"\]\s*\{/)

type Rgb = [number, number, number]

function color(bloque: string, nombre: string): Rgb {
  const crudo = new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(bloque)?.[1]?.trim()
  if (!crudo) throw new Error(`no está --${nombre}`)
  const hex = /^#([0-9a-f]{6})$/i.exec(crudo)
  if (!hex) throw new Error(`--${nombre} no es #rrggbb: ${crudo}`)
  const n = Number.parseInt(hex[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lineal = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luz = ([r, g, b]: Rgb) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
const contraste = (a: Rgb, b: Rgb) => {
  const [x, y] = [luz(a), luz(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEMAS = [
  { nombre: 'claro', bloque: claro },
  { nombre: 'oscuro', bloque: oscuro },
] as const

describe.each(TEMAS)('contraste del salón en tema $nombre', ({ bloque }) => {
  it.each(['salon-3d-texto', 'salon-3d-tenue', 'salon-3d-accion'])(
    '%s llega a 4,5:1 sobre la pared del salón',
    (token) => {
      const c = contraste(color(bloque, token), color(bloque, 'salon-3d-pared'))
      expect(Number(c.toFixed(2)), token).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('las cifras encendidas del marcador llegan a 3:1 sobre su panel, y las apagadas se distinguen de ellas', () => {
    const panel = color(bloque, 'salon-3d-panel')
    const vivo = color(bloque, 'salon-3d-segmento')
    const apagado = color(bloque, 'salon-3d-segmento-apagado')
    expect(contraste(vivo, panel)).toBeGreaterThanOrEqual(3)
    expect(contraste(vivo, apagado)).toBeGreaterThanOrEqual(3)
  })

  it('el rojo de «por trabajar» (acción) y el texto no se confunden: distinto tono, no solo brillo', () => {
    const [r, g, b] = color(bloque, 'salon-3d-accion')
    expect(r).toBeGreaterThan(g + 40)
    expect(r).toBeGreaterThan(b + 40)
  })
})

/** Un token cualquiera (no solo #rrggbb), tal como está escrito. */
function crudo(bloque: string, nombre: string): string {
  const v = new RegExp(`^\\s*--${nombre}:\\s*([^;]+);`, 'm').exec(bloque)?.[1]?.trim()
  if (!v) throw new Error(`no está --${nombre}`)
  return v
}

// EXCEPCIÓN FIRMADA POR BRYAN, 29-oct-2026: en oscuro la leyenda pequeña de la retícula pasa
// de white/35 (3,16:1) a #8a8d91 (5,80:1 sobre el lienzo). Esa excepción es SOLO del oscuro:
// en claro la leyenda se mide a 4,5:1 como todo lo demás (abajo, `salon-3d-leyenda`).
//
// En OSCURO el contrato dice «igual que main»: el rótulo (#6f7782) y el matiz (#7a7a7a) de main
// NO llegan a 4,5:1 sobre el lienzo y se quedan como estaban (no hay firma para subirlos). Por
// eso solo se miden a 4,5:1 en claro. Su valor oscuro lo fija la prueba «oscuro igual que main».
const SIN_MEDIDA_EN_OSCURO = ['salon-3d-rotulo', 'salon-3d-matiz']
const medibles = (nombre: string, tokens: string[]) =>
  nombre === 'oscuro' ? tokens.filter((t) => !SIN_MEDIDA_EN_OSCURO.includes(t)) : tokens

describe.each(TEMAS)('el texto del salón también se lee sobre el fondo del lienzo, tema $nombre', ({ nombre, bloque }) => {
  it.each(medibles(nombre, ['salon-3d-texto', 'salon-3d-dato', 'salon-3d-tenue', 'salon-3d-accion', 'salon-3d-rotulo', 'salon-3d-matiz', 'salon-3d-leyenda', 'salon-3d-arrastre']))(
    '%s llega a 4,5:1 sobre --salon-3d-lienzo',
    (token) => {
      const c = contraste(color(bloque, token), color(bloque, 'salon-3d-lienzo'))
      expect(Number(c.toFixed(2)), token).toBeGreaterThanOrEqual(4.5)
    },
  )
  it.each(medibles(nombre, ['salon-3d-rotulo', 'salon-3d-matiz', 'salon-3d-leyenda']))('%s llega a 4,5:1 sobre la pared', (token) => {
    expect(Number(contraste(color(bloque, token), color(bloque, 'salon-3d-pared')).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('la leyenda del salón en CLARO se mide a 4,5:1 (la excepción de #8a8d91 es solo del oscuro)', () => {
  it.each(['salon-3d-lienzo', 'salon-3d-pared'])('--salon-3d-leyenda (claro) sobre --%s', (fondo) => {
    expect(crudo(claro, 'salon-3d-leyenda').toLowerCase()).not.toBe('#8a8d91')
    const c = contraste(color(claro, 'salon-3d-leyenda'), color(claro, fondo))
    expect(Number(c.toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('los tokens del salón claro son distintos de los oscuros', () => {
  it.each(['pared', 'texto', 'tenue', 'accion', 'panel', 'segmento', 'lienzo'])('--salon-3d-%s cambia con el tema', (n) => {
    expect(crudo(claro, `salon-3d-${n}`)).not.toBe(crudo(oscuro, `salon-3d-${n}`))
  })
})

/**
 * EL OSCURO SE VE IGUAL QUE ANTES (encargo: «en oscuro no cambia nada»). Los valores son
 * los que tenían las reglas `.muro-*` y el joystick antes de la zona 8. NO hay excepciones
 * de contraste en oscuro: el rótulo (#6f7782) y el matiz (#7a7a7a) siguen como en main.
 */
/**
 * EL OSCURO ES IGUAL QUE MAIN, TOKEN POR TOKEN (contrato firmado por Bryan). Lista explícita
 * de TODOS los `--salon-3d-*` del bloque oscuro de `tokens.css`, con el valor que tenía main
 * (0b015bab) o, para los tokens nuevos, el valor literal que las reglas y el código de main
 * escribían a mano (pared, panel, `.muro-dato` = silver-100, etc.).
 * Única excepción firmada (29-oct-2026): la leyenda pequeña, #8a8d91 en vez de white/35.
 * Si alguien añade, quita o cambia un token del oscuro, esta prueba falla.
 */
const OSCURO_DE_MAIN: Record<string, string> = {
  'salon-3d-piel': '#a9afb8',
  'salon-3d-base': '#2b3038',
  'salon-3d-apagada': '#3b414b',
  'salon-3d-luz': '#e9eef4',
  'salon-3d-hueso': '#d9d4c8',
  'salon-3d-cielo': '#cfd8e3',
  'salon-3d-tierra': '#0b0e12',
  'salon-3d-sombra': '0.45',
  'salon-3d-brillo': '0.22',
  'salon-3d-pared': '#101114',
  'salon-3d-zocalo': '#181b1f',
  'salon-3d-marco': '#333842',
  'salon-3d-panel': '#070809',
  'salon-3d-segmento': '#ff3d3d',
  'salon-3d-segmento-apagado': '#0e0f11',
  'salon-3d-texto': '#f2f2f2',
  'salon-3d-dato': '#f4f5f6',
  'salon-3d-tenue': '#c2c8cf',
  'salon-3d-accion': '#ff4646',
  'salon-3d-accion-suave': '#ff4646d9',
  'salon-3d-lienzo': '#0b0e12',
  'salon-3d-plata': '#6f7782',
  'salon-3d-rotulo': '#6f7782',
  'salon-3d-matiz': '#7a7a7a',
  'salon-3d-leyenda': '#8a8d91', // EXCEPCIÓN FIRMADA (main: white/35)
  'salon-3d-leyenda-tenue': 'rgb(255 255 255 / 0.2)',
  'salon-3d-resplandor': '0 0 0.42em rgb(111 119 130 / 0.55)',
  'salon-3d-relieve': '0 1px 0 rgb(0 0 0 / 0.6), 1px 2px 0 #2a2d31, 2px 3px 0 #22252a',
  'salon-3d-sombra-portada': '0 1px 6px rgb(0 0 0 / 0.55)',
  'salon-3d-sombra-portada-fuerte': '0 1px 6px rgb(0 0 0 / 0.7)',
  'salon-3d-filo-bajo': 'rgb(0 0 0 / 0.9)',
  'salon-3d-sombra-caja': 'rgb(0 0 0 / 0.95)',
  'salon-3d-vineta-rgb': '5 7 10',
  'salon-3d-negro-rgb': '0 0 0',
  'salon-3d-borde-fino': 'rgb(255 255 255 / 0.14)',
  'salon-3d-filete-rgb': '255 255 255',
  'salon-3d-arrastre': '#9aa1ab',
  'salon-3d-sombra-pared': 'rgb(0 0 0 / 0.9)',
  'salon-3d-sombra-menu': 'rgb(0 0 0 / 0.7)',
  'salon-3d-superficie': 'rgb(var(--ink-1000-rgb) / 0.96)',
  'salon-3d-superficie-alta': 'rgb(var(--ink-800-rgb) / 0.96)',
  'salon-3d-borde': 'rgb(var(--silver-500-rgb) / 0.45)',
  'salon-3d-velo': 'rgb(var(--ink-1000-rgb) / 0.6)',
}

describe('tema oscuro del salón: IGUAL que main, token por token', () => {
  const normal = (v: string) => v.replace(/\s+/g, ' ').trim().toLowerCase()
  it.each(Object.entries(OSCURO_DE_MAIN))('--%s', (nombre, esperado) => {
    expect(normal(crudo(oscuro, nombre))).toBe(normal(esperado))
  })
  it('el bloque oscuro no tiene ningún --salon-3d-* fuera de la lista (ni le falta ninguno)', () => {
    const presentes = [...oscuro.matchAll(/^\s*--(salon-3d-[a-z0-9-]+):/gm)].map((m) => m[1]!)
    expect([...new Set(presentes)].sort()).toEqual(Object.keys(OSCURO_DE_MAIN).sort())
  })
  it('la cifra grande y la paleta fija que leen las tarjetas siguen como en main', () => {
    expect(crudo(oscuro, 'texto-rgb')).toBe('242 242 242')
    expect(css).toMatch(/--silver-100:\s*#f4f5f6/i)
    expect(css).toMatch(/--silver-500-rgb:\s*111 119 130/)
  })
})

describe('tema oscuro del salón: los valores de antes', () => {
  it('conserva el rojo, el resplandor, el relieve y el borde del joystick', () => {
    expect(crudo(oscuro, 'salon-3d-accion').toLowerCase()).toBe('#ff4646')
    expect(crudo(oscuro, 'salon-3d-plata').toLowerCase()).toBe('#6f7782')
    expect(crudo(oscuro, 'salon-3d-resplandor')).toContain('rgb(111 119 130 / 0.55)')
    expect(crudo(oscuro, 'salon-3d-relieve')).toContain('#2a2d31')
    expect(crudo(oscuro, 'salon-3d-relieve')).toContain('#22252a')
    expect(crudo(oscuro, 'salon-3d-borde-fino')).toContain('255 255 255 / 0.14')
    expect(crudo(oscuro, 'salon-3d-accion-suave').toLowerCase()).toBe('#ff4646d9')
  })
  it('la leyenda de la retícula es #8a8d91 en oscuro: excepción firmada por Bryan el 29-oct-2026 (5,80:1)', () => {
    expect(crudo(oscuro, 'salon-3d-leyenda').toLowerCase()).toBe('#8a8d91')
    const c = contraste(color(oscuro, 'salon-3d-leyenda'), color(oscuro, 'salon-3d-lienzo'))
    expect(Number(c.toFixed(2))).toBe(5.8)
    expect(css).toContain('Bryan, 29-oct-2026')
  })
  it('la cifra grande no cambió en oscuro (R2-5)', () => {
    expect(crudo(oscuro, 'salon-3d-texto').toLowerCase()).toBe('#f2f2f2')
    expect(crudo(oscuro, 'texto-rgb')).toBe('242 242 242')
  })
  it('en claro no hay resplandor ni relieve', () => {
    expect(crudo(claro, 'salon-3d-resplandor')).toBe('none')
    expect(crudo(claro, 'salon-3d-relieve')).toBe('none')
  })
})

/**
 * LA SESIÓN Y EL SALÓN EN CLARO NO SON UNA CAJA NEGRA (ronda 2, capturas del 28-oct).
 *
 * Las tarjetas de la sesión usan la paleta `ink-*` / `silver-*`, que es fija y oscura. En
 * claro, el texto de tema (oscuro) caía sobre esas tarjetas negras y los valores sugeridos
 * casi no se leían. Dentro de `[data-salon]` y `[data-sesion]` el tema claro invierte esa
 * paleta; aquí se mide que cada texto `silver-*` llega a 4,5:1 sobre cada fondo `ink-*`
 * en el que se usa, y que los dos contenedores llevan la marca.
 */
const ambito = (() => {
  const i = css.search(/\[data-theme="light"\] \[data-salon="entrenar"\],/)
  if (i < 0) throw new Error('falta el ámbito claro de la sesión en tokens.css')
  return css.slice(i, css.indexOf('\n}', i))
})()

describe('paleta de las tarjetas en tema claro (ámbito del salón y de la sesión)', () => {
  const rgb = (n: string): Rgb => {
    const m = new RegExp(`--${n}-rgb:\\s*(\\d+) (\\d+) (\\d+)`).exec(ambito)
    if (!m) throw new Error(`falta --${n}-rgb en el ámbito`)
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const FONDOS = ['ink-1000', 'ink-900', 'ink-800', 'ink-700', 'ink-600', 'ink-500']
  it.each([['silver-100'], ['silver-200'], ['silver-300'], ['silver-400'], ['silver-500']])(
    '%s llega a 4,5:1 sobre las tarjetas',
    (texto) => {
      for (const fondo of FONDOS) {
        expect(Number(contraste(rgb(texto), rgb(fondo)).toFixed(2)), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )
  it('el botón deshabilitado no se queda gris sobre gris: 4,5:1 entre su texto y su fondo', () => {
    expect(contraste(rgb('silver-400'), rgb('ink-600'))).toBeGreaterThanOrEqual(4.5)
  })
  it('SesionPage, SesionCerrada y el salón llevan la marca del ámbito', () => {
    const fuente = (r: string) => readFileSync(join(__dirname, '../features/entrenar', r), 'utf8')
    expect(fuente('SesionPage.tsx')).toMatch(/data-sesion="entrenar"/)
    expect(fuente('SesionCerrada.tsx')).toMatch(/data-sesion="entrenar"/)
    expect(fuente('salon/SalonEntrenar.tsx')).toMatch(/data-salon="entrenar"/)
  })
})

/**
 * LOS DOS BOTONES REDONDOS DE LA DERECHA (R2-6) llevan el mismo velo y el mismo borde, los
 * dos por token: antes la cámara tenía su propio rgb(ink-1000 / .6) y un borde rojo, y el
 * joystick el velo del tema; en claro quedaban dos velos y dos bordes uno junto al otro.
 */
describe('botones redondos de la derecha: mismo velo y mismo borde', () => {
  const src = (r: string) => readFileSync(join(__dirname, '../features/entrenar/salon', r), 'utf8')
  const camara = src('camara/CamaraDelSalon.tsx')
  const joystick = src('mando/Joystick.tsx')
  it.each(['--salon-3d-velo', '--salon-3d-borde-fino'])('los dos usan var(%s)', (token) => {
    expect(camara).toContain(`var(${token})`)
    expect(joystick).toContain(`var(${token})`)
  })
  it('la cámara ya no fija su propio velo ni su borde', () => {
    expect(camara).not.toMatch(/rgb\(var\(--ink-1000-rgb\)/)
    expect(camara).not.toMatch(/borderColor:\s*'rgb\(var\(--accion-rgb\)/)
  })
})

/**
 * LA TARJETA DEL CRONÓMETRO DE LA SESIÓN SE ACLARA EN TEMA CLARO (decisión de Bryan, 29-oct-2026).
 * Era una `.tarjeta-foto` negra sobre una pantalla clara. Ahora, en claro y SOLO dentro de la
 * sesión (`[data-sesion="entrenar"]`; Logros usa la misma clase y no cambia): velo claro sobre
 * la foto, tinta oscura y rojo oscuro. Todo a 4,5:1 en el peor caso: foto NEGRA bajo el velo
 * más flojo (el fondo más oscuro posible bajo un texto oscuro). El oscuro no cambia.
 */
describe('tarjeta con foto del cronómetro de la sesión, tema claro', () => {
  const ALCANCE = String.raw`\[data-theme="light"\]\s+\[data-sesion="entrenar"\]\s+\.tarjeta-foto`
  const regla = (resto: string) => new RegExp(ALCANCE + resto + String.raw`\s*\{([^}]*)\}`).exec(css)?.[1] ?? ''
  const hexDe = (cuerpo: string, prop = 'color'): Rgb => {
    const h = new RegExp(String.raw`(?:^|[\s;])` + prop + String.raw`:\s*#([0-9a-f]{6})`, 'i').exec(cuerpo)?.[1]
    expect(h, `falta ${prop} #rrggbb en «${cuerpo.trim()}»`).toBeTruthy()
    const n = Number.parseInt(h!, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const velo = regla('::after')
  const alfas = [...velo.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g)].map((m) => ({
    rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
    a: Number(m[4]),
  }))
  // Peor caso: foto negra; el velo la tapa solo con su alfa mínimo.
  const peor = (): Rgb => {
    const { rgb, a } = alfas.reduce((m, x) => (x.a < m.a ? x : m))
    return rgb.map((c) => Math.round(c * a)) as Rgb
  }

  it('hay un velo claro (no oscuro) y espeso, solo en claro y solo en la sesión', () => {
    expect(alfas.length, 'falta el velo ::after de la tarjeta de la sesión en claro').toBeGreaterThanOrEqual(2)
    for (const { rgb, a } of alfas) {
      expect(Math.min(...rgb), 'el velo debe ser claro').toBeGreaterThanOrEqual(235)
      expect(a, 'el velo debe tapar la foto').toBeGreaterThanOrEqual(0.85)
    }
  })
  it.each([
    ['la tinta del texto (color de la tarjeta)', '', 'color'],
    ['el tenue de «Toca para pausar»', String.raw` \.text-tenue`, 'color'],
    ['el rojo del kicker', String.raw` \.kicker`, 'color'],
  ])('%s llega a 4,5:1 sobre el peor caso del velo', (_n, resto, prop) => {
    const cuerpo = regla(resto)
    expect(Number(contraste(hexDe(cuerpo, prop), peor()).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
  it('la cifra en pausa (opacity-50 sube a 0,7) sigue legible a 4,5:1', () => {
    const op = Number(/opacity:\s*([\d.]+)/.exec(regla(String.raw` \.opacity-50`))?.[1])
    expect(op).toBeGreaterThanOrEqual(0.7)
    const tinta = hexDe(regla(''))
    const fondo = peor()
    const mezcla = tinta.map((c, i) => Math.round(c * op + fondo[i]! * (1 - op))) as Rgb
    expect(Number(contraste(mezcla, fondo).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
  it('el oscuro y Logros no cambian: la tarjeta base sigue con velo oscuro y texto #f2f2f2', () => {
    const base = /\n\.tarjeta-foto\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(base).toContain('color: #f2f2f2')
    const baseVelo = /\n\.tarjeta-foto::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseVelo).toContain('rgba(10, 10, 10, 0.38)')
    expect(baseVelo).toContain('rgba(10, 10, 10, 0.72)')
    expect(baseVelo).toContain('rgba(10, 10, 10, 0.92)')
    // Ninguna regla de claro toca `.tarjeta-foto` sin el alcance de la sesión (en cualquiera de
    // sus escrituras: ver `reglasDeClaroSinAlcance`, más abajo).
    expect(reglasDeClaroSinAlcance(css).filter((r) => r.includes('tarjeta-foto'))).toEqual([])
  })
})

/**
 * PRUEBA DE ALCANCE: ninguna regla de TEMA CLARO puede tocar la sesión sin el alcance
 * `[data-sesion` / `[data-salon`. El claro se puede escribir de varias formas, y todas cuentan:
 * `[data-theme="light"]`, con comillas simples o sin ellas, y `:root:not([data-theme="dark"])`
 * (igual de «claro» para quien lee el CSS). Una regla así que no esté en la lista de lo que ya
 * había en main (cifras 3D y Praxis, que traen su propio alcance) es una fuga hacia Logros o
 * cualquier otra pantalla que reutilice las clases de la sesión.
 */
const CLARO_SIN_ALCANCE_DE_MAIN = [
  '[data-theme="light"]', // el bloque de tokens
  '[data-theme="light"] .cifra-3d',
  '[data-theme="light"] .cifra-3d-rojo',
  '[data-theme="light"] .praxis:not([data-tema="oscuro"])',
]

function reglasDeClaroSinAlcance(fuente: string): string[] {
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '')
  const esClaro = /data-theme\s*=\s*["']?light["']?|:not\(\s*\[\s*data-theme\s*=\s*["']?dark["']?\s*\]\s*\)/
  const fugas: string[] = []
  for (const m of sinComentarios.matchAll(/([^{}]+)\{/g)) {
    const cabecera = m[1]!.trim()
    if (cabecera.startsWith('@')) continue
    for (const crudoSel of cabecera.split(/,(?![^(]*\))/)) {
      // Comillas simples o ninguna = las dobles; espacios de más fuera.
      const sel = crudoSel
        .replace(/\[\s*data-theme\s*=\s*['"]?(light|dark)['"]?\s*\]/g, '[data-theme="$1"]')
        .replace(/\s+/g, ' ')
        .trim()
      if (!esClaro.test(sel)) continue
      if (/\[data-(sesion|salon)/.test(sel)) continue
      if (CLARO_SIN_ALCANCE_DE_MAIN.includes(sel)) continue
      fugas.push(sel)
    }
  }
  return fugas
}

describe('el tema claro de la sesión no se sale de [data-sesion] / [data-salon]', () => {
  it('ninguna regla de claro (en cualquiera de sus escrituras) toca clases de la sesión sin alcance', () => {
    expect(reglasDeClaroSinAlcance(css)).toEqual([])
  })
  it('el detector ve las escrituras alternativas (si no, la prueba de arriba no vale)', () => {
    const trampas = [
      ':root:not([data-theme="dark"]) .tarjeta-foto .opacity-50 { opacity: .7 }',
      ":root:not([data-theme='dark']) .tarjeta-foto { color: red }",
      "[data-theme='light'] .tarjeta-foto { color: red }",
      '[data-theme=light] .kicker { color: red }',
      '[data-theme="light"]   .tarjeta-foto::after { background: red }',
    ]
    for (const t of trampas) expect(reglasDeClaroSinAlcance(t), t).toHaveLength(1)
    expect(reglasDeClaroSinAlcance('[data-theme="light"] [data-sesion="entrenar"] .tarjeta-foto { color: red }')).toEqual([])
    expect(reglasDeClaroSinAlcance(':root:not([data-theme="dark"]) [data-salon="entrenar"] .x { color: red }')).toEqual([])
  })
})

/**
 * SIN COLORES FIJOS EN EL SALÓN Y LA SESIÓN (H6). Un `border-white/10` o una sombra
 * `rgba(0,0,0,.9)` escritos a mano no siguen el tema: en claro el filete blanco no se ve y
 * la sombra negra ensucia el papel. Deben leer los tokens `--salon-3d-*`.
 */
describe('el salón y la sesión no llevan filetes blancos ni sombras negras fijos', () => {
  const raiz = join(__dirname, '../features/entrenar')
  const archivos: string[] = []
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name)
      if (e.isDirectory()) recorrer(ruta)
      else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) archivos.push(ruta)
    }
  }
  recorrer(join(raiz, 'salon'))
  archivos.push(join(raiz, 'visor/VisorPatron.tsx'), join(raiz, 'SesionPage.tsx'), join(raiz, 'SesionCerrada.tsx'), join(raiz, 'EjercicioCompletado.tsx'))
  const fijos = /border-white\/|bg-white\/|rgba\(\s*0\s*,\s*0\s*,\s*0|rgb\(\s*0 0 0/
  it.each(archivos.map((a) => [a.slice(raiz.length + 1).split(sep).join('/'), a] as const))('%s', (_nombre, ruta) => {
    const lineas = readFileSync(ruta, 'utf8')
      .split('\n')
      .filter((l) => fijos.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l))
    expect(lineas).toEqual([])
  })
})

/**
 * «ARRASTRA PARA GIRAR» (R2-8) vive en VisorPatron.tsx (hoja del patrón 3D), en mayúsculas
 * por CSS. Era `text-silver-400` fijo (#9aa1ab, ~2,2:1 sobre el lienzo claro); ahora lee
 * `--salon-3d-arrastre`: en oscuro el mismo #9aa1ab, en claro tinta. El contraste sobre el
 * lienzo se mide arriba, con el resto de los tokens de texto.
 */
describe('«Arrastra para girar» sigue el tema', () => {
  it('lee --salon-3d-arrastre y en oscuro conserva #9aa1ab', () => {
    const f = readFileSync(join(__dirname, '../features/entrenar/visor/VisorPatron.tsx'), 'utf8')
    expect(f).toContain('text-[color:var(--salon-3d-arrastre)]')
    expect(f).not.toMatch(/text-silver-400">\s*Arrastra para girar/)
    expect(crudo(oscuro, 'salon-3d-arrastre').toLowerCase()).toBe('#9aa1ab')
  })
})
