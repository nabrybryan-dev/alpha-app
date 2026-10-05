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
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaCartera } from './revisionCartera'

const { barrerYActivarMock, revisarCarteraMock } = vi.hoisted(() => ({
  barrerYActivarMock: vi.fn(),
  revisarCarteraMock: vi.fn(),
}))

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
  return render(<PanelMicrociclos />)
}

describe('PanelMicrociclos', () => {
  const sinFilas: FilaCartera[] = []

  beforeEach(() => {
    barrerYActivarMock.mockReturnValue(sinFilas)
    revisarCarteraMock.mockReturnValue(sinFilas)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    barrerYActivarMock.mockClear()
    revisarCarteraMock.mockClear()
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
})
