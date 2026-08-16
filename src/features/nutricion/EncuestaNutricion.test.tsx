import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EncuestaNutricion } from './EncuestaNutricion'
import type { Respuestas } from '../../domain/nutricion/encuesta'

/** Lo que trae alguien que ya respondió la encuesta de captación. */
const CON_JSON: Respuestas = {
  genero: 'M',
  fechaNacimiento: '2004-05-06',
  pesoKg: 56,
  alturaCm: 170,
  cuelloCm: 32,
  cinturaCm: 68,
  caderaCm: 99,
  diasEntreno: 5,
  alergias: ['ninguna'],
  condicionesMedicas: ['ninguna'],
  excluye: ['nada'],
  comeVisceras: 'no',
  noLeGustan: '-',
  lugarCompra: 'supermercado',
  frecuenciaCocina: 'casi_siempre',
  sinAcceso: '-',
  tieneBascula: 'si',
  cicloMenstrual: 'regular',
}

const pintar = (yaSabidos: Respuestas = {}, enCurso: Respuestas = {}) => {
  const onGuardarAvance = vi.fn()
  const onTerminar = vi.fn()
  render(
    <EncuestaNutricion
      yaSabidos={yaSabidos}
      enCurso={enCurso}
      onGuardarAvance={onGuardarAvance}
      onTerminar={onTerminar}
    />,
  )
  return { onGuardarAvance, onTerminar }
}

describe('EncuestaNutricion', () => {
  it('a quien llega con la encuesta de captación le pide solo lo que esa no trae', () => {
    // Eran los pasos y nada más hasta el 2026-08-09, cuando entró la pregunta
    // del embarazo: la encuesta de captación tampoco la trae. El 2026-08-16
    // entraron las dos de la despensa —cada cuánto compra y de quién es— que la
    // captación tampoco trae, así que son cuatro.
    //
    // Si este número sube otra vez, que sea a sabiendas: cada pregunta es una
    // que el asesorado puede abandonar a la mitad, y esta pantalla es la que le
    // tapa sus cifras hasta que la termine.
    pintar(CON_JSON)
    expect(screen.getByText(/cuéntanos 4 cosas sobre ti/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cuántos pasos caminas/i)).toBeInTheDocument()
    expect(screen.getByText(/¿estás embarazada o en lactancia\?/i)).toBeInTheDocument()
    expect(screen.getByText(/cada cuánto haces mercado/i)).toBeInTheDocument()
  })

  it('cuando solo falta una, el titular va en singular', () => {
    // La copia cambia con el número y es fácil romperla al añadir preguntas:
    // "Cuéntanos 1 cosas sobre ti" es justo lo que este test impide.
    //
    // Hay que contestar TODO lo demás para dejar una sola pendiente. Antes
    // bastaba con el embarazo; desde las dos de la despensa hacen falta tres.
    pintar({ ...CON_JSON, embarazo: 'no', cicloCompra: '8', despensaEs: 'solo_yo' })
    expect(screen.getByText(/nos falta un dato tuyo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cuántos pasos caminas/i)).toBeInTheDocument()
  })

  it('a quien no sabemos nada le pide todo lo que aplica', () => {
    pintar()
    expect(screen.getByText(/cuéntanos \d+ cosas sobre ti/i)).toBeInTheDocument()
  })

  it('enseña POR QUÉ se pregunta cada cosa', () => {
    // Nadie contesta bien lo que no entiende, y una pregunta sin motivo se
    // responde por salir del paso.
    pintar(CON_JSON)
    expect(screen.getByText(/230 kcal de diferencia/i)).toBeInTheDocument()
  })

  describe('lo que depende de otras respuestas', () => {
    it('la cadera aparece al marcar Mujer, sin recargar nada', async () => {
      pintar()
      expect(screen.queryByLabelText(/perímetro de la cadera/i)).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Mujer' }))

      expect(screen.getByLabelText(/perímetro de la cadera/i)).toBeInTheDocument()
      expect(screen.getByText(/cómo es tu ciclo menstrual/i)).toBeInTheDocument()
    })

    it('a un hombre no se le pide ni la cadera ni el ciclo', async () => {
      pintar()
      await userEvent.click(screen.getByRole('button', { name: 'Hombre' }))

      expect(screen.queryByLabelText(/perímetro de la cadera/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/ciclo menstrual/i)).not.toBeInTheDocument()
    })
  })

  describe('guardar a medias', () => {
    it('cada respuesta se guarda al momento, no al final', async () => {
      // La encuesta es la puerta de entrada a Nutrición: perder el avance de
      // alguien que abandona en la pregunta doce es perder a la persona.
      const { onGuardarAvance } = pintar(CON_JSON)
      await userEvent.type(screen.getByLabelText(/cuántos pasos/i), '9000')
      expect(onGuardarAvance).toHaveBeenCalled()
    })

    it('retoma lo que ya llevaba respondido', () => {
      pintar(CON_JSON, { pasosDiarios: 9000 })
      expect(screen.getByLabelText(/cuántos pasos/i)).toHaveValue(9000)
    })
  })

  describe('al terminar', () => {
    it('no deja seguir con lo obligatorio en blanco', async () => {
      const { onTerminar } = pintar(CON_JSON)
      await userEvent.click(screen.getByRole('button', { name: /listo/i }))

      expect(onTerminar).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('avisa dónde está el problema, no solo que lo hay', async () => {
      pintar(CON_JSON)
      await userEvent.click(screen.getByRole('button', { name: /listo/i }))
      expect(screen.getByText('Falta responder')).toBeInTheDocument()
    })

    it('con todo respondido, entrega las respuestas', async () => {
      const { onTerminar } = pintar(CON_JSON)
      await userEvent.type(screen.getByLabelText(/cuántos pasos/i), '9000')
      await userEvent.click(screen.getByRole('button', { name: /listo/i }))

      expect(onTerminar).toHaveBeenCalledWith({ pasosDiarios: 9000 })
    })

    it('un número fuera de rango se marca con su límite', async () => {
      pintar(CON_JSON)
      await userEvent.type(screen.getByLabelText(/cuántos pasos/i), '90000')
      await userEvent.click(screen.getByRole('button', { name: /listo/i }))

      expect(screen.getByText(/máximo 40000/i)).toBeInTheDocument()
    })
  })

  describe('las respuestas múltiples', () => {
    /** "Ninguna" sale en varias preguntas; hay que mirar dentro de la de alergias. */
    const alergias = () => {
      const etiqueta = screen.getByText(/tienes alguna alergia/i)
      return within(etiqueta.closest('div') as HTMLElement)
    }

    it('"Ninguna" descarta el resto: no se puede tener y no tener alergias', async () => {
      pintar({ genero: 'H' })
      await userEvent.click(alergias().getByRole('button', { name: 'Lácteos' }))
      await userEvent.click(alergias().getByRole('button', { name: 'Ninguna' }))

      expect(alergias().getByRole('button', { name: 'Lácteos' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('y marcar una concreta quita el "Ninguna"', async () => {
      pintar({ genero: 'H' })
      await userEvent.click(alergias().getByRole('button', { name: 'Ninguna' }))
      await userEvent.click(alergias().getByRole('button', { name: 'Gluten' }))

      expect(alergias().getByRole('button', { name: 'Ninguna' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(alergias().getByRole('button', { name: 'Gluten' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })
})
