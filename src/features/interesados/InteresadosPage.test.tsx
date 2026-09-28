/**
 * La pantalla pública de interesados (`/interesados?codigo=XXXX`):
 *   - toma el código de la URL normalizado (mayúsculas, sin espacios);
 *   - no tiene ningún campo de texto libre: solo botones;
 *   - no pide ningún dato de salud, marque lo que marque en las casillas;
 *   - no envía nada sin las cuatro casillas y la declaración, y cuando envía, la
 *     evidencia de la autorización queda guardada.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { guardadoEnDemo, vaciarDemo } from '../../data/interesados/enviarInteresado'
import InteresadosPage from './InteresadosPage'

function montar(url = '/interesados?codigo=%20Pruebac%201%20') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <InteresadosPage />
    </MemoryRouter>,
  )
}

function tocar(nombre: string) {
  fireEvent.click(screen.getByRole('button', { name: nombre }))
}

function contestarEncaje() {
  tocar('3 días')
  tocar('Mis horarios cambian')
  tocar('Gimnasio')
  tocar('Acompañamiento en línea')
  tocar('Ganar fuerza')
}

function marcarCasillas(valores: Record<'A' | 'B' | 'C' | 'D', 'Sí' | 'No'>) {
  for (const [letra, valor] of Object.entries(valores)) {
    const grupo = screen.getByRole('group', { name: `Casilla ${letra}` })
    fireEvent.click(Array.from(grupo.querySelectorAll('button')).find((b) => b.textContent === valor)!)
  }
}

beforeEach(() => vaciarDemo())

describe('el código de la URL', () => {
  it('se muestra normalizado: sin espacios y en mayúsculas', () => {
    montar()
    expect(screen.getByText('PRUEBAC1')).toBeInTheDocument()
  })

  it('un código con forma rara no se muestra ni se guarda', async () => {
    montar('/interesados?codigo=pruébac-1')
    expect(screen.queryByText(/código:/i)).not.toBeInTheDocument()
    contestarEncaje()
    marcarCasillas({ A: 'No', B: 'No', C: 'No', D: 'No' })
    tocar('Acepto la declaración')
    tocar('Enviar')
    await screen.findByRole('status')
    expect(guardadoEnDemo().encaje[0].codigo).toBeNull()
  })
})

describe('sin texto libre y sin salud', () => {
  it('no hay ni un campo de texto: solo botones', () => {
    const { container } = montar()
    expect(container.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0)
  })

  it('marcar las casillas de salud en «Sí» no abre ninguna pregunta de salud', () => {
    const { container } = montar()
    const antes = container.querySelectorAll('button').length
    marcarCasillas({ A: 'Sí', B: 'Sí', C: 'Sí', D: 'Sí' })
    expect(container.querySelectorAll('button').length).toBe(antes)
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0)
    expect(screen.queryByText(/lesi[oó]n(es)? (tienes|te duele)|qu[eé] medicaci[oó]n tomas|cu[aá]nto pesas/i)).toBeNull()
  })

  it('avisa de que el formulario no pide datos de salud', () => {
    montar()
    expect(screen.getByText(/no te pedimos datos de salud en este formulario/i)).toBeInTheDocument()
  })
})

describe('la autorización', () => {
  it('nada viene marcado de antemano', () => {
    montar()
    for (const letra of ['A', 'B', 'C', 'D']) {
      const grupo = screen.getByRole('group', { name: `Casilla ${letra}` })
      for (const b of Array.from(grupo.querySelectorAll('button'))) expect(b).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('sin las casillas y la declaración no se envía, y se dice qué falta', () => {
    montar()
    contestarEncaje()
    tocar('Enviar')
    expect(screen.getByRole('alert')).toHaveTextContent(/casilla A.*casilla D.*declaración/)
    expect(guardadoEnDemo().encaje).toHaveLength(0)
    expect(guardadoEnDemo().autorizaciones).toHaveLength(0)
  })

  it('al enviar, la evidencia queda guardada con la versión, la fecha y las casillas marcadas', async () => {
    montar('/interesados?codigo=pruebac1&cliente=PRUEBA-002')
    contestarEncaje()
    marcarCasillas({ A: 'Sí', B: 'No', C: 'No', D: 'Sí' })
    tocar('Acepto la declaración')
    tocar('Enviar')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/recibimos tus respuestas/i))

    const { encaje, autorizaciones } = guardadoEnDemo()
    expect(encaje).toEqual([
      expect.objectContaining({
        codigo: 'PRUEBAC1',
        cliente_id: 'PRUEBA-002',
        p1_dias: '3',
        p1_horarios: 'cambian',
        p2_lugar: 'gimnasio',
        p2_modalidad: 'en línea',
        p3_expectativa: 'fuerza',
      }),
    ])
    expect(autorizaciones).toEqual([
      expect.objectContaining({
        envio_id: encaje[0].envio_id,
        version_autorizacion: '0.3',
        canal: 'formulario',
        casilla_a: 'si',
        casilla_b: 'no',
        casilla_c: 'no',
        casilla_d: 'si',
        declaracion_aceptada: true,
        fecha_hora: expect.any(String),
      }),
    ])
  })
})
