import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candidato, EventoCarril, RevisionReel } from '../../../data/consola/creadores'

const estado = {
  candidatos: [] as Candidato[],
  revisiones: [] as RevisionReel[],
  eventos: [] as EventoCarril[],
  fallaEventos: false,
  fallaCandidatos: false,
  fallaRevisiones: false,
  llamadas: 0,
}

vi.mock('../../../data/consola/creadores', async (original) => {
  const real = await original<typeof import('../../../data/consola/creadores')>()
  return {
    ...real,
    candidatosDelTablero: () => {
      estado.llamadas += 1
      return Promise.resolve(
        estado.fallaCandidatos ? { ok: false, error: 'red caída' } : { ok: true, datos: estado.candidatos },
      )
    },
    revisionesDe: () =>
      Promise.resolve(
        estado.fallaRevisiones ? { ok: false, error: 'red caída' } : { ok: true, datos: estado.revisiones },
      ),
    eventosDelTablero: () =>
      Promise.resolve(estado.fallaEventos ? { ok: false, error: 'red caída' } : { ok: true, datos: estado.eventos }),
    urlHojaCuadros: () => Promise.resolve(null),
  }
})

const { default: CreadoresPage } = await import('./CreadoresPage')

function candidato(parcial: Partial<Candidato>): Candidato {
  return {
    creadorId: 'ig:1',
    usuarioIg: 'creador',
    seguidores: 800,
    segmento: 'aliado',
    carril: 'etapa1',
    motivos: [],
    notaA: null,
    versionRubrica: null,
    metricas: {},
    senalColombia: null,
    fechaDato: '2026-09-28T00:00:00Z',
    fechaRecepcion: '2026-09-28T00:00:00Z',
    actualizadoEn: '2026-09-28T00:00:00Z',
    ...parcial,
  }
}

function reel(extra: Partial<RevisionReel>): RevisionReel {
  return {
    id: 'x', revisionId: 'v1', creadorId: 'ig:1', revisor: 'claude', rolReel: 'reciente_1', mediaId: '1',
    permalink: null, notas: { H: 2, C: 2, P: 2, T: 2, CTA: 1, S: 2 }, sinAudio: true, descripcion: null,
    hojaCuadros: null, fechaRevision: '2026-09-28T00:00:00Z', ...extra,
  }
}

beforeEach(() => {
  estado.candidatos = []
  estado.revisiones = []
  estado.eventos = []
  estado.fallaEventos = false
  estado.fallaCandidatos = false
  estado.fallaRevisiones = false
  estado.llamadas = 0
})

describe('CreadoresPage', () => {
  it('sin datos lo dice, no pinta un tablero vacío mudo', async () => {
    render(<CreadoresPage />)
    expect(await screen.findByText('Todavía no hay creadores en el tablero.')).toBeInTheDocument()
  })

  it('«Tambaleando» va primero, con su motivo, y los entrenadores al final', async () => {
    estado.candidatos = [
      candidato({ creadorId: 'ig:3', usuarioIg: 'entrena', carril: 'entrenador', segmento: 'entrenador' }),
      candidato({ creadorId: 'ig:2', usuarioIg: 'numeros', carril: 'etapa1' }),
      candidato({ creadorId: 'ig:1', usuarioIg: 'enellimite', carril: 'tambaleando', motivos: ['C 1,8', 'sin audio'] }),
    ]
    render(<CreadoresPage />)
    const titulos = await screen.findAllByRole('heading', { level: 2 })
    expect(titulos.map((t) => t.textContent)).toEqual([
      'Tambaleando (1)',
      'Etapa 1 · números (1)',
      'Entrenadores (alquiler) (1)',
    ])
    const tambaleando = screen.getByRole('region', { name: 'Tambaleando (1)' })
    expect(within(tambaleando).getByText('@enellimite')).toBeInTheDocument()
    expect(within(tambaleando).getByText('C 1,8')).toBeInTheDocument()
  })

  it('arriba, las cifras y el embudo salen de los carriles reales', async () => {
    estado.candidatos = [
      candidato({ creadorId: 'ig:1', carril: 'etapa1' }),
      candidato({ creadorId: 'ig:2', carril: 'etapa2' }),
      candidato({ creadorId: 'ig:3', carril: 'tambaleando' }),
      candidato({ creadorId: 'ig:4', carril: 'tambaleando' }),
      candidato({ creadorId: 'ig:5', carril: 'mensaje_enviado' }),
      candidato({ creadorId: 'ig:6', carril: 'entrenador', segmento: 'entrenador' }),
      candidato({ creadorId: 'ig:7', carril: 'descubierto' }),
    ]
    render(<CreadoresPage />)
    const cifras = await screen.findByRole('group', { name: 'Cifras de la bola de nieve' })
    expect(within(cifras).getByText('7 candidatos en el tablero')).toBeInTheDocument()
    expect(within(cifras).getByText('2 por decidir')).toBeInTheDocument()
    expect(within(cifras).getByText('1 contactos registrados')).toBeInTheDocument()
    const embudo = screen.getByRole('region', { name: 'El embudo hoy' })
    const filas = within(embudo).getAllByRole('listitem').map((li) => li.textContent)
    expect(filas).toEqual(['Candidatos en el tablero7', 'Esperan video1', 'Tambaleando2', 'Contactos registrados1', 'Entrenadores1'])
  })

  it('«Por decidir» encabeza a los que tambalean, y solo si hay alguno', async () => {
    estado.candidatos = [candidato({ carril: 'tambaleando', motivos: ['sin audio'] })]
    const { unmount } = render(<CreadoresPage />)
    expect(await screen.findByText('Por decidir · escúchalos con sonido')).toBeInTheDocument()
    unmount()
    estado.candidatos = [candidato({ carril: 'etapa1' })]
    render(<CreadoresPage />)
    await screen.findByText('@creador')
    expect(screen.queryByText('Por decidir · escúchalos con sonido')).not.toBeInTheDocument()
  })

  it('sin creadores no pinta cifras ni embudo vacíos', async () => {
    render(<CreadoresPage />)
    await screen.findByText('Todavía no hay creadores en el tablero.')
    expect(screen.queryByRole('group', { name: 'Cifras de la bola de nieve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'El embudo hoy' })).not.toBeInTheDocument()
  })

  it('no ofrece ningún botón que escriba (F1 es solo lectura)', async () => {
    estado.candidatos = [candidato({ carril: 'aprobado_contacto' })]
    render(<CreadoresPage />)
    await screen.findByText('@creador')
    const botones = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(botones.some((t) => /firmar|aprobar|enviar|vetar/i.test(t))).toBe(false)
  })

  it('un fallo de la lectura se dice como fallo, con reintento, y no como «no hay creadores» (E-01)', async () => {
    estado.fallaCandidatos = true
    render(<CreadoresPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el tablero')
    expect(screen.queryByText('Todavía no hay creadores en el tablero.')).not.toBeInTheDocument()
    estado.fallaCandidatos = false
    estado.candidatos = [candidato({ carril: 'etapa1' })]
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('@creador')).toBeInTheDocument()
    expect(estado.llamadas).toBe(2)
  })

  it('un fallo al leer las revisiones no dice «sin revisión» (E-01)', async () => {
    estado.candidatos = [candidato({ carril: 'etapa2' })]
    estado.fallaRevisiones = true
    render(<CreadoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /@creador/ }))
    expect(await screen.findByText(/No se pudieron leer las revisiones/)).toBeInTheDocument()
    expect(screen.queryByText('Sin revisión de video todavía.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('muestra la vuelta más reciente y no mezcla sus notas con las de otra (E-02)', async () => {
    estado.candidatos = [candidato({ carril: 'tambaleando' })]
    estado.revisiones = [
      reel({ id: 'nueva', revisionId: 'v2', mediaId: '222', fechaRevision: '2026-09-27T00:00:00Z', notas: { H: 3, S: 3 } }),
      reel({ id: 'vieja', revisionId: 'v1', mediaId: '111', fechaRevision: '2026-09-20T00:00:00Z', notas: { H: 0, S: 0 } }),
    ]
    render(<CreadoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /@creador/ }))
    const selector = await screen.findByRole('combobox', { name: 'Vuelta de revisión' })
    expect(selector).toHaveValue('v2')
    expect(screen.getByText(/H 3 · C pendiente/)).toBeInTheDocument()
    expect(screen.queryByText(/H 0/)).not.toBeInTheDocument()
    fireEvent.change(selector, { target: { value: 'v1' } })
    expect(await screen.findByText(/H 0/)).toBeInTheDocument()
    expect(screen.queryByText(/H 3 · C pendiente/)).not.toBeInTheDocument()
  })

  it('la S sale como mínimo y cualquier S<2 se marca, nunca como media (E-03)', async () => {
    estado.candidatos = [candidato({ carril: 'tambaleando' })]
    estado.revisiones = [
      reel({ id: 'a', rolReel: 'reciente_1', mediaId: '1', notas: { S: 1 } }),
      reel({ id: 'b', rolReel: 'reciente_2', mediaId: '2', notas: { S: 3 } }),
      reel({ id: 'c', rolReel: 'reciente_3', mediaId: '3', notas: { S: null } }),
    ]
    render(<CreadoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /@creador/ }))
    const aviso = await screen.findByText(/S mínima 1/)
    expect(aviso).toHaveTextContent('S mínima 1 · 2 de 3 reels con S · 3 evaluaciones (1 sin S)')
    expect(aviso.className).toMatch(/text-rojo/)
    const celda = screen.getByRole('cell', { name: 'mín 1' })
    expect(celda.className).toMatch(/text-rojo/)
    expect(screen.queryByRole('cell', { name: '2' })).not.toBeInTheDocument()
  })

  it('dos revisores del mismo reel no son «2 de 2 reels»: es un reel con dos evaluaciones (N-02)', async () => {
    estado.candidatos = [candidato({ carril: 'tambaleando' })]
    estado.revisiones = [
      reel({ id: 'a', mediaId: '777', revisor: 'claude', notas: { S: 3 } }),
      reel({ id: 'b', mediaId: '777', revisor: 'astra', notas: { S: 1 } }),
    ]
    render(<CreadoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /@creador/ }))
    const aviso = await screen.findByText(/S mínima 1/)
    expect(aviso).toHaveTextContent('S mínima 1 · 1 de 1 reel con S · 2 evaluaciones')
    expect(aviso).not.toHaveTextContent('2 de 2 reels')
    expect(aviso.className).toMatch(/text-rojo/)
  })

  it('un contactado que después se descartó sigue en «contactados», por la historia (E-05)', async () => {
    estado.candidatos = [
      candidato({ creadorId: 'ig:1', carril: 'descartado' }),
      candidato({ creadorId: 'ig:2', carril: 'etapa1' }),
    ]
    estado.eventos = [
      { id: 'e1', creadorId: 'ig:1', carrilNuevo: 'mensaje_enviado', fechaDato: '2026-09-20T00:00:00Z' },
      { id: 'e2', creadorId: 'ig:1', carrilNuevo: 'descartado', fechaDato: '2026-09-25T00:00:00Z' },
    ]
    render(<CreadoresPage />)
    const cifras = await screen.findByRole('group', { name: 'Cifras de la bola de nieve' })
    expect(await within(cifras).findByText('1 contactos registrados')).toBeInTheDocument()
  })

  it('si la historia no se puede leer, «contactados» no inventa una cifra y se puede reintentar (E-05)', async () => {
    estado.candidatos = [candidato({ creadorId: 'ig:1', carril: 'mensaje_enviado' })]
    estado.fallaEventos = true
    render(<CreadoresPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer la historia de contactos')
    const embudo = screen.getByRole('region', { name: 'El embudo hoy' })
    const filas = within(embudo).getAllByRole('listitem').map((li) => li.textContent)
    expect(filas).toContain('Contactos registrados—')
    estado.fallaEventos = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    const cifras = screen.getByRole('group', { name: 'Cifras de la bola de nieve' })
    expect(await within(cifras).findByText('1 contactos registrados')).toBeInTheDocument()
  })
  // E-05-R (revisión final de Codex, 28-sep): el importador solo guarda el carril que ve en
  // cada subida. Con etapa2 → mensaje_enviado → descartado sin subida entre medias, la
  // historia trae etapa2 y descartado, y el contacto no queda. La app no puede saber que
  // falta: la cifra se llama «contactos registrados», dice que es un mínimo y que no es el
  // total del piloto, en vez de dar un «0 contactados» como si fuera la verdad.
  it('con la historia incompleta del importador no afirma «0 contactados»: son contactos registrados, un mínimo (E-05-R)', async () => {
    estado.candidatos = [candidato({ creadorId: 'ig:1', carril: 'descartado' })]
    estado.eventos = [
      { id: 'e1', creadorId: 'ig:1', carrilNuevo: 'etapa2', fechaDato: '2026-09-20T00:00:00Z' },
      { id: 'e2', creadorId: 'ig:1', carrilNuevo: 'descartado', fechaDato: '2026-09-25T00:00:00Z' },
    ]
    render(<CreadoresPage />)
    const cifras = await screen.findByRole('group', { name: 'Cifras de la bola de nieve' })
    expect(await within(cifras).findByText('0 contactos registrados')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ contactados/)).not.toBeInTheDocument()
    const embudo = screen.getByRole('region', { name: 'El embudo hoy' })
    expect(within(embudo).getByText(/Contactos registrados es un mínimo/)).toHaveTextContent(
      /no es el total del piloto/i,
    )
  })

  it('un evento con carril desconocido se avisa, no se descarta en silencio', async () => {
    estado.candidatos = [candidato({ creadorId: 'ig:1', carril: 'mensaje_enviado' })]
    estado.eventos = [
      { id: 'e1', creadorId: 'ig:1', carrilNuevo: 'mensaje_enviado', fechaDato: '2026-09-20T00:00:00Z' },
      { id: 'e2', creadorId: 'ig:2', carrilNuevo: 'carril_inventado', fechaDato: '2026-09-21T00:00:00Z' },
      { id: 'e3', creadorId: 'ig:3', carrilNuevo: 'otro_raro', fechaDato: '2026-09-22T00:00:00Z' },
    ]
    render(<CreadoresPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('2 eventos con carril desconocido')
  })

  it('sin eventos raros no hay aviso de carril desconocido', async () => {
    estado.candidatos = [candidato({ creadorId: 'ig:1', carril: 'mensaje_enviado' })]
    estado.eventos = [{ id: 'e1', creadorId: 'ig:1', carrilNuevo: 'mensaje_enviado', fechaDato: '2026-09-20T00:00:00Z' }]
    render(<CreadoresPage />)
    const cifras = await screen.findByRole('group', { name: 'Cifras de la bola de nieve' })
    expect(await within(cifras).findByText('1 contactos registrados')).toBeInTheDocument()
    expect(screen.queryByText(/carril desconocido/)).not.toBeInTheDocument()
  })
})
