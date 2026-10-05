import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * La pestaña de Agentes con las preguntas que la cadena le deja al coach (0110): suben ARRIBA del
 * tablero, no se repiten en la bandeja de abajo, y al responder pasan a «respondidas». Supabase falso
 * a la altura de `data/supabase`, como `AgentesTab.test.tsx`.
 */
interface Fila {
  [k: string]: unknown
}

const nube = {
  corridas: [] as Fila[],
  respuestas: [] as Fila[],
  errorRespuestas: null as { code?: string; message: string } | null,
  rpc: [] as { nombre: string; parametros: Record<string, unknown> }[],
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla === 'cadena_corridas') {
        const b = { select: () => b, order: () => Promise.resolve({ data: nube.corridas, error: null }) }
        return b
      }
      if (tabla === 'respuestas_coach_cadena') {
        const b = {
          select: () => b,
          order: () => b,
          limit: () =>
            Promise.resolve({ data: nube.errorRespuestas ? null : nube.respuestas, error: nube.errorRespuestas }),
        }
        return b
      }
      throw new Error(`tabla inesperada: ${tabla}`)
    },
    rpc: (nombre: string, parametros: Record<string, unknown>) => {
      nube.rpc.push({ nombre, parametros })
      return Promise.resolve({ data: null, error: null })
    },
  }
}

vi.mock('../../../../data/supabase', () => ({
  get modoNube() {
    return true
  },
  supabase: () => cliente(),
}))

vi.mock('../../../../app/SessionProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../app/SessionProvider')>()),
  useSesionOpcional: () => ({ usuario: { id: 'u-coach', rol: 'coach', nombre: 'Bryan' }, esNube: true }),
}))

vi.mock('../useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, usuarioId: 'u-coach', tiene: () => false }),
}))

import type { Usuario } from '../../../../domain/types'

const { db } = await import('../../../../data/dbInstance')
const { AgentesTab } = await import('./AgentesTab')

const ID = 'cp-0123456789abcdef'
const TEXTO = '¿Con qué volumen vuelve tras la descarga?'

function usuario(id: string, nombre: string): Usuario {
  return { id, nombre, rol: 'asesorado', avatarIniciales: nombre.slice(0, 2).toUpperCase() }
}

function fila(paso: number, preguntas: unknown[]): Fila {
  return {
    id: `id-${paso}`, event_id: `ev-${paso}`, run_id: 'run-1', usuario_id: 'u-1', semana_inicio: '2026-09-28',
    paso, intento: 1, estado: 'completado', secuencia: paso, hash_artefacto: 'h', version_reglas: 'v1',
    fecha_dato: '2026-10-01T10:00:00Z', fecha_recepcion: new Date().toISOString(), resumen: 'r', avisos: [],
    preguntas_pendientes: preguntas, creado_en: '2026-10-01T10:00:00Z',
  }
}

const preguntaCadena = {
  fuente: 'cadena', id: ID, texto: TEXTO, paso: 2, persona: 'Persona Uno', usuario_id: 'u-1', corrida: 'p-M5',
  fecha: '2026-10-01T10:00:00Z', opciones: null,
}

afterEach(() => {
  vi.restoreAllMocks()
  nube.corridas = []
  nube.respuestas = []
  nube.errorRespuestas = null
  nube.rpc = []
})

function prepararCartera() {
  vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
}

describe('AgentesTab · preguntas de la cadena para el coach', () => {
  it('la pregunta del ② sale arriba del tablero, con la persona', async () => {
    prepararCartera()
    nube.corridas = [fila(1, []), fila(2, [preguntaCadena])]
    render(<AgentesTab />)
    const titulo = await screen.findByText('Preguntas de la cadena para ti')
    const tablero = screen.getByText(/Tablero de la cadena/)
    expect(titulo.compareDocumentPosition(tablero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    // No se repite abajo en la bandeja de siempre.
    expect(screen.getAllByText(TEXTO)).toHaveLength(1)
    expect(screen.getByText('No hay preguntas pendientes.')).toBeInTheDocument()
  })

  it('una pregunta que ya tiene respuesta guardada no está en pendientes y sí en respondidas', async () => {
    prepararCartera()
    nube.corridas = [fila(2, [preguntaCadena])]
    nube.respuestas = [{
      id_pregunta: ID, usuario_id: 'u-1', paso: 2, texto: TEXTO, respuesta: 'B · 25', respondido_por: 'c-1',
      quien: 'Bryan', respondido_en: '2026-10-03T10:00:00Z',
    }]
    render(<AgentesTab />)
    await userEvent.click(await screen.findByRole('button', { name: /ver respondidas \(1\)/ }))
    expect(screen.getByText('No hay preguntas de la cadena sin responder.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Preguntas respondidas' })).toHaveTextContent('B · 25')
  })

  it('responder guarda por la RPC y la pregunta pasa a respondidas', async () => {
    prepararCartera()
    nube.corridas = [fila(2, [preguntaCadena])]
    render(<AgentesTab />)
    await userEvent.type(await screen.findByLabelText('Tu respuesta'), '30 series')
    await userEvent.click(screen.getByRole('button', { name: /Guardar la respuesta/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /ver respondidas \(1\)/ })).toBeInTheDocument())
    expect(nube.rpc).toEqual([{
      nombre: 'responder_pregunta_coach',
      parametros: { p_id_pregunta: ID, p_usuario_id: 'u-1', p_paso: 2, p_texto: TEXTO, p_respuesta: '30 series' },
    }])
    expect(screen.getByLabelText('0 sin responder')).toBeInTheDocument()
  })

  it('con la migración sin aplicar la consola no se rompe: preguntas visibles y el aviso', async () => {
    prepararCartera()
    nube.corridas = [fila(2, [preguntaCadena])]
    nube.errorRespuestas = { code: 'PGRST205', message: 'no existe' }
    render(<AgentesTab />)
    expect(await screen.findByText(TEXTO)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('migración 0110'))
    expect(screen.getByText(/Tablero de la cadena/)).toBeInTheDocument()
  })
})
