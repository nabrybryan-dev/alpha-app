import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MenuDia, PlanNutricional, TipoDia } from '../../domain/types'
import { MiPlanSimple } from './MiPlanSimple'

/**
 * La comida de la semana en una sola pantalla (`perfil.vistaSimple`).
 *
 * Lo que más se cuida aquí es el TÍTULO de cada bloque. La primera versión llevaba un
 * diccionario fijo —CHEAT = «Tu día libre», BAJO = «Los días de descanso»— y rotulaba al
 * revés el plan real de Karin: su menú CHEAT es un «REFEED · domingo (mantenimiento)» que
 * el propio plan dice que NO es un día libre, y su BAJO incluye el jueves, que sí entrena.
 * La app no puede volver a decidir qué significa un tipo de día: dice lo que dice el plan.
 */

const macros = { kcal: 2000, proteinaG: 120, carbosG: 200, grasaG: 60 }

function menu(tipoDia: TipoDia, nombre: string, comidaTitulo: string, alimentos: string[]): MenuDia {
  return {
    nombre,
    tipoDia,
    comidas: [{ hora: '13:00', titulo: comidaTitulo, alimentos, nota: 'Pesa en crudo.' }],
  }
}

function planCon(
  menus: MenuDia[],
  extra: Partial<PlanNutricional> = {},
): PlanNutricional {
  return {
    id: 'p-1',
    usuarioId: 'u-1',
    analisis: '',
    macrosPorDia: { ALTO: macros, BAJO: macros, CHEAT: macros },
    menus,
    equivalencias: [],
    listaCompras: [],
    suplementacion: [],
    seccionesEspeciales: [],
    ...extra,
  }
}

/** El plan de Karin en lo que importa: tres menús con nombre propio y uno de ellos CHEAT. */
const planDeKarin = planCon([
  menu('ALTO', 'ALTO · pierna y empuje', 'Almuerzo', ['150 g pechuga de pollo', '13:00']),
  menu('BAJO', 'BAJO · jueves y pausa', 'Cena', ['2 huevos']),
  menu('CHEAT', 'REFEED · domingo (mantenimiento)', 'Comida del refeed', ['200 g arroz cocido']),
])

function pintar(plan: PlanNutricional) {
  const props = {
    plan,
    onRegistrar: vi.fn(),
    onVolver: vi.fn(),
    onVerCompleto: vi.fn(),
  }
  const vista = render(<MiPlanSimple {...props} />)
  return { ...props, ...vista }
}

describe('MiPlanSimple · el título de cada bloque lo pone el plan', () => {
  it('un menú CHEAT llamado «REFEED · domingo (mantenimiento)» sale con ese nombre, sin «día libre» ni «descanso»', () => {
    const { container } = pintar(planDeKarin)

    expect(screen.getByText('REFEED · domingo (mantenimiento)')).toBeInTheDocument()
    // Los tres nombres son del plan, tal cual.
    expect(screen.getByText('ALTO · pierna y empuje')).toBeInTheDocument()
    expect(screen.getByText('BAJO · jueves y pausa')).toBeInTheDocument()
    // Y la pantalla entera —no solo el título— no afirma lo que el plan desmiente.
    expect(container.textContent).not.toMatch(/d[ií]a libre/i)
    expect(container.textContent).not.toMatch(/descanso/i)
  })

  it('sin nombre en el menú, usa la etiqueta del día del plan', () => {
    pintar(
      planCon(
        [menu('ALTO', '', 'Almuerzo', ['150 g pechuga de pollo']), menu('CHEAT', '   ', 'Cena', ['1 pizza'])],
        { etiquetasDia: { ALTO: 'PIERNA', CHEAT: 'TORSO' } },
      ),
    )

    expect(screen.getByText('PIERNA')).toBeInTheDocument()
    expect(screen.getByText('TORSO')).toBeInTheDocument()
    expect(screen.queryByText(/Menú \d/)).toBeNull()
  })

  it('sin nombre ni etiqueta, un texto neutro por posición que no dice nada de entrenar ni descansar', () => {
    const { container } = pintar(
      planCon([
        menu('ALTO', '', 'Almuerzo', ['150 g pechuga de pollo']),
        menu('BAJO', '', 'Cena', ['2 huevos']),
        menu('CHEAT', '', 'Cena', ['1 pizza']),
      ]),
    )

    expect(screen.getByText('Menú 1')).toBeInTheDocument()
    expect(screen.getByText('Menú 2')).toBeInTheDocument()
    expect(screen.getByText('Menú 3')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/entren|descans|libre/i)
  })

  it('un menú al que le falta el campo nombre (plan cargado a mano) no tumba la pantalla', () => {
    // El plan viaja como jsonb: el tipo promete `string`, los datos no siempre lo cumplen.
    const sinCampo = { tipoDia: 'ALTO', comidas: menu('ALTO', '', 'Almuerzo', ['2 huevos']).comidas }
    pintar(planCon([sinCampo as unknown as MenuDia], { etiquetasDia: { ALTO: 'PIERNA' } }))

    expect(screen.getByText('PIERNA')).toBeInTheDocument()
  })

  it('la etiqueta de un tipo no se cuela en el menú de otro', () => {
    // Solo ALTO tiene etiqueta: el BAJO sin nombre no hereda la de ALTO, cae al neutro.
    pintar(
      planCon(
        [menu('ALTO', '', 'Almuerzo', ['150 g pechuga de pollo']), menu('BAJO', '', 'Cena', ['2 huevos'])],
        { etiquetasDia: { ALTO: 'PIERNA' } },
      ),
    )

    expect(screen.getByText('PIERNA')).toBeInTheDocument()
    expect(screen.getByText('Menú 2')).toBeInTheDocument()
  })
})

describe('MiPlanSimple · el botón de cada alimento', () => {
  it('dice «Anotar» y cada uno nombra su alimento (no hay dos botones con el mismo nombre)', () => {
    pintar(planDeKarin)

    const botones = screen.getAllByRole('button', { name: /^Anotar / })
    // Tres alimentos con pauta: la hora suelta «13:00» NO es un alimento y no lleva botón.
    expect(botones).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Anotar 150 g pechuga de pollo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anotar 2 huevos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anotar 200 g arroz cocido' })).toBeInTheDocument()
    expect(new Set(botones.map((b) => b.getAttribute('aria-label'))).size).toBe(botones.length)
    // Lo que se VE es la palabra corta; el alimento va en el nombre accesible.
    expect(botones[0]).toHaveTextContent(/^Anotar$/)
    // Y ya no promete lo que no hace: abre el buscador del diario, no registra nada.
    expect(screen.queryByText(/Ya com[ií] esto/)).toBeNull()
  })

  it('pulsarlo manda el alimento y el TÍTULO DE LA COMIDA, no el nombre del menú', async () => {
    const usuario = userEvent.setup()
    const { onRegistrar } = pintar(planDeKarin)

    await usuario.click(screen.getByRole('button', { name: 'Anotar 200 g arroz cocido' }))

    expect(onRegistrar).toHaveBeenCalledTimes(1)
    // `comidaDe()` del padre resuelve el título de la comida («Comida del refeed»); el
    // nombre del menú («REFEED · domingo…») no le sirve para nada.
    expect(onRegistrar).toHaveBeenCalledWith('200 g arroz cocido', 'Comida del refeed')
  })

  it('mide al menos 44 px de alto', () => {
    pintar(planDeKarin)

    // jsdom no maqueta: se comprueba la clase que fija el mínimo, la misma que usa el resto de la app.
    for (const boton of screen.getAllByRole('button', { name: /^Anotar / })) {
      expect(boton).toHaveClass('min-h-[44px]')
    }
  })
})

describe('MiPlanSimple · letra, volver y la salida al plan completo', () => {
  it('la hora de la comida y la nota no bajan de 12 px', () => {
    const { container } = pintar(planDeKarin)

    expect(container.innerHTML).not.toContain('text-[11px]')
    expect(container.innerHTML).not.toContain('text-[10px]')
    const comida = screen.getByRole('heading', { name: 'Almuerzo' }).parentElement as HTMLElement
    expect(within(comida).getByText('13:00')).toHaveClass('text-xs')
    expect(screen.getAllByText('Pesa en crudo.')[0]).toHaveClass('text-xs')
  })

  it('el botón Volver mide 44 x 44 y llama a onVolver', async () => {
    const usuario = userEvent.setup()
    const { onVolver } = pintar(planDeKarin)

    const volver = screen.getByRole('button', { name: 'Volver' })
    expect(volver).toHaveClass('h-11', 'w-11')
    await usuario.click(volver)
    expect(onVolver).toHaveBeenCalledTimes(1)
  })

  it('al pie hay una salida al mercado, los suplementos y los cambios de alimentos', async () => {
    const usuario = userEvent.setup()
    const { onVerCompleto } = pintar(planDeKarin)

    const boton = screen.getByRole('button', { name: 'Ver mercado, suplementos y cambios de alimentos' })
    expect(boton).toHaveClass('min-h-[44px]')
    expect(onVerCompleto).not.toHaveBeenCalled()
    await usuario.click(boton)
    expect(onVerCompleto).toHaveBeenCalledTimes(1)
  })
})
