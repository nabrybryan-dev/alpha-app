import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/dbInstance'
import { direccion } from '../../lib/direccionesVisuales'
import { MedidasCard } from './MedidasCard'

/**
 * LA ENCUESTA DE MEDIDAS: OCHO, Y NI UNA MÁS.
 *
 * Hasta el 2026-09-08 esta tarjeta pedía la báscula y cinco perímetros de estética
 * —cintura, cadera, abdomen, muslo, brazo—. Ahora pide ocho medidas, y seis son longitudes
 * de hueso: son las que le faltan al sujeto 3D del salón para dejar de ser el muñeco del
 * atlas y ser esta persona. Con la estatura sola, dos personas de 1,75 con fémures
 * distintos se dibujan iguales.
 *
 * Que sean EXACTAMENTE ocho es la mitad del encargo. Un formulario que pide once cosas se
 * rellena a medias, y una medida a medias no se puede comparar con la de dentro de tres
 * meses.
 *
 * El peso ya no está: lo pregunta el check-in del día. Lo que sigue estando es `verPeso`,
 * que decide si el resumen enseña el kilaje de una medición anterior — la migración 0018
 * apaga las cifras de composición corporal a quien tiene un antecedente de conducta
 * alimentaria, y enseñarlo en el resumen sería dejarlo entrar por la puerta de atrás.
 */

const ASESORADA = 'u-valentina'

const abrir = (verPeso?: boolean) =>
  render(<MedidasCard usuarioId={ASESORADA} {...(verPeso === undefined ? {} : { verPeso })} />)

const medidas = () => db.perfiles.byUsuario(ASESORADA)?.medidas ?? []

/** Las ocho, en el orden en que se piden. */
const LAS_OCHO = [
  'Longitud de tibia y peroné (cm)',
  'Longitud del fémur (cm)',
  'Longitud del torso (cm)',
  'Longitud del antebrazo (cm)',
  'Longitud del brazo (cm)',
  'Ancho clavicular (cm)',
  'Cintura (cm)',
  'Caderas (cm)',
]

/** El texto de la etiqueta de cada campo, sin la ayuda de cómo se mide. */
function etiquetasDeLosCampos(): string[] {
  return screen.getAllByRole('textbox').map((campo) => {
    const etiqueta = campo.closest('label')?.querySelector('span')
    // Solo los nodos de TEXTO sueltos del `span`: la ayuda de cómo se mide cuelga de un
    // `span` de dentro y no es parte de la etiqueta.
    const sueltos = Array.from(etiqueta?.childNodes ?? [])
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
    return sueltos.replace(/\s+/g, ' ').trim()
  })
}

describe('la encuesta de medidas', () => {
  beforeEach(() => localStorage.clear())

  it('pide exactamente ocho, con estas etiquetas y ninguna otra', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    const campos = screen.getAllByRole('textbox')
    expect(campos).toHaveLength(8)
    expect(etiquetasDeLosCampos()).toEqual(LAS_OCHO)
  })

  it('ya no pide el peso: eso es del check-in del día', async () => {
    abrir(true)
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(screen.queryByText(/Peso \(kg\)/)).toBeNull()
    expect(screen.queryByLabelText(/Peso/i)).toBeNull()
  })

  it('cada medida dice CÓMO se toma: una longitud sin protocolo no es una medida', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // El fémur es el caso que lo justifica: medido desde la cadera y desde el trocánter
    // salen dos números distintos, y el que se compara dentro de tres meses tiene que
    // salir del mismo sitio.
    expect(screen.getByText(/trocánter/i)).toBeTruthy()
    expect(screen.getByText(/de extremo a extremo/i)).toBeTruthy()
  })

  it('guarda con las claves estables, tal y como viajan a `perfiles`', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
    const campos = screen.getAllByRole('textbox')
    await userEvent.type(campos[1], '44,5') // el fémur, con coma: así se escribe aquí
    await userEvent.type(campos[6], '72')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const [ultima] = medidas().slice(-1)
    expect(ultima.perimetros).toEqual({ 'Fémur': 44.5, Cintura: 72 })
    // Las vacías no se guardan: un cero inventado es peor que un hueco.
    expect(Object.keys(ultima.perimetros)).toHaveLength(2)
    // Y sin peso: ausente no es cero.
    expect(ultima.pesoKg).toBeUndefined()
  })

  it('no deja guardar una medición vacía', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
  })

  it('con una sola medida escrita ya deja guardar', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await userEvent.type(screen.getAllByRole('textbox')[0], '41')

    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled()
  })

  it('a quien tiene la composición apagada no le enseña el kilaje de antes', () => {
    db.perfiles.agregarMedida(ASESORADA, {
      fecha: '2026-12-31',
      pesoKg: 56,
      alturaCm: 165,
      perimetros: { Cintura: 72 },
    })
    abrir(false)

    expect(screen.getByText(/Última: 2026-12-31/)).toBeTruthy()
    expect(screen.queryByText(/56 kg/)).toBeNull()
  })

  it('y sí se lo enseña a quien sí ve su composición', () => {
    db.perfiles.agregarMedida(ASESORADA, {
      fecha: '2026-12-31',
      pesoKg: 56,
      alturaCm: 165,
      perimetros: {},
    })
    abrir(true)

    expect(screen.getByText(/56 kg/)).toBeTruthy()
  })
})

/**
 * La columna de la pieza E, dentro de esta misma tarjeta.
 *
 * Tres de estas cinco comprobaciones existen porque el fallo **no daría error**:
 * pedir 448 KB de vídeo al abrir Bienestar, aplicarle a la columna un `encaje`
 * que la saca del cuerpo, o estirar la pieza en un móvil. Ninguna de las tres se
 * ve desarrollando en un monitor.
 */
describe('la columna de la pieza E', () => {
  /** El alto que Tailwind da a cada clase `max-h-*`, en px. `max-h-60` = 15rem. */
  const MAX_H = { 'max-h-56': 224, 'max-h-60': 240, 'max-h-64': 256, 'max-h-72': 288 }
  const DPR = 3
  const ALTO_PIEZA = 720

  const columna = (c: HTMLElement) => c.querySelector('[aria-hidden="true"].overflow-hidden')

  it('con el formulario cerrado no se pide la pieza', () => {
    const { container } = abrir()

    // Abrir Bienestar no puede costar el vídeo de una tarjeta que nadie ha tocado.
    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('al pulsar «Registrar» aparece, y es la pieza E', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(container.querySelector('img')?.getAttribute('src')).toBe(direccion('E').poster)
    expect(container.querySelector('video')?.getAttribute('src')).toBe(direccion('E').video)
  })

  it('mira al cuerpo, no al centro geométrico', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // 61% es la ventana x=632..872, medida. El centro por defecto —50%— cae en la
    // parte apagada del plano, y ese cambio de una cifra no lo delata nada más.
    expect(container.querySelector('img')?.className).toContain('object-[61%_50%]')
  })

  it('NO lleva el `encaje` de E, que aquí sobra y desplaza la ventana', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // El catálogo lleva `origin-right scale-[1.213]` para quitar la columna negra
    // del 17,6% izquierdo. El recorte 1:3 ya empieza en x=632, muy a su derecha:
    // aplicarlo encima sacaría la ventana del cuerpo. Ver el comentario del
    // componente. Este test está para el día que alguien lo añada «porque falta».
    expect(direccion('E').encaje).toBeTruthy()
    expect(container.querySelector('img')?.className).not.toContain('scale-')
  })

  it('no se amplía: el tope es de ALTO y sale de la propia pieza', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // Cover sobre una caja alta y estrecha: la escala la manda el alto, no el
    // ancho. `alto_css * DPR` no puede pasar de los 720 px de la fuente.
    const clase = Object.keys(MAX_H).find((c) => columna(container)?.className.includes(c))
    expect(clase, 'la columna tiene que declarar un tope de alto').toBeTruthy()
    expect(MAX_H[clase as keyof typeof MAX_H] * DPR).toBeLessThanOrEqual(ALTO_PIEZA)
  })

  it('con movimiento reducido queda el póster y ni un vídeo', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(direccion('E').poster)
    vi.unstubAllGlobals()
  })
})
