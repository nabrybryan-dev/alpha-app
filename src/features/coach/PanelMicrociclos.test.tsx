/**
 * El «tercer escritor»: al montar el panel, `barrerYActivar` no solo mira, TAMBIÉN
 * escribe (activa microciclos) en la base. Eso compite con la cadena de agentes,
 * que carga sus semanas ya activas por su cuenta (decisión de Bryan, 24-sep-2026).
 *
 * Por defecto —sin `VITE_MOTOR_APP_ACTIVO=true`— el panel debe SOLO LEER, es decir,
 * llamar a `revisarCartera` y no a `barrerYActivar`. Solo con la bandera puesta a
 * 'true' se conserva el comportamiento viejo de escribir.
 *
 * Se lee la bandera en tiempo de build (`import.meta.env`, igual que `modoNube` en
 * `data/supabase.ts`), así que cada caso necesita su propio `vi.resetModules()` +
 * importación dinámica: el valor se congela en la constante del módulo al primer
 * `import`, y sin resetear se leería siempre el de la primera vez.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaCartera } from './revisionCartera'

const {
  barrerYActivarMock,
  revisarCarteraMock,
  choquesMock,
  confirmarMock,
  descartarMock,
  procesarColaMock,
  hidratarMock,
  byUsuarioMock,
} = vi.hoisted(() => ({
  procesarColaMock: vi.fn(),
  hidratarMock: vi.fn(),
  byUsuarioMock: vi.fn(),
  barrerYActivarMock: vi.fn(),
  revisarCarteraMock: vi.fn(),
  choquesMock: vi.fn(),
  confirmarMock: vi.fn(),
  descartarMock: vi.fn(),
}))

vi.mock('../../data/nube/sync', () => ({ procesarCola: procesarColaMock }))
vi.mock('../../data/nube/hidratar', () => ({
  hidratarDesdeNube: hidratarMock,
}))
vi.mock('../../data/dbInstance', () => ({
  db: {
    microciclos: { byUsuario: byUsuarioMock },
    usuarios: { entrenan: () => [] },
  },
}))

vi.mock('../../data/consola/choquesMicrociclo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../data/consola/choquesMicrociclo')>()
  return {
    ...real,
    choquesPendientes: choquesMock,
    confirmarPisar: confirmarMock,
    descartarChoque: descartarMock,
  }
})

// Nada más se mockea: `conclusion` sigue siendo la real, aunque estos tests no
// lleguen a usarla (las filas van vacías, así que el panel no pinta nada y no
// hace falta envolverlo en un Router para los `<Link>` de `Grupo`).
vi.mock('./revisionCartera', async (importOriginal) => {
  const real = await importOriginal<typeof import('./revisionCartera')>()
  return {
    ...real,
    barrerYActivar: barrerYActivarMock,
    revisarCartera: revisarCarteraMock,
  }
})

async function montar() {
  vi.resetModules()
  const { PanelMicrociclos } = await import('./PanelMicrociclos')
  return render(
    <MemoryRouter>
      <PanelMicrociclos />
    </MemoryRouter>,
  )
}

describe('PanelMicrociclos', () => {
  const sinFilas: FilaCartera[] = []

  beforeEach(() => {
    barrerYActivarMock.mockReturnValue(sinFilas)
    revisarCarteraMock.mockReturnValue(sinFilas)
    choquesMock.mockResolvedValue({ ok: true, choques: [] })
    confirmarMock.mockResolvedValue({ ok: true })
    descartarMock.mockResolvedValue({ ok: true })
    procesarColaMock.mockResolvedValue(undefined)
    hidratarMock.mockResolvedValue(undefined)
    byUsuarioMock.mockReturnValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    barrerYActivarMock.mockClear()
    revisarCarteraMock.mockClear()
    confirmarMock.mockClear()
    descartarMock.mockClear()
    procesarColaMock.mockReset()
    hidratarMock.mockReset()
    byUsuarioMock.mockReset()
  })

  it('sin la bandera, NO escribe: solo lee con revisarCartera', async () => {
    vi.stubEnv('VITE_MOTOR_APP_ACTIVO', '')
    await montar()

    expect(revisarCarteraMock).toHaveBeenCalledTimes(1)
    expect(barrerYActivarMock).not.toHaveBeenCalled()
  })

  it('con la bandera en "true", sí escribe: llama a barrerYActivar', async () => {
    vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
    await montar()

    expect(barrerYActivarMock).toHaveBeenCalledTimes(1)
    expect(revisarCarteraMock).not.toHaveBeenCalled()
  })

  describe('si falla la lectura de avisos', () => {
    it('lo dice, en vez de pintar «sin avisos» (con el panel vacío, antes no pintaba nada)', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({
        ok: false,
        error: 'No se pudieron leer los avisos de microciclos. Vuelve a intentarlo.',
      })
      await montar()
      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('No se pudieron leer los avisos'),
      )
    })

    it('con el motor encendido no cuenta las activaciones como hechas', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      const usuario = { id: 'u-1', nombre: 'Persona de prueba' }
      barrerYActivarMock.mockReturnValue([
        { usuario, estado: 'automatica', numeroActual: 8 },
      ] as unknown as FilaCartera[])
      choquesMock.mockResolvedValue({
        ok: false,
        error: 'No se pudieron leer los avisos de microciclos. Vuelve a intentarlo.',
      })
      await montar()
      await screen.findByRole('alert')
      expect(screen.queryByText(/1 activado/)).toBeNull()
      expect(screen.getByRole('alert').textContent).toContain('no se puede confirmar')
    })
  })

  describe('la copia local no miente tras activar (hallazgo H6)', () => {
    const choque = {
      id: 'c-1',
      usuarioId: 'u-1',
      propuestaId: 'm-10',
      propuestaNumero: 9,
      existenteNumero: 9,
      existenteOrigen: 'cadena' as const,
      existenteEn: '2026-10-27T13:05:00Z',
    }
    const fila = (id: string, numeroActual: number) =>
      ({
        usuario: { id, nombre: id },
        estado: 'automatica',
        numeroActual,
      }) as unknown as FilaCartera

    it('espera a que la cola drene ANTES de leer los avisos', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      const orden: string[] = []
      procesarColaMock.mockImplementation(async () => {
        orden.push('cola')
      })
      choquesMock.mockImplementation(async () => {
        orden.push('avisos')
        return { ok: true, choques: [] }
      })
      await montar()
      await waitFor(() => expect(orden).toEqual(['cola', 'avisos']))
    })

    it('si la propuesta bloqueada sigue activa en la copia local, rehidrata desde la nube', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      byUsuarioMock.mockReturnValue([{ id: 'm-10', estado: 'activo' }])
      await montar()
      await waitFor(() => expect(hidratarMock).toHaveBeenCalledTimes(1))
    })

    it('si la copia local ya dice propuesto, no rehidrata', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      byUsuarioMock.mockReturnValue([{ id: 'm-10', estado: 'propuesto' }])
      await montar()
      await screen.findByText(/ya cargó su M9/)
      expect(hidratarMock).not.toHaveBeenCalled()
    })

    it('la propuesta bloqueada no cuenta como activada, y otra persona o semana sí', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      // u-1 pasó de M8 a M9 (bloqueada); u-2 también pasó a M9 (sin aviso).
      barrerYActivarMock.mockReturnValue([fila('u-1', 8), fila('u-2', 8)])
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      await montar()
      expect(await screen.findByText('1 activado')).toBeTruthy()
    })

    it('mientras no se han leído los avisos no se cuenta nada como activado', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      barrerYActivarMock.mockReturnValue([fila('u-2', 8)])
      choquesMock.mockReturnValue(new Promise(() => {})) // nunca llega
      await montar()
      expect(screen.queryByText(/activado/)).toBeNull()
    })

    it('un aviso de la cadena bloqueada por la app dice a quién se deja y a quién se activa', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({
        ok: true,
        choques: [
          {
            ...choque,
            propuestaOrigen: 'cadena' as const,
            existenteOrigen: 'app' as const,
          },
        ],
      })
      await montar()
      expect(await screen.findByRole('button', { name: /dejar la de la app/i })).toBeTruthy()
      expect(
        screen.getByRole('button', {
          name: /activar la de la cadena igualmente/i,
        }),
      ).toBeTruthy()
    })
  })

  describe('el candado: la cadena ya cargó esa semana', () => {
    const choque = {
      id: 'c-1',
      usuarioId: 'u-1',
      propuestaId: 'm-10',
      propuestaNumero: 9,
      existenteNumero: 9,
      existenteOrigen: 'cadena' as const,
      existenteEn: '2026-10-27T13:05:00Z',
    }

    it('avisa quién la cargó y cuándo, aunque no haya novedades del barrido', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      await montar()
      expect(await screen.findByText(/la cadena de agentes ya cargó su M9 el 2026-10-27/)).toBeTruthy()
      expect(confirmarMock).not.toHaveBeenCalled()
    })

    it('no hace nada sin pulsar: pisar exige la confirmación explícita', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      await montar()
      await screen.findByText(/ya cargó su M9/)
      fireEvent.click(screen.getByRole('button', { name: /activar la de la app/i }))
      await waitFor(() => expect(confirmarMock).toHaveBeenCalledWith('m-10'))
      await waitFor(() => expect(screen.queryByText(/ya cargó su M9/)).toBeNull())
    })

    it('dejar la de la cadena cierra el aviso sin activar nada', async () => {
      vi.stubEnv('VITE_MOTOR_APP_ACTIVO', 'true')
      choquesMock.mockResolvedValue({ ok: true, choques: [choque] })
      await montar()
      await screen.findByText(/ya cargó su M9/)
      fireEvent.click(screen.getByRole('button', { name: /dejar la de la cadena/i }))
      await waitFor(() => expect(descartarMock).toHaveBeenCalledWith('c-1'))
      expect(confirmarMock).not.toHaveBeenCalled()
    })
  })
})
