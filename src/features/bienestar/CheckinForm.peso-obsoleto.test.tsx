/**
 * ⚠️ ESTE TEST FALLA A PROPÓSITO. Documenta un fallo REAL que NO está arreglado
 * (auditoría de carreras y estado compartido, 2026-07-27).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL FALLO
 * ────────────────────────────────────────────────────────────────────────────
 * `CheckinForm.tsx:54-55` siembra los steppers con
 *
 *     const [pesoKg, setPesoKg] = useState(pesoInicial ?? 70)
 *     const [pasos, setPasos]   = useState(pasosInicial ?? 8000)
 *
 * `pesoInicial` sale de `BienestarPage.tsx:69`, que lo calcula sobre
 * `db.bienestar` y se re-renderiza con `useDbVersion()` cada vez que llega una
 * hidratación. Pero el inicializador de `useState` solo corre en el PRIMER
 * montaje: si el peso real llega después, el formulario sigue mostrando el 70
 * de fábrica y no hay ningún efecto que lo resincronice (compárese con
 * `Stepper.tsx:38-40`, que sí lo hace bien con su propio texto).
 *
 * El 70 no es un placeholder gris: es un valor ya cargado en el campo, y el
 * peso NO es obligatorio para guardar (`CheckinForm.tsx:69-70` solo exige los
 * siete cualitativos). Se guarda tal cual.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ LE PASA A LA PERSONA QUE ENTRENA
 * ────────────────────────────────────────────────────────────────────────────
 * Abre la app en el vestuario, con mala señal. La sesión entra con los datos
 * locales que hubiera (`SessionProvider.tsx:85-90` deja pasar aunque falle la
 * red), así que Bienestar se pinta sin su historial y el peso arranca en 70 kg.
 * Al salir del gimnasio recupera cobertura, la app rehidrata y su historial
 * aparece —pesa 59.4— pero el stepper del check-in que tiene abierto sigue
 * marcando 70. Rellena los siete campos de ánimo, guarda, y el coach ve un
 * salto de +10 kg en un día. Con eso se decide su superávit o su déficit.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

const GRUPOS = [
  '¿Cómo estuvo tu rendimiento?',
  'Motivación',
  'Hambre',
  'Cansancio',
  'Estrés',
  'Calidad del sueño',
  '¿Cómo estuvo tu alimentación?',
]

function marcarLosSieteCualitativos() {
  for (const titulo of GRUPOS) {
    const fieldset = screen.getByText(titulo).closest('fieldset') as HTMLElement
    const opciones = within(fieldset).getAllByRole('button')
    fireEvent.click(opciones[opciones.length - 1])
  }
}

describe('el peso sembrado en el check-in', () => {
  afterEach(cleanup)

  it('debe actualizarse cuando el historial real llega después de abrir el formulario', () => {
    const { rerender } = render(
      <CheckinForm usuarioId="u-ana" fecha="2026-07-27" onGuardar={vi.fn()} />,
    )
    // Sin historial local todavía: el formulario arranca con el 70 de fábrica.
    expect(screen.getByLabelText('Peso ayunas en kg')).toHaveValue('70')

    // Vuelve la cobertura y la hidratación trae su último peso real.
    rerender(
      <CheckinForm usuarioId="u-ana" fecha="2026-07-27" pesoInicial={59.4} onGuardar={vi.fn()} />,
    )

    expect(screen.getByLabelText('Peso ayunas en kg')).toHaveValue('59.4')
  })

  it('no debe guardar el peso de fábrica cuando ya se conoce el real', () => {
    const onGuardar = vi.fn()
    const { rerender } = render(
      <CheckinForm usuarioId="u-ana" fecha="2026-07-27" onGuardar={onGuardar} />,
    )
    rerender(
      <CheckinForm usuarioId="u-ana" fecha="2026-07-27" pesoInicial={59.4} onGuardar={onGuardar} />,
    )

    // Rellena los siete cualitativos obligatorios y guarda.
    marcarLosSieteCualitativos()
    fireEvent.click(screen.getByRole('button', { name: /guardar check-in/i }))

    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0].pesoKg).toBe(59.4)
  })
})
