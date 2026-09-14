/**
 * 🔴 NACE ROJO. Dos fallos del check-in que salieron de datos reales, no de una
 * auditoría: al leer el primer microciclo de una asesorada, su peso figuraba
 * como **70 kg**. Pesa 56.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 1 · UN VALOR POR DEFECTO SIN TOCAR SE GUARDA COMO SI FUERA UNA MEDICIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * `CheckinForm` siembra los steppers con `pesoInicial ?? 70` y `pasosInicial ??
 * 8000`, y después mete `pesoKg` y `pasos` en el objeto guardado SIEMPRE. Los
 * siete campos obligatorios son los cualitativos; los numéricos «ya traen
 * valor». Así que quien hace su primer check-in sin historial y no toca esos dos
 * selectores queda registrado con 70 kg y 8.000 pasos que nadie midió.
 *
 * `CheckinForm.peso-obsoleto.test.tsx` ya describía este mismo 70 —«no es un
 * placeholder gris: es un valor ya cargado en el campo, y se guarda tal cual»—
 * pero arregló solo la mitad: que el stepper adopte el peso real cuando llega.
 * Si no llega ninguno, el 70 sigue entrando en la base.
 *
 * El tipo lo permite: `CheckinDiario.pesoKg` es opcional. Un dato ausente y un
 * dato inventado no valen lo mismo, y es la misma regla que ya gobierna el
 * catálogo de alimentos y `grasaPct`, que devuelve `null` en vez de un número
 * cuando le falta una medida.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 2 · SE LE PIDE EL PESO A QUIEN DECIDIMOS NO PEDÍRSELO
 * ────────────────────────────────────────────────────────────────────────────
 * La migración 0018 apaga las cifras de composición corporal de quien tiene un
 * antecedente de conducta alimentaria. Esa decisión gobierna Nutrición entera,
 * pero **Bienestar tiene su propio campo de peso** y no lo cubre ningún
 * interruptor: la persona a la que le apagamos su porcentaje de grasa se
 * encuentra igualmente un selector de peso cinco veces por semana.
 *
 * Es el mismo agujero que ya tuvo «Mi plan» con `visibilidadDe(undefined)`: la
 * decisión existía y la pantalla no la consultaba.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

function marcarObligatorias() {
  fireEvent.click(screen.getByText('¿Cómo dormiste?').closest('fieldset')!.querySelectorAll('button')[2])
  fireEvent.click(screen.getByText('¿Cómo llegas hoy?').closest('fieldset')!.querySelectorAll('button')[0])
  fireEvent.click(screen.getByRole('button', { name: 'No' }))
}

const guardar = () => fireEvent.click(screen.getByRole('button', { name: /guardar check-in/i }))

describe('el check-in no inventa números', () => {
  afterEach(cleanup)

  it('en el primer check-in, sin historial, no guarda el peso de fábrica', () => {
    // Nadie ha tocado el selector: el 70 que se ve es una sugerencia, no un dato.
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-08-09" onGuardar={onGuardar} />)

    marcarObligatorias()
    guardar()

    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0].pesoKg).toBeUndefined()
  })

  it('en el primer check-in, sin historial, tampoco guarda los pasos de fábrica', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-08-09" onGuardar={onGuardar} />)

    marcarObligatorias()
    guardar()

    expect(onGuardar.mock.calls[0][0].pasos).toBeUndefined()
  })

  it('si toca el selector, el peso sí se guarda', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-08-09" onGuardar={onGuardar} />)
    fireEvent.click(screen.getByText('Más detalles (opcional)'))

    const stepper = screen.getByLabelText('Peso ayunas en kg')
    fireEvent.change(stepper, { target: { value: '56' } })
    fireEvent.blur(stepper)

    marcarObligatorias()
    guardar()

    expect(onGuardar.mock.calls[0][0].pesoKg).toBe(56)
  })

  it('con historial previo sigue guardando el último peso real', () => {
    // Esto NO cambia: lo que se corta es el número inventado, no el arrastre de
    // una medida que esa persona sí se hizo.
    const onGuardar = vi.fn()
    render(
      <CheckinForm usuarioId="u-ana" fecha="2026-08-09" pesoInicial={59.4} onGuardar={onGuardar} />,
    )

    marcarObligatorias()
    guardar()

    expect(onGuardar.mock.calls[0][0].pesoKg).toBe(59.4)
  })

  describe('a quien no ve su composición corporal', () => {
    it('no se le pide el peso', () => {
      render(
        <CheckinForm usuarioId="u-ana" fecha="2026-08-09" pedirPeso={false} onGuardar={vi.fn()} />,
      )
      fireEvent.click(screen.getByText('Más detalles (opcional)'))

      expect(screen.queryByLabelText('Peso ayunas en kg')).not.toBeInTheDocument()
    })

    it('y no se guarda su peso ni aunque haya historial', () => {
      const onGuardar = vi.fn()
      render(
        <CheckinForm
          usuarioId="u-ana"
          fecha="2026-08-09"
          pedirPeso={false}
          pesoInicial={56}
          onGuardar={onGuardar}
        />,
      )

      marcarObligatorias()
      guardar()

      expect(onGuardar.mock.calls[0][0].pesoKg).toBeUndefined()
    })

    it('pero sigue registrando todo lo demás', () => {
      // Apagarle el peso no puede costarle el check-in: sus pasos, su sueño y su
      // hambre son justo lo que sostiene su plan.
      const onGuardar = vi.fn()
      render(
        <CheckinForm usuarioId="u-ana" fecha="2026-08-09" pedirPeso={false} onGuardar={onGuardar} />,
      )

      marcarObligatorias()
      guardar()

      const guardado = onGuardar.mock.calls[0][0]
      expect(guardado.calidadSueno).toBe('BUENA')
      expect(guardado.horasSueno).toBe(7)
    })
  })
})
