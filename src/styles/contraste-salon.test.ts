import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

// En oscuro la leyenda de la retícula conserva su valor de antes (white/35, 3,16:1, no
// es #rrggbb): excepción declarada, ver «tema oscuro del salón: los valores de antes».
const sinLeyendaEnOscuro = (nombre: string, tokens: string[]) =>
  nombre === 'oscuro' ? tokens.filter((t) => t !== 'salon-3d-leyenda') : tokens

describe.each(TEMAS)('el texto del salón también se lee sobre el fondo del lienzo, tema $nombre', ({ nombre, bloque }) => {
  it.each(sinLeyendaEnOscuro(nombre, ['salon-3d-texto', 'salon-3d-tenue', 'salon-3d-accion', 'salon-3d-rotulo', 'salon-3d-matiz', 'salon-3d-leyenda']))(
    '%s llega a 4,5:1 sobre --salon-3d-lienzo',
    (token) => {
      const c = contraste(color(bloque, token), color(bloque, 'salon-3d-lienzo'))
      expect(Number(c.toFixed(2)), token).toBeGreaterThanOrEqual(4.5)
    },
  )
  it.each(sinLeyendaEnOscuro(nombre, ['salon-3d-rotulo', 'salon-3d-matiz', 'salon-3d-leyenda']))('%s llega a 4,5:1 sobre la pared', (token) => {
    expect(Number(contraste(color(bloque, token), color(bloque, 'salon-3d-pared')).toFixed(2))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('los tokens del salón claro son distintos de los oscuros', () => {
  it.each(['pared', 'texto', 'tenue', 'accion', 'panel', 'segmento', 'lienzo'])('--salon-3d-%s cambia con el tema', (n) => {
    expect(crudo(claro, `salon-3d-${n}`)).not.toBe(crudo(oscuro, `salon-3d-${n}`))
  })
})

/**
 * EL OSCURO SE VE IGUAL QUE ANTES (encargo: «en oscuro no cambia nada»). Los valores son
 * los que tenían las reglas `.muro-*` y el joystick antes de la zona 8. Las únicas
 * excepciones son las que obliga el contraste de 4,5:1, y van escritas aquí con su porqué:
 * el rótulo era #6f7782 (4,15:1 sobre la pared: no llega) y el matiz #7a7a7a (4,4:1).
 */
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
  it('la leyenda de la retícula y la cifra grande no cambiaron en oscuro (R2-5)', () => {
    expect(crudo(oscuro, 'salon-3d-leyenda')).toBe('rgb(255 255 255 / 0.35)')
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
