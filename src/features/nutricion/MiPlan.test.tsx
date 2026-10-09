import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MiPlan from './MiPlan'
import DiarioDia from './DiarioDia'
import { CompuertaNutricion } from './CompuertaNutricion'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db } from '../../data/dbInstance'

/**
 * Lo que separa esta vista de una hoja de cálculo bonita es el `+` de cada
 * alimento: lleva el plan al diario ya escrito. Eso es lo que se prueba aquí.
 */

const pintar = () =>
  render(
    <MemoryRouter initialEntries={['/nutricion/plan']}>
      <SessionProvider>
        <CompuertaNutricion>
          <Routes>
            <Route path="/nutricion" element={<DiarioDia />} />
            <Route path="/nutricion/plan" element={<MiPlan />} />
          </Routes>
        </CompuertaNutricion>
      </SessionProvider>
    </MemoryRouter>,
  )

const irA = (seccion: string) => userEvent.click(screen.getByRole('button', { name: seccion }))

describe('MiPlan', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })
  afterEach(() => vi.restoreAllMocks())

  it('abre por su perfil: es lo que acaba de ganarse respondiendo', () => {
    // El diseño abría por "Contexto", pero se escribió cuando no existía la
    // sección de perfil. Quien acaba de contestar diecinueve preguntas merece
    // ver sus cifras primero; el porqué del plan sigue a un toque.
    pintar()
    expect(screen.getByText(/tu perfil/i)).toBeInTheDocument()
  })

  it('el contexto sigue estando, a un toque', async () => {
    pintar()
    await irA('Contexto')
    expect(screen.getByText(/antes de los números/i)).toBeInTheDocument()
  })

  it('explica por qué las calorías ondulan', async () => {
    pintar()
    await irA('Ondulación')
    expect(screen.getByText(/la proteína no se mueve nunca/i)).toBeInTheDocument()
  })

  it('los tres tipos de día con sus calorías', async () => {
    pintar()
    await irA('Ondulación')
    expect(screen.getByText('2.100')).toBeInTheDocument()
    expect(screen.getByText('1.750')).toBeInTheDocument()
  })

  it('avisa de que el peso se pesa en el estado que dice la etiqueta', async () => {
    pintar()
    await irA('Menús')
    expect(screen.getByText(/si dice cocido, se pesa cocido/i)).toBeInTheDocument()
  })

  it('los intercambios recuerdan que se cambia dentro del grupo', async () => {
    pintar()
    await irA('Intercambios')
    expect(screen.getByText(/dentro del grupo, no entre grupos/i)).toBeInTheDocument()
  })

  describe('el + que lleva al diario', () => {
    it('abre el buscador con el nombre ya escrito', async () => {
      pintar()
      await irA('Menús')
      await userEvent.click(screen.getByRole('button', { name: /registrar 150 g pechuga de pollo/i }))

      expect(screen.getByLabelText('Nombre del alimento')).toHaveValue('pechuga de pollo')
    })

    it('lleva también los gramos que pauta el plan', async () => {
      pintar()
      await irA('Menús')
      await userEvent.click(screen.getByRole('button', { name: /registrar 150 g pechuga de pollo/i }))

      const fila = screen
        .getAllByRole('button', { name: /kcal\/100 g/i })
        .find((b) => /pechuga/i.test(b.textContent ?? ''))
      if (!fila) throw new Error('el catálogo no trajo ninguna pechuga')
      await userEvent.click(fila)

      expect(screen.getByLabelText('Cantidad en g')).toHaveValue('150')
    })

    it('lo manda a la comida que dice el menú, no siempre al almuerzo', async () => {
      pintar()
      await irA('Menús')
      // "70 g avena" vive bajo "Desayuno · overnight oats".
      await userEvent.click(screen.getByRole('button', { name: /registrar 70 g avena/i }))

      const fila = screen
        .getAllByRole('button', { name: /kcal\/100 g/i })
        .find((b) => /avena/i.test(b.textContent ?? ''))
      if (!fila) throw new Error('el catálogo no trajo avena')
      await userEvent.click(fila)

      expect(screen.getByRole('button', { name: /agregar a desayuno/i })).toBeInTheDocument()
    })

    it('cuando el plan no dice el peso, no se lo inventa', async () => {
      // "1 banano" no son 100 ni 120 g. La hoja arranca en su valor por defecto
      // y el asesorado decide, en vez de heredar un número inventado.
      pintar()
      await irA('Menús')
      await userEvent.click(screen.getByRole('button', { name: /registrar 1 banano/i }))

      const fila = screen
        .getAllByRole('button', { name: /kcal\/100 g/i })
        .find((b) => /banano/i.test(b.textContent ?? ''))
      if (!fila) throw new Error('el catálogo no trajo banano')
      await userEvent.click(fila)

      expect(screen.getByLabelText('Cantidad en g')).toHaveValue('100')
    })
  })

  it('la compuerta también cubre Mi plan: no se entra por la URL', () => {
    // Cuando la compuerta vivía solo en el diario, se llegaba aquí saltándosela
    // y la pantalla enseñaba cifras vacías con aspecto de cifras.
    localStorage.setItem('alpha-usuario', 'u-mateo')
    pintar()
    expect(screen.getByText(/antes de empezar/i)).toBeInTheDocument()
    expect(screen.queryByText(/tu plan nutricional/i)).not.toBeInTheDocument()
  })

  it('vuelve al diario', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /volver al diario/i }))
    expect(screen.getByText(/diario de comidas/i)).toBeInTheDocument()
  })

  /**
   * Lo que la nutricionista decide tiene que llegar hasta aquí.
   *
   * Esta pantalla pasaba `visibilidadDe(undefined)` escrito a pelo, así que los
   * tres interruptores llegaban siempre encendidos y la decisión de Manuela no
   * cambiaba nada en el móvil del asesorado. No fallaba: enseñaba las cifras de
   * quien había pedido no verlas.
   */
  describe('la decisión de la nutricionista', () => {
    it('por defecto se ven las cifras: es el caso normal', () => {
      pintar()
      expect(screen.getByText(/tu composición/i)).toBeInTheDocument()
    })

    it('si ella apaga la composición, deja de verse', () => {
      db.visibilidad.decidir({
        usuarioId: 'u-valentina',
        verComposicion: false,
        verObjetivoCalorico: true,
        verContadorKcal: true,
        estado: 'decidido',
      })
      pintar()
      expect(screen.queryByText(/tu composición/i)).not.toBeInTheDocument()
      // Lo que no apagó sigue ahí: se respeta la decisión, no se generaliza.
      expect(screen.getByText(/tu gasto estimado/i)).toBeInTheDocument()
    })

    /**
     * El "en espera" no está guardado en ninguna parte: se deriva de la encuesta
     * más la ausencia de decisión. La app del móvil no puede escribir esa tabla,
     * así que si la pantalla no derivara la señal, nadie la marcaría nunca.
     */
    it('con una señal en la encuesta y sin decisión todavía, retiene las cifras', () => {
      const perfil = db.perfilNutricion.byUsuario('u-valentina')
      db.perfilNutricion.guardar(
        'u-valentina',
        { ...perfil?.respuestas, cicloMenstrual: 'ausente' },
        true,
      )
      pintar()
      expect(screen.getByText(/está revisando tus datos/i)).toBeInTheDocument()
      expect(screen.queryByText(/tu composición/i)).not.toBeInTheDocument()
    })

    it('pero si ella ya miró y dijo que sí, la señal no las vuelve a esconder', () => {
      const perfil = db.perfilNutricion.byUsuario('u-valentina')
      db.perfilNutricion.guardar(
        'u-valentina',
        { ...perfil?.respuestas, cicloMenstrual: 'ausente' },
        true,
      )
      db.visibilidad.decidir({
        usuarioId: 'u-valentina',
        verComposicion: true,
        verObjetivoCalorico: true,
        verContadorKcal: true,
        estado: 'decidido',
      })
      pintar()
      expect(screen.getByText(/tu composición/i)).toBeInTheDocument()
    })
  })

  /**
   * `perfil.vistaSimple` (8-oct-2026, pedida para Karin Better): una sola pantalla con la
   * comida de la semana, sin las pestañas, sin «kcal/P/C/G» por delante.
   *
   * Pero la pantalla sencilla no trae el mercado, los suplementos ni el cambio de un
   * alimento que no se tiene, así que lleva una salida al plan completo y el plan completo
   * una vuelta a la lista sencilla. Quien no tiene `vistaSimple` no ve ninguna de las dos.
   */
  describe('con vistaSimple', () => {
    const ver = 'Ver mercado, suplementos y cambios de alimentos'

    /**
     * La MISMA ficha real con `vistaSimple` encima, para no tocar el seed de los demás tests.
     * Devuelve el espía de `scrollTo`: jsdom lo trae sin implementar (solo escribe un error
     * en consola) y cambiar de vista lo llama.
     */
    function conVistaSimple() {
      const original = db.perfiles.byUsuario
      vi.spyOn(db.perfiles, 'byUsuario').mockImplementation((id) => {
        const real = original(id)
        return real && { ...real, vistaSimple: true }
      })
      return vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    }

    it('pinta la comida de la semana en una pantalla, no las pestañas de siempre', () => {
      conVistaSimple()

      pintar()

      expect(screen.getByText('Lo que comes esta semana')).toBeInTheDocument()
      // Ni rastro de las pestañas de la vista completa.
      expect(screen.queryByRole('button', { name: 'Mi perfil' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Ondulación' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Intercambios' })).toBeNull()
      // Pero sí al menos una comida real del plan del seed, con su botón de texto.
      expect(screen.getAllByRole('button', { name: /^Anotar / }).length).toBeGreaterThan(0)
    })

    it('registrar desde la versión simple manda al diario igual que desde la completa', async () => {
      conVistaSimple()
      const usuario = userEvent.setup()
      pintar()

      await usuario.click(screen.getAllByRole('button', { name: /^Anotar / })[0])

      // Mismo `registrar` que la vista completa: navega a `/nutricion`, así que esta
      // pantalla (montada en `/nutricion/plan`) desaparece.
      expect(screen.queryByText('Lo que comes esta semana')).toBeNull()
    })

    it('«Ver mercado, suplementos y cambios de alimentos» enseña el plan completo, y «Volver a la lista sencilla» regresa', async () => {
      conVistaSimple()
      const usuario = userEvent.setup()
      pintar()

      // Se entra siempre por la lista sencilla, sin la vuelta (que es de la vista completa).
      expect(screen.queryByRole('button', { name: 'Volver a la lista sencilla' })).toBeNull()

      await usuario.click(screen.getByRole('button', { name: ver }))

      // El plan de siempre: sus pestañas, su título, y la vuelta arriba del todo.
      expect(screen.getByRole('button', { name: 'Mercado' })).toBeInTheDocument()
      // Y abierto en lo que el botón prometía —el mercado—, no en «Mi perfil», la primera pestaña.
      expect(screen.getByRole('button', { name: 'Mercado' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Mi perfil' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('heading', { name: 'Mercado de 15 días' })).toBeInTheDocument()
      expect(screen.getByText('Tu plan nutricional')).toBeInTheDocument()
      expect(screen.queryByText('Lo que comes esta semana')).toBeNull()
      expect(screen.queryByRole('button', { name: ver })).toBeNull()
      const volver = screen.getByRole('button', { name: 'Volver a la lista sencilla' })
      const principio = screen.getByRole('button', { name: 'Volver al diario' })
      // «Arriba del todo»: antes que el resto de los botones de la pantalla.
      expect(volver.compareDocumentPosition(principio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

      await usuario.click(volver)

      expect(screen.getByText('Lo que comes esta semana')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mercado' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Volver a la lista sencilla' })).toBeNull()
      expect(screen.getByRole('button', { name: ver })).toBeInTheDocument()
    })

    it('al cambiar de vista vuelve al principio de la página, no se queda donde estaba el dedo', async () => {
      const subir = conVistaSimple()
      const usuario = userEvent.setup()
      pintar()

      await usuario.click(screen.getByRole('button', { name: ver }))
      expect(subir).toHaveBeenCalledTimes(1)
      await usuario.click(screen.getByRole('button', { name: 'Volver a la lista sencilla' }))
      expect(subir).toHaveBeenCalledTimes(2)
    })
  })

  it('sin vistaSimple no hay salida a la lista sencilla: el plan completo es el de siempre', () => {
    pintar()

    expect(screen.getByRole('button', { name: 'Mercado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Volver a la lista sencilla' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ver mercado, suplementos/ })).toBeNull()
  })
})
