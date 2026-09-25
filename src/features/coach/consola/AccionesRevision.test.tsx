import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `useCapacidades` se mockea directamente (no vía `SessionProvider` + Supabase): esto es
 * una prueba del COMPONENTE — botón deshabilitado / motivo / idempotency_key — no de la
 * cadena de sesión completa, que ya tiene sus propias pruebas en `useCapacidades.test.ts`.
 */
const estadoCapacidades = {
  cargando: false,
  puedeDetener: false,
  puedeReportar: false,
  usuarioId: 'u-actor' as string | null,
}

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: estadoCapacidades.cargando,
    usuarioId: estadoCapacidades.usuarioId,
    tiene: (capacidad: string) => {
      if (capacidad === 'detener_publicacion') return estadoCapacidades.puedeDetener
      if (capacidad === 'reportar_riesgo') return estadoCapacidades.puedeReportar
      return false
    },
  }),
}))

const ordenesMock = {
  detenerPublicacion: vi.fn(),
  reportarRiesgo: vi.fn(),
}

vi.mock('../../../data/consola/ordenes', () => ({
  detenerPublicacion: (...args: unknown[]) => ordenesMock.detenerPublicacion(...args),
  reportarRiesgo: (...args: unknown[]) => ordenesMock.reportarRiesgo(...args),
}))

vi.mock('../../../data/dbInstance', () => ({
  db: { usuarios: { byId: () => undefined } },
}))

const { AccionesRevision } = await import('./AccionesRevision')

beforeEach(() => {
  estadoCapacidades.cargando = false
  estadoCapacidades.puedeDetener = false
  estadoCapacidades.puedeReportar = false
  estadoCapacidades.usuarioId = 'u-actor'
  ordenesMock.detenerPublicacion.mockReset()
  ordenesMock.reportarRiesgo.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AccionesRevision', () => {
  it('sin la capacidad, los botones están deshabilitados y un clic no llama a la base', () => {
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

    const botonDetener = screen.getByRole('button', { name: 'Detener la semana del 28-sep' })
    const botonReportar = screen.getByRole('button', { name: /Reportar riesgo/ })
    expect(botonDetener).toBeDisabled()
    expect(botonReportar).toBeDisabled()

    fireEvent.click(botonDetener)
    fireEvent.click(botonReportar)

    expect(ordenesMock.detenerPublicacion).not.toHaveBeenCalled()
    expect(ordenesMock.reportarRiesgo).not.toHaveBeenCalled()
    // Un botón deshabilitado no abre el cuadro de motivo.
    expect(screen.queryByLabelText(/Motivo/)).not.toBeInTheDocument()
  })

  it('mientras cargan las capacidades, también quedan deshabilitados (nunca habilitados "por si acaso")', () => {
    estadoCapacidades.cargando = true
    estadoCapacidades.puedeDetener = true
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)
    expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeDisabled()
  })

  it('el botón y el aviso muestran la semana OBJETIVO, no un texto genérico', () => {
    estadoCapacidades.puedeDetener = true
    estadoCapacidades.puedeReportar = true
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)
    expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reportar riesgo (semana del 28-sep)' })).toBeInTheDocument()
  })

  it('con la capacidad: escribir un motivo y confirmar inserta con la idempotency_key correcta', async () => {
    estadoCapacidades.puedeDetener = true
    ordenesMock.detenerPublicacion.mockResolvedValue({
      ok: true,
      yaExistia: false,
      orden: { id: 'o-1', actorId: 'u-actor', tipo: 'detener', objetivo: {}, idempotencyKey: 'detener|u-1|2026-09-28|u-actor', creadaEn: 'x' },
    })
    const onOrdenCreada = vi.fn()
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={onOrdenCreada} />)

    fireEvent.click(screen.getByRole('button', { name: 'Detener la semana del 28-sep' }))
    fireEvent.change(screen.getByLabelText(/Motivo para detener la semana del 28-sep/), {
      target: { value: 'se lastimó el hombro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar detener' }))

    await waitFor(() => expect(ordenesMock.detenerPublicacion).toHaveBeenCalledTimes(1))
    // La MISMA forma que exige el encargo: {usuario_id, semana_inicio, motivo} vía
    // `detenerPublicacion`, que arma `detener|usuario_id|semana_inicio|actor` como clave —
    // y `semana_inicio` es la semana OBJETIVO (la que se va a cargar), no la de hoy.
    expect(ordenesMock.detenerPublicacion).toHaveBeenCalledWith({
      usuarioId: 'u-1',
      semanaInicio: '2026-09-28',
      motivo: 'se lastimó el hombro',
      actorId: 'u-actor',
    })
    await waitFor(() => expect(onOrdenCreada).toHaveBeenCalled())
  })

  it('reportar riesgo: mismo cuadro, mismo contrato, con su propio texto y su propia semana', async () => {
    estadoCapacidades.puedeReportar = true
    ordenesMock.reportarRiesgo.mockResolvedValue({ ok: true, yaExistia: false, orden: {} })
    render(<AccionesRevision usuarioId="u-2" semanaObjetivo="2026-10-05" ordenes={[]} onOrdenCreada={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reportar riesgo (semana del 5-oct)' }))
    fireEvent.change(screen.getByLabelText(/Motivo del riesgo reportado \(semana del 5-oct\)/), {
      target: { value: 'dolor articular' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reporte' }))

    await waitFor(() =>
      expect(ordenesMock.reportarRiesgo).toHaveBeenCalledWith({
        usuarioId: 'u-2',
        semanaInicio: '2026-10-05',
        motivo: 'dolor articular',
        actorId: 'u-actor',
      }),
    )
  })

  it('sin escribir motivo, no envía nada y avisa en la página', () => {
    estadoCapacidades.puedeDetener = true
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Detener la semana del 28-sep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar detener' }))

    expect(screen.getByText('Escribe el motivo antes de enviar.')).toBeInTheDocument()
    expect(ordenesMock.detenerPublicacion).not.toHaveBeenCalled()
  })

  it('ya detenida (llega en `ordenes`, misma semana objetivo): muestra "Detenida la semana del … por … a las …" en vez de un botón', () => {
    render(
      <AccionesRevision
        usuarioId="u-1"
        semanaObjetivo="2026-09-28"
        ordenes={[
          {
            id: 'o-1',
            actorId: 'u-coach',
            tipo: 'detener',
            objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'x' },
            idempotencyKey: 'detener|u-1|2026-09-28|u-coach',
            creadaEn: '2026-09-28T15:00:00Z',
          },
        ]}
        onOrdenCreada={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Detener la semana del 28-sep' })).not.toBeInTheDocument()
    expect(screen.getByText(/Detenida la semana del 28-sep por/)).toBeInTheDocument()
    expect(screen.getByText(/no se reanuda sola/)).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay botón de «reanudar»/)).toBeInTheDocument()
  })

  it('una orden de detener de OTRA semana (la que está terminando) no cuenta como "ya detenida"', () => {
    render(
      <AccionesRevision
        usuarioId="u-1"
        semanaObjetivo="2026-09-28"
        ordenes={[
          {
            id: 'o-vieja',
            actorId: 'u-coach',
            tipo: 'detener',
            objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-21', motivo: 'x' },
            idempotencyKey: 'detener|u-1|2026-09-21|u-coach',
            creadaEn: '2026-09-21T15:00:00Z',
          },
        ]}
        onOrdenCreada={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeInTheDocument()
    expect(screen.queryByText(/Detenida la semana del/)).not.toBeInTheDocument()
  })

  it('errores de la base (RLS) se muestran con un mensaje claro en la página', async () => {
    estadoCapacidades.puedeDetener = true
    ordenesMock.detenerPublicacion.mockResolvedValue({ ok: false, error: 'No tienes permiso para esta acción.' })
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Detener la semana del 28-sep' }))
    fireEvent.change(screen.getByLabelText(/Motivo para detener la semana del 28-sep/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar detener' }))

    await waitFor(() => expect(screen.getByText('No tienes permiso para esta acción.')).toBeInTheDocument())
  })
})
