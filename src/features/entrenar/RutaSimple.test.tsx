import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { DiaRuta } from '../../domain/rutaEntrenamiento'
import type { ItemMarcable, Microciclo } from '../../domain/types'
import { RutaSimple } from './RutaSimple'

/**
 * La lista de la semana para quien no maneja el salón 3D (`perfil.vistaSimple`).
 *
 * Una revisión encontró que al simplificar se perdieron cosas que el salón sí dice: las
 * notas que el coach deja para la semana, el aviso de que la semana está vencida (a un
 * asesorado le pasó trece días seguidos), las sesiones que no caben en la rejilla y el
 * detalle de cada día. Estos tests fijan que vuelven, y que la letra no baja de 12 px.
 *
 * El microciclo de prueba es el M6: arranca el lunes 2026-09-07 y dura 7 días, así que su
 * último día es el domingo 2026-09-13.
 */

const microciclo: Microciclo = {
  id: 'm-6',
  usuarioId: 'u-1',
  numero: 6,
  cadenciaDias: 7,
  estado: 'activo',
  fechaInicio: '2026-09-07',
  sesiones: [],
}

function dia(
  fechaIso: string,
  nombreDia: DiaRuta['dia'],
  numero: string,
  extra: Partial<DiaRuta> = {},
): DiaRuta {
  return {
    fechaIso,
    dia: nombreDia,
    abreviatura: nombreDia.slice(0, 3),
    numero,
    estado: 'descanso',
    esHoy: false,
    titulo: 'Descanso',
    detalle: 'Sin sesión programada. Prioriza sueño y pasos.',
    ...extra,
  }
}

/** Martes 8 es «hoy»; lunes ya hecho; jueves por hacer; el resto, descanso. */
const semana: DiaRuta[] = [
  dia('2026-09-07', 'LUNES', '07', {
    estado: 'completada',
    sesionId: 's-lun',
    titulo: 'UPPER A · empuje y tracción de la parte alta del cuerpo con pausa',
    detalle: '5 ejercicios · 15 series · 52 min',
  }),
  dia('2026-09-08', 'MARTES', '08', {
    estado: 'hoy',
    esHoy: true,
    sesionId: 's-mar',
    titulo: 'LOWER A',
    detalle: '4 ejercicios · 12 series · 45 min',
  }),
  dia('2026-09-09', 'MIÉRCOLES', '09'),
  dia('2026-09-10', 'JUEVES', '10', {
    estado: 'programada',
    sesionId: 's-jue',
    titulo: 'UPPER B',
    detalle: '6 ejercicios · 18 series · 60 min',
  }),
  dia('2026-09-11', 'VIERNES', '11'),
  dia('2026-09-12', 'SÁBADO', '12'),
  dia('2026-09-13', 'DOMINGO', '13'),
]

const sesionCta = { id: 's-cta', nombre: 'LOWER A', esDeHoy: true, empezada: false }

const nota = (id: string, titulo: string, indicaciones: string): ItemMarcable => ({
  id,
  titulo,
  indicaciones,
})

type Props = Parameters<typeof RutaSimple>[0]

function pintar(extra: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <RutaSimple
        microciclo={microciclo}
        semana={semana}
        sesionCta={sesionCta}
        notas={[]}
        hoy="2026-09-08"
        {...extra}
      />
    </MemoryRouter>,
  )
}

describe('RutaSimple · enlaces', () => {
  it('cada día con sesión es un enlace a su sesión; el que no tiene, no; y el orden no cambia', () => {
    pintar({ sesionesFueraDeSemana: [{ id: 's-extra', nombre: 'FULL EXTRA' }] })

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      // El botón grande primero…
      '/entrenar/sesion/s-cta',
      // …luego los días en su orden, solo los que tienen sesión…
      '/entrenar/sesion/s-lun',
      '/entrenar/sesion/s-mar',
      '/entrenar/sesion/s-jue',
      // …y al final las que la rejilla no pudo colocar.
      '/entrenar/sesion/s-extra',
    ])
    // El día de descanso se ve pero no es un enlace.
    expect(screen.getAllByText('Descanso').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /Descanso/ })).toBeNull()
  })

  it('el botón principal apunta a la sesión de sesionCta, no a la del día de hoy de la lista', () => {
    pintar({ sesionCta: { id: 's-otra', nombre: 'UPPER B', esDeHoy: false, empezada: false } })

    const boton = screen.getByRole('link', { name: /Lo que sigue/ })
    expect(boton).toHaveAttribute('href', '/entrenar/sesion/s-otra')
    expect(boton).toHaveTextContent('UPPER B')
  })

  it('el título sigue siendo «Semana N» y el botón principal va antes que la lista', () => {
    pintar()

    expect(screen.getByRole('heading', { level: 1, name: 'Semana 6' })).toBeInTheDocument()
    const boton = screen.getByRole('link', { name: /Para hoy/ })
    const primerDia = screen.getByRole('link', { name: /UPPER A/ })
    expect(boton.compareDocumentPosition(primerDia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('RutaSimple · las notas de la semana', () => {
  it('con notas del coach, las pinta con el mismo componente del salón', () => {
    pintar({
      notas: [
        nota('n-1', 'LEE ESTO: los tres números que cambian', 'Sube 2,5 kg en sentadilla.'),
        nota('n-2', 'IMPORTANTE: el jueves es corto', 'Solo 45 minutos.'),
      ],
    })

    // El recuadro «Notas de la semana» de `NotasDeLaSemana`, el mismo del panel del salón.
    expect(screen.getByText('Notas de la semana')).toBeInTheDocument()
    expect(screen.getByText('LEE ESTO: los tres números que cambian')).toBeInTheDocument()
    expect(screen.getByText('Sube 2,5 kg en sentadilla.')).toBeInTheDocument()
    expect(screen.getByText('IMPORTANTE: el jueves es corto')).toBeInTheDocument()
    expect(screen.getByText('Solo 45 minutos.')).toBeInTheDocument()
  })

  it('sin notas no se pinta nada, ni siquiera un «no hay notas»', () => {
    const { container } = pintar({ notas: [] })

    expect(screen.queryByText('Notas de la semana')).toBeNull()
    expect(container.textContent).not.toMatch(/no hay (ninguna )?nota|sin notas/i)
  })
})

describe('RutaSimple · el aviso de semana vencida o adelantada', () => {
  it('con el microciclo vencido, lo dice con su texto, bajo el título', () => {
    pintar({ hoy: '2026-09-20' })

    const aviso = screen.getByText(
      /^El microciclo 6 terminó el 13 (de )?\S+ · tu coach prepara el siguiente$/,
    )
    expect(aviso).toBeVisible()
    // Visible de verdad: ni bajo 12 px ni con el contraste apagado.
    expect(aviso).toHaveClass('text-xs')
    // Va bajo el título: después del <h1> y antes de la lista de días.
    const titulo = screen.getByRole('heading', { level: 1, name: 'Semana 6' })
    expect(titulo.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const primerDia = screen.getByRole('link', { name: /UPPER A/ })
    expect(aviso.compareDocumentPosition(primerDia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('con el microciclo sin empezar, dice que es la próxima semana', () => {
    pintar({ hoy: '2026-09-01' })

    expect(screen.getByText('Próxima semana · Microciclo 6')).toBeInTheDocument()
    expect(screen.queryByText(/terminó el/)).toBeNull()
  })

  it('con el microciclo vigente no dice nada, ni el primer ni el último día', () => {
    for (const hoy of ['2026-09-07', '2026-09-10', '2026-09-13']) {
      const { unmount } = pintar({ hoy })
      expect(screen.queryByText(/terminó el/), hoy).toBeNull()
      expect(screen.queryByText(/Próxima semana/), hoy).toBeNull()
      unmount()
    }
  })
})

describe('RutaSimple · cada día', () => {
  it('pinta el detalle del día (ejercicios, series, duración) bajo su título, en 12 px', () => {
    pintar()

    for (const detalle of [
      '5 ejercicios · 15 series · 52 min',
      '4 ejercicios · 12 series · 45 min',
      '6 ejercicios · 18 series · 60 min',
    ]) {
      expect(screen.getByText(detalle)).toHaveClass('text-xs')
    }
    // El del día de descanso también (hay cuatro), y va junto al título «Descanso».
    expect(screen.getAllByText('Sin sesión programada. Prioriza sueño y pasos.')).toHaveLength(4)
  })

  it('el título del día cabe en dos líneas en vez de cortarse en una', () => {
    pintar()

    const titulo = screen.getByText(/^UPPER A · empuje y tracción/)
    expect(titulo).toHaveClass('line-clamp-2')
    expect(titulo).not.toHaveClass('truncate')
  })

  it('nada baja de 12 px y el descanso no se apaga con opacidad', () => {
    // Con aviso y con sesiones de más, para que cuente todo lo que la lista puede llegar a pintar.
    // Las notas se miden aparte: su recuadro es `NotasDeLaSemana`, compartido con el salón.
    const { container } = pintar({
      hoy: '2026-09-20',
      sesionesFueraDeSemana: [{ id: 's-extra', nombre: 'FULL EXTRA' }],
    })

    // Ni `text-[10px]` ni `text-[11px]` en nada de lo que pinta la lista.
    expect(container.innerHTML).not.toMatch(/text-\[(9|10|11)(\.\d+)?px\]/)
    // `opacity-70` baja el contraste del texto entero; el descanso se distingue por fondo y color.
    expect(container.innerHTML).not.toContain('opacity-70')
  })
})

describe('RutaSimple · las sesiones que no caben en la rejilla', () => {
  it('van al final, bajo «También de esta semana», cada una como enlace a su sesión', () => {
    pintar({
      sesionesFueraDeSemana: [
        { id: 's-x1', nombre: 'FULL VIERNES · SEMANA 2' },
        { id: 's-x2', nombre: 'FULL LUNES · SEMANA 2' },
      ],
    })

    const titulo = screen.getByRole('heading', { name: 'También de esta semana' })
    const seccion = titulo.parentElement as HTMLElement
    const enlaces = within(seccion).getAllByRole('link')
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/entrenar/sesion/s-x1',
      '/entrenar/sesion/s-x2',
    ])
    expect(enlaces[0]).toHaveTextContent('FULL VIERNES · SEMANA 2')
    // Después de toda la lista de días, no en medio.
    const ultimoDia = screen.getByRole('link', { name: /UPPER B/ })
    expect(ultimoDia.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin sesiones fuera, ni el título aparece', () => {
    const { unmount } = pintar({ sesionesFueraDeSemana: [] })
    expect(screen.queryByText('También de esta semana')).toBeNull()
    unmount()

    // Y sin pasar la prop (el caso de siempre) tampoco.
    pintar()
    expect(screen.queryByText('También de esta semana')).toBeNull()
  })
})
