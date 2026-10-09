import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PautadoVsHechoMicrociclo, SituacionPautado } from '../../../domain/pautadoVsHecho'
import { SeccionPautadoVsHecho } from './SeccionPautadoVsHecho'

function fila(
  numero: number,
  s: [number, number],
  v: [number, number],
  situacion: SituacionPautado = 'con-datos',
  extra: Partial<PautadoVsHechoMicrociclo> = {},
): PautadoVsHechoMicrociclo {
  const pct = (h: number, p: number) => (p > 0 ? Math.round((h / p) * 100) : undefined)
  return {
    id: `m-${numero}`,
    numero,
    fechaInicio: '2026-09-01',
    estado: 'cerrado',
    situacion,
    series: { pautado: s[0], hecho: s[1], cumplimientoPct: pct(s[1], s[0]) },
    volumen: { pautado: v[0], hecho: v[1], cumplimientoPct: pct(v[1], v[0]) },
    ejerciciosSinCarga: 0,
    ...extra,
  }
}

const FILAS = [
  fila(1, [60, 58], [12000, 11500]),
  fila(2, [64, 0], [13000, 0], 'sin-registros'),
  fila(3, [64, 70], [13500, 15250], 'con-datos', { estado: 'activo' }),
]

const escena = () => screen.getByTestId('escena-giro')
const giro = () => Number(escena().getAttribute('data-giro'))
const inclinacion = () => Number(escena().getAttribute('data-inclinacion'))

/** El movimiento reducido hace que los giros sean inmediatos y las cifras salgan ya contadas. */
function pedirMenosMovimiento(reducido: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reducido,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('SeccionPautadoVsHecho', () => {
  beforeEach(() => pedirMenosMovimiento(true))
  afterEach(() => {
    // jsdom no trae matchMedia: se deja como estaba.
    Reflect.deleteProperty(window, 'matchMedia')
  })

  it('sin semanas cargadas lo dice en una frase', () => {
    render(<SeccionPautadoVsHecho filas={[]} />)
    expect(screen.getByText(/no hay semanas cargadas/)).toBeInTheDocument()
    expect(screen.queryByTestId('escena-giro')).toBeNull()
  })

  it('escribe el número exacto sobre cada barra (pautado y hecho) y el eje empieza en cero', () => {
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const semana1 = escena().querySelector('[data-microciclo="1"]')!
    expect(semana1.querySelector('[data-barra="pautado"]')).toHaveTextContent('60')
    expect(semana1.querySelector('[data-barra="hecho"]')).toHaveTextContent('58')
    const semana3 = escena().querySelector('[data-microciclo="3"]')!
    expect(semana3.querySelector('[data-barra="hecho"]')).toHaveTextContent('70')
    // La marca del cero está en el eje.
    expect(within(escena()).getByText('0')).toBeInTheDocument()
  })

  it('una semana sin registros dice «sin registros» y NO dibuja una barra en cero', () => {
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const semana2 = escena().querySelector('[data-microciclo="2"]')!
    expect(semana2).toHaveTextContent('sin registros')
    expect(semana2.querySelector('[data-barra]')).toBeNull()
    expect(semana2.querySelectorAll('polygon')).toHaveLength(0)
    // Las que sí tienen datos dibujan polígonos.
    expect(escena().querySelector('[data-microciclo="1"]')!.querySelectorAll('polygon').length).toBeGreaterThan(0)
  })

  it('la tabla trae EXACTAMENTE los mismos números que las barras', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await user.click(screen.getByText('Ver los números'))
    const tabla = screen.getByRole('table')
    for (const f of FILAS.filter((x) => x.situacion === 'con-datos')) {
      const g = escena().querySelector(`[data-microciclo="${f.numero}"]`)!
      const enBarras = [
        g.querySelector('[data-barra="pautado"]')!.textContent,
        g.querySelector('[data-barra="hecho"]')!.textContent,
      ]
      const celdas = within(within(tabla).getByRole('rowheader', { name: String(f.numero) }).closest('tr')!).getAllByRole('cell')
      expect([celdas[0].textContent, celdas[1].textContent]).toEqual(enBarras)
    }
    // El volumen, con punto de miles como en el resto de la app.
    expect(within(tabla).getByText('15.250')).toBeInTheDocument()
    // Y la semana sin registros lo dice en la tabla también.
    const fila2 = within(tabla).getByRole('rowheader', { name: '2' }).closest('tr')!
    expect(fila2).toHaveTextContent('sin registros')
  })

  it('el conmutador cambia de series a volumen, sin mezclar las escalas', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    expect(escena().querySelector('[data-microciclo="3"] [data-barra="hecho"]')).toHaveTextContent('70')
    await user.click(screen.getByRole('button', { name: 'Volumen' }))
    expect(escena().querySelector('[data-microciclo="3"] [data-barra="hecho"]')).toHaveTextContent('15.250')
    expect(escena()).toHaveAccessibleName(/kg·rep/)
    expect(screen.getByRole('button', { name: 'Volumen' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('los botones ← y → giran la escena, y el giro tiene tope', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const inicial = giro()
    await user.click(screen.getByRole('button', { name: 'Girar la escena a la izquierda' }))
    await waitFor(() => expect(giro()).toBe(inicial + 12))
    await user.click(screen.getByRole('button', { name: 'Girar la escena a la derecha' }))
    await user.click(screen.getByRole('button', { name: 'Girar la escena a la derecha' }))
    await waitFor(() => expect(giro()).toBe(inicial - 12))
    for (let i = 0; i < 10; i++) {
      const derecha = screen.getByRole('button', { name: 'Girar la escena a la derecha' })
      if (!(derecha as HTMLButtonElement).disabled) await user.click(derecha)
    }
    expect(giro()).toBe(-50)
    expect(screen.getByRole('button', { name: 'Girar la escena a la derecha' })).toBeDisabled()
  })

  it('«Vista plana» pone la escena de frente (sin giro ni inclinación) y vuelve a 3D con el mismo botón', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    expect(inclinacion()).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Vista plana' }))
    await waitFor(() => expect(giro()).toBe(0))
    expect(inclinacion()).toBe(0)
    // De frente no hay tapas ni costados: solo la cara frontal de cada barra (pautado y hecho).
    expect(escena().querySelectorAll('[data-microciclo="1"] polygon')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Vista en 3D' }))
    await waitFor(() => expect(inclinacion()).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: 'Vista plana' })).toBeInTheDocument()
  })

  it('arrastrar de lado gira la escena', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const antes = giro()
    await user.pointer([
      { keys: '[MouseLeft>]', target: escena(), coords: { clientX: 200, clientY: 100 } },
      { target: escena(), coords: { clientX: 120, clientY: 100 } },
      { keys: '[/MouseLeft]', target: escena(), coords: { clientX: 120, clientY: 100 } },
    ])
    expect(giro()).not.toBe(antes)
  })

  it('tocar una barra la resalta y enseña sus números exactos y su cumplimiento', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const botones = within(escena()).getAllByRole('button')
    const semana1 = botones.find((b) => b.getAttribute('data-microciclo') === '1')!
    // Por omisión se resalta la última semana con datos (la 3).
    expect(botones.find((b) => b.getAttribute('data-microciclo') === '3')).toHaveAttribute('aria-pressed', 'true')
    await user.click(semana1)
    expect(semana1).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('97 % de las series que te pedimos')).toBeInTheDocument()
    expect(screen.getByText(/te pedimos 60 · hiciste 58/)).toBeInTheDocument()
  })

  it('con más semanas de las que caben, se recorren con «anteriores / siguientes»', async () => {
    const muchas = Array.from({ length: 20 }, (_, i) => fila(i + 1, [60, 50], [1000, 900]))
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={muchas} />)
    expect(screen.getByRole('button', { name: /Siguientes/ })).toBeDisabled()
    expect(escena().querySelector('[data-microciclo="20"]')).not.toBeNull()
    expect(escena().querySelector('[data-microciclo="1"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Semanas anteriores/ }))
    expect(escena().querySelector('[data-microciclo="1"]')).not.toBeNull()
    expect(escena().querySelector('[data-microciclo="20"]')).toBeNull()
  })

  it('avisa de los ejercicios que no cuentan en el volumen por no llevar kilos', () => {
    render(<SeccionPautadoVsHecho filas={[fila(1, [10, 10], [500, 500], 'con-datos', { ejerciciosSinCarga: 2 })]} />)
    expect(screen.getByText(/2 ejercicios no cuentan en el volumen/)).toBeInTheDocument()
  })
})
