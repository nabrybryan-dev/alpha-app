import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CifrasAsesoradosPage from './CifrasAsesoradosPage'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db, hoyIso } from '../../data/dbInstance'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'

/**
 * El puesto de la nutricionista. Lo que se prueba: que llegue a la decisión,
 * que la vea con las cifras delante, y que el asesorado no pueda entrar.
 */

const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <CifrasAsesoradosPage />
      </SessionProvider>
    </MemoryRouter>,
  )

/** Deja a Valentina con una señal: ciclo irregular. */
const conSenal = () =>
  db.perfilNutricion.guardar('u-valentina', { cicloMenstrual: 'irregular' }, true)

const comoStaff = () => localStorage.setItem('alpha-usuario', 'u-bryan')

/** Todo lo que las fórmulas necesitan, para que salga masa magra y con ella la energía. */
const PERFIL_COMPLETO = {
  genero: 'M',
  fechaNacimiento: '1996-05-10',
  pesoKg: 60,
  alturaCm: 165,
  cuelloCm: 32,
  cinturaCm: 72,
  caderaCm: 96,
  pasosDiarios: 8000,
  diasEntreno: 4,
}

/** La fecha de hace N días, con la misma aritmética que usa la pantalla. */
const hace = (dias: number): string => {
  const d = new Date(`${hoyIso()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

/** Un almuerzo con kcal de verdad, del catálogo empaquetado. */
const registrarAlmuerzo = (fecha: string) => {
  const [arroz] = catalogoRepo.buscar('arroz')
  const comidaId = db.registroComidas.abrirComida({
    usuarioId: 'u-valentina',
    momentoIso: `${fecha}T12:00:00.000Z`,
    comida: 'almuerzo',
    cocinadoPorEl: true,
    aceiteG: 0,
    salG: 0,
    confianza: 'estimado',
  })
  db.registroComidas.agregarItem('u-valentina', comidaId, {
    alimentoId: arroz.id,
    gramos: 300,
    fuePesado: false,
    estadoAsumido: 'cocido',
  })
}

/** Un check-in que dice que ese día entrenó. Sin duración: el check-in no la pregunta. */
const entrenoEl = (fecha: string) =>
  db.bienestar.guardar({ id: `c-${fecha}`, usuarioId: 'u-valentina', fecha, entreno: 'Pierna A' })

/** El mismo check-in diciendo que no entrenó. Se guarda por fecha: pisa al del seed. */
const descansoEl = (fecha: string) =>
  db.bienestar.guardar({ id: `c-${fecha}`, usuarioId: 'u-valentina', fecha, entreno: 'Descanso' })

const fichaDe = async (nombre: RegExp) => {
  const boton = screen.getByRole('button', { name: nombre })
  await userEvent.click(boton)
  return within(boton.closest('div') as HTMLElement)
}

describe('CifrasAsesoradosPage', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    comoStaff()
  })

  it('un asesorado no entra aquí', () => {
    localStorage.setItem('alpha-usuario', 'u-valentina')
    const { container } = pintar()
    expect(container).toBeEmptyDOMElement()
  })

  it('lista la cartera', () => {
    pintar()
    expect(screen.getByText(/tu cartera|los demás/i)).toBeInTheDocument()
  })

  describe('los que esperan decisión', () => {
    it('van arriba, en su propio bloque', () => {
      // Quien entra aquí lo hace para resolver algo: tiene que estar donde cae
      // el ojo, no en una columna de una lista alfabética.
      conSenal()
      pintar()
      expect(screen.getByText(/esperan tu decisión · 1/i)).toBeInTheDocument()
    })

    it('dicen por qué, para no tener que adivinarlo', () => {
      conSenal()
      pintar()
      expect(screen.getByText(/ciclo menstrual irregular o ausente/i)).toBeInTheDocument()
    })

    it('sin señales, nadie espera nada', () => {
      pintar()
      expect(screen.queryByText(/esperan tu decisión/i)).not.toBeInTheDocument()
    })
  })

  describe('la ficha', () => {
    it('enseña las cifras COMPLETAS, aunque el asesorado no las vea', async () => {
      // Decidir si alguien debe ver su porcentaje sin verlo sería decidir a
      // ciegas.
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByText('Grasa')).toBeInTheDocument()
      expect(ficha.getByText('TDEE')).toBeInTheDocument()
    })

    it('trae los tres interruptores', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByRole('switch', { name: /composición corporal/i })).toBeInTheDocument()
      expect(ficha.getByRole('switch', { name: /objetivo calórico/i })).toBeInTheDocument()
      expect(ficha.getByRole('switch', { name: /contador del diario/i })).toBeInTheDocument()
    })

    it('por defecto están encendidos', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByRole('switch', { name: /composición corporal/i })).toBeChecked()
    })

    it('apagar uno lo guarda', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /composición corporal/i }))

      expect(db.visibilidad.byUsuario('u-valentina')?.verComposicion).toBe(false)
    })

    it('tocar cualquier interruptor cuenta como haberlo mirado', async () => {
      // Deja de estar en espera aunque la señal que lo trajo siga ahí.
      conSenal()
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /contador del diario/i }))

      expect(db.visibilidad.byUsuario('u-valentina')?.estado).toBe('decidido')
    })

    it('queda constancia de quién decidió', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /objetivo calórico/i }))

      const guardada = db.visibilidad.byUsuario('u-valentina')
      expect(guardada?.decididoPor).toBe('u-bryan')
      expect(guardada?.decididoEn).toBeTruthy()
    })

    it('quien no ha respondido la encuesta no tiene nada que decidir', async () => {
      pintar()
      // Mateo no la respondió en el seed.
      const ficha = await fichaDe(/mateo/i)
      expect(ficha.getByText(/todavía no ha respondido/i)).toBeInTheDocument()
      expect(ficha.queryByRole('switch')).not.toBeInTheDocument()
    })
  })

  /**
   * El gasto de entrenar, descontado de verdad.
   *
   * Contarlo como CERO no era un hueco cosmético: la disponibilidad salía más
   * alta de lo real y la alerta se callaba justo en quien entrenó y no comió.
   * Lo que se fija aquí es que el descuento llegue a la pantalla y que diga de
   * dónde sale, porque un gasto estimado y uno medido no se leen igual.
   */
  describe('el gasto de entrenamiento', () => {
    beforeEach(() => {
      db.perfilNutricion.guardar('u-valentina', PERFIL_COMPLETO, true)
      for (let i = 1; i <= 4; i += 1) registrarAlmuerzo(hace(i))
    })

    it('se descuenta y se enseña con su procedencia', async () => {
      for (let i = 1; i <= 3; i += 1) entrenoEl(hace(i))
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByText(/Menos/)).toBeInTheDocument()
      expect(ficha.getByText(/kcal\/día/)).toBeInTheDocument()
    })

    it('ya no declara que cuenta como cero', async () => {
      for (let i = 1; i <= 3; i += 1) entrenoEl(hace(i))
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.queryByText(/cuenta como cero/i)).not.toBeInTheDocument()
    })

    // Sin duración registrada el cálculo usa un suelo, y quedarse corto en el
    // gasto sube la disponibilidad y suaviza la alerta. Hay que poder verlo.
    it('avisa cuando el entreno no traía duración', async () => {
      for (let i = 1; i <= 3; i += 1) entrenoEl(hace(i))
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByText(/sin duración registrada/i)).toBeInTheDocument()
    })

    it('sin ningún entreno anotado lo dice, en vez de callarse el cero', async () => {
      // El seed le pone entrenos; aquí se sobrescriben con descanso, que es la
      // respuesta «no entrené» y no un hueco.
      for (let i = 1; i <= 14; i += 1) descansoEl(hace(i))
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByText(/No consta ningún entreno/i)).toBeInTheDocument()
    })
  })
})
