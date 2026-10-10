import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listarMock = vi.fn()
const firmarMock = vi.fn()

// Se conserva el módulo REAL salvo las dos funciones que hablan con la base: `fechaDeObservacion` es la de
// producción, así que lo que estas pruebas leen en pantalla es lo que de verdad se pinta.
vi.mock('../../data/consola/observacionesAgente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/consola/observacionesAgente')>()),
  observacionesDe: (...args: unknown[]) => listarMock(...args),
  firmarObservacion: (...args: unknown[]) => firmarMock(...args),
}))

vi.mock('../../data/dbInstance', () => ({
  db: {
    usuarios: {
      byId: (id: string) => (id === 'u-manuela' ? { id, nombre: 'Manuela' } : undefined),
    },
  },
}))

const { ObservacionesDelAgente } = await import('./ObservacionesDelAgente')

const AVISO =
  'Lo escribe un agente de IA a partir de la base de conocimiento. Seguridad y prescripciones no cambian hasta que alguien del equipo firme.'
const ERROR_CARGA = 'No se pudieron cargar las observaciones del agente.'
const VACIO = 'Todavía no hay observaciones del agente para esta persona.'

function obs(extra: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    usuarioId: 'u-1',
    creadoEn: '2026-10-08T15:00:00Z',
    tema: 'estilo_de_vida',
    carril: 'anotada',
    titulo: 'Caminar diez minutos después de almorzar',
    texto: 'Sugerir una caminata corta tras la comida principal.',
    fuentes: [{ tipo: 'base', ref: 'wiki/estilo-de-vida/caminata.md 2026-09-12', cita: 'diez minutos bastan' }],
    agente: 'agente-de-llamadas',
    corridaId: 'corrida-1',
    estado: 'pendiente',
    firmadaPor: null,
    firmadaEn: null,
    notaDeFirma: null,
    ...extra,
  }
}

/** Una de seguridad esperando firma. */
const porFirmar = (extra: Record<string, unknown> = {}) =>
  obs({
    id: 'obs-seg',
    tema: 'seguridad',
    carril: 'para_firma',
    titulo: 'Dolor de rodilla al bajar escaleras',
    texto: 'Primera línea.\nSegunda línea.',
    fuentes: [
      { tipo: 'base', ref: 'wiki/seguridad/dolor-articular.md 2026-09-30', cita: 'derivar antes de cargar' },
      { tipo: 'dato', ref: 'notas_llamada 2026-10-08', cita: 'me duele la rodilla' },
    ],
    ...extra,
  })

const lista = (...observaciones: ReturnType<typeof obs>[]) => ({ ok: true, observaciones })

beforeEach(() => {
  listarMock.mockReset().mockResolvedValue(lista())
  firmarMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ObservacionesDelAgente · lo que siempre se ve', () => {
  it('lleva el título y la línea fija de aviso, también cuando no hay nada', async () => {
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    expect(screen.getByText('Observaciones del agente')).toBeInTheDocument()
    expect(screen.getByText(AVISO)).toBeInTheDocument()
    await screen.findByText(VACIO)
    // Y se queda: el aviso no depende de que haya observaciones.
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  it('mientras carga lo dice, y pide las observaciones de ESTA persona', async () => {
    render(<ObservacionesDelAgente usuarioId="u-7" />)

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    await screen.findByText(VACIO)
    expect(listarMock).toHaveBeenCalledWith('u-7')
  })

  it('sin observaciones dice que todavía no hay', async () => {
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    expect(await screen.findByText(VACIO)).toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })
})

describe('ObservacionesDelAgente · fallo de carga', () => {
  it('un fallo NO se pinta como «todavía no hay»: lo dice y deja reintentar', async () => {
    listarMock.mockResolvedValueOnce({ ok: false, error: ERROR_CARGA })
    listarMock.mockResolvedValueOnce(lista(obs()))
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_CARGA)
    expect(screen.queryByText(VACIO)).not.toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Caminar diez minutos después de almorzar')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(listarMock).toHaveBeenCalledTimes(2)
  })
})

describe('ObservacionesDelAgente · cada observación', () => {
  it('muestra el tema en palabras llanas, el título, el texto con sus saltos de línea, el agente y la fecha', async () => {
    listarMock.mockResolvedValue(lista(porFirmar({ creadoEn: '2026-10-09T03:30:00Z' })))
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    expect(await screen.findByText('Dolor de rodilla al bajar escaleras')).toBeInTheDocument()
    expect(screen.getByText('Seguridad')).toBeInTheDocument()
    const texto = screen.getByText(/Primera línea\./)
    expect(texto.textContent).toBe('Primera línea.\nSegunda línea.')
    expect(texto).toHaveClass('whitespace-pre-wrap')
    // 03:30 UTC del 9 es la noche del jueves 8 en Colombia.
    expect(screen.getByText('agente-de-llamadas · jue 8 oct 2026')).toBeInTheDocument()
  })

  it('pone a cada tema su nombre llano', async () => {
    const temas = [
      ['nota_de_llamada', 'Nota de llamada'],
      ['prescripcion', 'Prescripción'],
      ['estilo_de_vida', 'Estilo de vida'],
      ['nutricion', 'Nutrición'],
    ] as const
    listarMock.mockResolvedValue(
      lista(...temas.map(([tema], i) => obs({ id: `t-${i}`, tema, carril: 'anotada', titulo: `Titulo ${tema}` }))),
    )
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    for (const [tema, nombre] of temas) {
      const tarjeta = (await screen.findByText(`Titulo ${tema}`)).closest('article') as HTMLElement
      expect(within(tarjeta).getByText(nombre)).toBeInTheDocument()
    }
  })

  it('lista SUS FUENTES, distinguiendo la base de conocimiento de los datos de la persona', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    const tarjeta = (await screen.findByText('Dolor de rodilla al bajar escaleras')).closest('article') as HTMLElement
    expect(within(tarjeta).getByText('Se apoya en:')).toBeInTheDocument()
    const fuentes = within(tarjeta).getAllByRole('listitem')
    expect(fuentes).toHaveLength(2)
    expect(fuentes[0]).toHaveTextContent('De la base de conocimiento')
    expect(fuentes[0]).toHaveTextContent('wiki/seguridad/dolor-articular.md 2026-09-30')
    expect(fuentes[0]).toHaveTextContent('«derivar antes de cargar»')
    expect(fuentes[1]).toHaveTextContent('De sus datos')
    expect(fuentes[1]).toHaveTextContent('notas_llamada 2026-10-08')
    expect(fuentes[1]).toHaveTextContent('«me duele la rodilla»')
  })

  it('una fuente sin tipo conocido no se presenta como de la base de conocimiento', async () => {
    listarMock.mockResolvedValue(lista(obs({ fuentes: [{ tipo: 'sin_tipo', ref: 'un rumor', cita: '' }] })))
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    const fuente = (await screen.findByText(/un rumor/)).closest('li') as HTMLElement
    expect(fuente).toHaveTextContent('Origen sin indicar')
    expect(fuente).not.toHaveTextContent('De la base de conocimiento')
  })
})

describe('ObservacionesDelAgente · lo que espera firma va primero', () => {
  it('las pendientes de firma van arriba, en su bloque, aunque sean más viejas que las anotadas', async () => {
    listarMock.mockResolvedValue(
      lista(
        obs({ id: 'a', titulo: 'Anotada reciente', creadoEn: '2026-10-09T12:00:00Z' }),
        porFirmar({ creadoEn: '2026-10-01T12:00:00Z' }),
      ),
    )
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await screen.findByText('Anotada reciente')
    const bloque = screen.getByRole('region', { name: 'Esperan tu firma' })
    expect(within(bloque).getByText('Dolor de rodilla al bajar escaleras')).toBeInTheDocument()
    expect(within(bloque).queryByText('Anotada reciente')).not.toBeInTheDocument()
    const titulos = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Dolor de rodilla al bajar escaleras', 'Anotada reciente'])
    expect(within(bloque).getByText(/Esperan tu firma/)).toHaveTextContent('(1)')
  })

  it('los botones salen SOLO en las pendientes de firma: no en las anotadas ni en las ya firmadas', async () => {
    listarMock.mockResolvedValue(
      lista(
        porFirmar(),
        obs({ id: 'anotada', titulo: 'Anotada' }),
        porFirmar({
          id: 'firmada',
          titulo: 'Ya firmada',
          estado: 'aceptada',
          firmadaPor: 'u-manuela',
          firmadaEn: '2026-10-09T16:00:00Z',
        }),
      ),
    )
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await screen.findByText('Anotada')
    expect(screen.getAllByRole('button', { name: /^Aceptar/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^Descartar/ })).toHaveLength(1)
    const anotada = screen.getByText('Anotada').closest('article') as HTMLElement
    expect(within(anotada).queryByRole('button')).not.toBeInTheDocument()
    const firmada = screen.getByText('Ya firmada').closest('article') as HTMLElement
    expect(within(firmada).queryByRole('button')).not.toBeInTheDocument()
  })

  it('una ya firmada dice quién y cuándo, con el nombre de la cartera', async () => {
    listarMock.mockResolvedValue(
      lista(
        porFirmar({
          estado: 'aceptada',
          firmadaPor: 'u-manuela',
          firmadaEn: '2026-10-09T16:00:00Z',
          notaDeFirma: 'Lo veo el jueves.',
        }),
        porFirmar({ id: 'otra', titulo: 'Otra', estado: 'descartada', firmadaPor: 'u-desconocido', firmadaEn: '2026-10-09T17:00:00Z' }),
      ),
    )
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    expect(await screen.findByText(/Aceptada por Manuela · vie 9 oct 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Nota: Lo veo el jueves\./)).toBeInTheDocument()
    expect(screen.getByText(/Descartada por alguien del equipo · vie 9 oct 2026/)).toBeInTheDocument()
    // No queda ningún bloque de «Esperan tu firma» si no hay pendientes.
    expect(screen.queryByRole('region', { name: 'Esperan tu firma' })).not.toBeInTheDocument()
  })
})

describe('ObservacionesDelAgente · firmar', () => {
  it('«Aceptar» llama a firmar con el id y repinta la tarjeta con quién firmó y cuándo', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    firmarMock.mockResolvedValue({
      ok: true,
      observacion: porFirmar({ estado: 'aceptada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z' }),
    })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))

    expect(firmarMock).toHaveBeenCalledTimes(1)
    expect(firmarMock).toHaveBeenCalledWith('obs-seg', 'aceptada', undefined)
    expect(await screen.findByText(/Aceptada por Manuela · vie 9 oct 2026/)).toBeInTheDocument()
    // Ya no espera nada: sin botones ni bloque de pendientes. Y no hizo falta volver a pedir la lista.
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Esperan tu firma' })).not.toBeInTheDocument()
    expect(listarMock).toHaveBeenCalledTimes(1)
  })

  it('«Descartar» NO firma al primer toque: pide un segundo, con una nota corta opcional', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    firmarMock.mockResolvedValue({
      ok: true,
      observacion: porFirmar({ estado: 'descartada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z', notaDeFirma: 'Ya lo habló con su médica.' }),
    })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Descartar/ }))
    expect(firmarMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Por qué la descartas (opcional)'), 'Ya lo habló con su médica.')
    await user.click(screen.getByRole('button', { name: /^Confirmar que descartas/ }))

    expect(firmarMock).toHaveBeenCalledTimes(1)
    expect(firmarMock).toHaveBeenCalledWith('obs-seg', 'descartada', 'Ya lo habló con su médica.')
    expect(await screen.findByText(/Descartada por Manuela/)).toBeInTheDocument()
    expect(screen.getByText(/Nota: Ya lo habló con su médica\./)).toBeInTheDocument()
  })

  it('descartar sin escribir nota también funciona, y «No» se arrepiente sin firmar', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    firmarMock.mockResolvedValue({ ok: true, observacion: porFirmar({ estado: 'descartada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z' }) })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Descartar/ }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(firmarMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Aceptar/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Descartar/ }))
    await user.click(screen.getByRole('button', { name: /^Confirmar que descartas/ }))
    expect(firmarMock).toHaveBeenCalledWith('obs-seg', 'descartada', '')
  })

  it('si firmar falla lo dice junto a esa observación, la deja pendiente y los botones siguen ahí', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    firmarMock.mockResolvedValue({ ok: false, error: 'No se pudo guardar la firma. Vuelve a intentarlo.', yaFirmada: false })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la firma. Vuelve a intentarlo.')
    expect(screen.getByRole('button', { name: /^Aceptar/ })).toBeEnabled()
    expect(screen.queryByText(/Aceptada por/)).not.toBeInTheDocument()
  })

  it('si otra persona ya la firmó, vuelve a pedir la lista y la muestra firmada', async () => {
    listarMock.mockResolvedValueOnce(lista(porFirmar()))
    listarMock.mockResolvedValueOnce(
      lista(porFirmar({ estado: 'aceptada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z' })),
    )
    firmarMock.mockResolvedValue({
      ok: false,
      error: 'Otra persona del equipo ya la firmó. Se vuelve a cargar la lista.',
      yaFirmada: true,
    })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))

    expect(await screen.findByText(/Aceptada por Manuela/)).toBeInTheDocument()
    expect(listarMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: /^Aceptar/ })).not.toBeInTheDocument()
  })

  it('con una firma en curso los botones esperan: no se firma dos veces con dos toques seguidos', async () => {
    listarMock.mockResolvedValue(lista(porFirmar()))
    let terminar: (v: unknown) => void = () => {}
    firmarMock.mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    const aceptar = await screen.findByRole('button', { name: /^Aceptar/ })
    await user.click(aceptar)
    await waitFor(() => expect(aceptar).toBeDisabled())
    await user.click(aceptar)
    expect(firmarMock).toHaveBeenCalledTimes(1)

    terminar({ ok: true, observacion: porFirmar({ estado: 'aceptada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z' }) })
    expect(await screen.findByText(/Aceptada por Manuela/)).toBeInTheDocument()
  })
})

describe('ObservacionesDelAgente · las 5 más recientes a la vista y el resto plegado', () => {
  const siete = () =>
    Array.from({ length: 7 }, (_, i) =>
      obs({ id: `a-${i}`, titulo: `Anotada ${i}`, creadoEn: `2026-10-0${7 - i}T12:00:00Z` }),
    )

  it('con siete anotadas se ven cinco y un botón para ver las otras dos', async () => {
    listarMock.mockResolvedValue(lista(...siete()))
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await screen.findByText('Anotada 0')
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(5)
    expect(screen.queryByText('Anotada 5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver 2 anteriores' }))
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(7)
    expect(screen.getByText('Anotada 6')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver solo las más recientes' }))
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(5)
  })

  it('con cinco o menos no hay botón de plegado', async () => {
    listarMock.mockResolvedValue(lista(...siete().slice(0, 5)))
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await screen.findByText('Anotada 0')
    expect(screen.queryByRole('button', { name: /anteriores/ })).not.toBeInTheDocument()
  })

  it('las pendientes no se pliegan nunca, aunque haya muchas', async () => {
    listarMock.mockResolvedValue(
      lista(...Array.from({ length: 7 }, (_, i) => porFirmar({ id: `p-${i}`, titulo: `Pendiente ${i}` }))),
    )
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await screen.findByText('Pendiente 6')
    expect(screen.getAllByRole('button', { name: /^Aceptar/ })).toHaveLength(7)
    expect(screen.queryByRole('button', { name: /anteriores/ })).not.toBeInTheDocument()
  })

  it('lo recién firmado sube al principio de lo resuelto, aunque la observación sea vieja', async () => {
    listarMock.mockResolvedValue(
      lista(
        ...siete(),
        porFirmar({ creadoEn: '2026-09-01T12:00:00Z' }),
      ),
    )
    firmarMock.mockResolvedValue({
      ok: true,
      observacion: porFirmar({ creadoEn: '2026-09-01T12:00:00Z', estado: 'aceptada', firmadaPor: 'u-manuela', firmadaEn: '2026-10-09T16:00:00Z' }),
    })
    const user = userEvent.setup()
    render(<ObservacionesDelAgente usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: /^Aceptar/ }))
    await screen.findByText(/Aceptada por Manuela/)

    // Sin esto caería detrás de las siete anotadas, plegada, y quien firmó no vería el resultado.
    expect(screen.getAllByRole('heading', { level: 4 })[0]).toHaveTextContent('Dolor de rodilla al bajar escaleras')
  })
})
