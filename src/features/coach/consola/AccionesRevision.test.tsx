import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  puedeFirma: false,
  usuarioId: 'u-actor' as string | null,
}

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: estadoCapacidades.cargando,
    usuarioId: estadoCapacidades.usuarioId,
    tiene: (capacidad: string) => {
      if (capacidad === 'detener_publicacion') return estadoCapacidades.puedeDetener
      if (capacidad === 'reportar_riesgo') return estadoCapacidades.puedeReportar
      if (capacidad === 'leer_entrenamiento') return estadoCapacidades.puedeFirma
      return false
    },
  }),
}))

const ordenesMock = {
  detenerPublicacion: vi.fn(),
  reportarRiesgo: vi.fn(),
  reanudarPublicacion: vi.fn(),
  prepararFirma: vi.fn(),
}

vi.mock('../../../data/consola/ordenes', () => ({
  detenerPublicacion: (...args: unknown[]) => ordenesMock.detenerPublicacion(...args),
  reportarRiesgo: (...args: unknown[]) => ordenesMock.reportarRiesgo(...args),
  reanudarPublicacion: (...args: unknown[]) => ordenesMock.reanudarPublicacion(...args),
  prepararFirma: (...args: unknown[]) => ordenesMock.prepararFirma(...args),
}))

/** Se conserva la implementación real de `validarArchivoFirma` (ya tiene sus propias
 *  pruebas en `casosFirma.test.ts`) y solo se mockean las llamadas de red, para probar
 *  aquí el CABLEADO: qué se llama, con qué, y qué pinta el componente con cada resultado. */
const casosFirmaMock = {
  casosFirmaDePersona: vi.fn(),
  registrarFirma: vi.fn(),
  subirFirma: vi.fn(),
  urlDelCaso: vi.fn(),
}

vi.mock('../../../data/consola/casosFirma', async (importActual) => {
  const actual = await importActual<typeof import('../../../data/consola/casosFirma')>()
  return {
    ...actual,
    casosFirmaDePersona: (...args: unknown[]) => casosFirmaMock.casosFirmaDePersona(...args),
    registrarFirma: (...args: unknown[]) => casosFirmaMock.registrarFirma(...args),
    subirFirma: (...args: unknown[]) => casosFirmaMock.subirFirma(...args),
    urlDelCaso: (...args: unknown[]) => casosFirmaMock.urlDelCaso(...args),
  }
})

vi.mock('../../../data/dbInstance', () => ({
  db: { usuarios: { byId: () => undefined } },
}))

const { AccionesRevision } = await import('./AccionesRevision')

beforeEach(() => {
  estadoCapacidades.cargando = false
  estadoCapacidades.puedeDetener = false
  estadoCapacidades.puedeReportar = false
  estadoCapacidades.puedeFirma = false
  estadoCapacidades.usuarioId = 'u-actor'
  ordenesMock.detenerPublicacion.mockReset()
  ordenesMock.reportarRiesgo.mockReset()
  ordenesMock.reanudarPublicacion.mockReset()
  ordenesMock.prepararFirma.mockReset()
  casosFirmaMock.casosFirmaDePersona.mockReset().mockResolvedValue([])
  casosFirmaMock.registrarFirma.mockReset()
  casosFirmaMock.subirFirma.mockReset()
  casosFirmaMock.urlDelCaso.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const ordenDetener = (extra: Partial<Record<string, unknown>> = {}) => ({
  id: 'o-1',
  actorId: 'u-coach',
  tipo: 'detener' as const,
  objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'x' },
  idempotencyKey: 'detener|u-1|2026-09-28|u-coach',
  creadaEn: '2026-09-28T15:00:00Z',
  ...extra,
})

const ordenReanudar = (extra: Partial<Record<string, unknown>> = {}) => ({
  id: 'o-2',
  actorId: 'u-coach',
  tipo: 'reanudar' as const,
  objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'y' },
  idempotencyKey: 'reanudar|u-1|2026-09-28|u-coach|2026-09-28T16:00:00.000Z',
  creadaEn: '2026-09-28T16:00:00Z',
  ...extra,
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
    // Optimista: la orden recién creada viaja a quien pinta la lista, que la pone YA.
    expect(onOrdenCreada).toHaveBeenCalledWith(expect.objectContaining({ id: 'o-1', tipo: 'detener' }))
    // Y la confirmación se ve en el sitio donde se pulsó.
    expect(screen.getByRole('status')).toHaveTextContent('Semana detenida')
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

  it('errores de la base (RLS) se muestran con un mensaje claro en la página', async () => {
    estadoCapacidades.puedeDetener = true
    ordenesMock.detenerPublicacion.mockResolvedValue({ ok: false, error: 'No tienes permiso para esta acción.' })
    render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Detener la semana del 28-sep' }))
    fireEvent.change(screen.getByLabelText(/Motivo para detener la semana del 28-sep/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar detener' }))

    await waitFor(() => expect(screen.getByText('No tienes permiso para esta acción.')).toBeInTheDocument())
  })

  describe('reanudar: solo aparece con detener VIGENTE', () => {
    it('sin ninguna orden, no hay botón de reanudar ni el aviso de detenida', () => {
      render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)
      expect(screen.queryByRole('button', { name: 'Reanudar la semana del 28-sep' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeInTheDocument()
    })

    it('con un detener sin reanudar posterior: aparece "Detenida…" y el botón de reanudar, no el de detener', () => {
      estadoCapacidades.puedeDetener = true
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener()]}
          onOrdenCreada={() => {}}
        />,
      )
      expect(screen.queryByRole('button', { name: 'Detener la semana del 28-sep' })).not.toBeInTheDocument()
      expect(screen.getByText(/Detenida la semana del 28-sep por/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' })).toBeInTheDocument()
    })

    it('con un reanudar MÁS RECIENTE que el detener: vuelve a aparecer el botón de detener, no el de reanudar', () => {
      estadoCapacidades.puedeDetener = true
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener(), ordenReanudar()]}
          onOrdenCreada={() => {}}
        />,
      )
      expect(screen.queryByText(/Detenida la semana del/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reanudar la semana del 28-sep' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeInTheDocument()
    })

    it('con un detener MÁS RECIENTE que el reanudar (se volvió a detener): reanudar reaparece', () => {
      estadoCapacidades.puedeDetener = true
      const segundoDetener = ordenDetener({ id: 'o-3', idempotencyKey: 'detener|u-1|2026-09-28|u-coach-2', creadaEn: '2026-09-28T17:00:00Z' })
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener(), ordenReanudar(), segundoDetener]}
          onOrdenCreada={() => {}}
        />,
      )
      expect(screen.getByText(/Detenida la semana del 28-sep por/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' })).toBeInTheDocument()
    })

    it('una orden de detener de OTRA semana (la que está terminando) no cuenta como "ya detenida"', () => {
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener({ objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-21', motivo: 'x' }, idempotencyKey: 'detener|u-1|2026-09-21|u-coach', creadaEn: '2026-09-21T15:00:00Z' })]}
          onOrdenCreada={() => {}}
        />,
      )
      expect(screen.getByRole('button', { name: 'Detener la semana del 28-sep' })).toBeInTheDocument()
      expect(screen.queryByText(/Detenida la semana del/)).not.toBeInTheDocument()
    })

    it('sin la capacidad, el botón de reanudar queda deshabilitado y un clic no llama a la base', () => {
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener()]}
          onOrdenCreada={() => {}}
        />,
      )
      const boton = screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' })
      expect(boton).toBeDisabled()
      fireEvent.click(boton)
      expect(ordenesMock.reanudarPublicacion).not.toHaveBeenCalled()
    })
  })

  describe('reanudar: la orden sale con los parámetros correctos', () => {
    it('escribir un motivo y confirmar llama a reanudarPublicacion con usuarioId/semanaInicio/motivo/actorId', async () => {
      estadoCapacidades.puedeDetener = true
      ordenesMock.reanudarPublicacion.mockResolvedValue({ ok: true, yaExistia: false, orden: {} })
      const onOrdenCreada = vi.fn()
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener()]}
          onOrdenCreada={onOrdenCreada}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' }))
      expect(screen.getByLabelText('Motivo para reanudar la semana del 28-sep')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Motivo para reanudar la semana del 28-sep'), {
        target: { value: 'ya puede entrenar' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudar' }))

      await waitFor(() =>
        expect(ordenesMock.reanudarPublicacion).toHaveBeenCalledWith({
          usuarioId: 'u-1',
          semanaInicio: '2026-09-28',
          motivo: 'ya puede entrenar',
          actorId: 'u-actor',
        }),
      )
      await waitFor(() => expect(onOrdenCreada).toHaveBeenCalled())
    })

    it('sin motivo, no llama a reanudarPublicacion', () => {
      estadoCapacidades.puedeDetener = true
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener()]}
          onOrdenCreada={() => {}}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudar' }))
      expect(screen.getByText('Escribe el motivo antes de enviar.')).toBeInTheDocument()
      expect(ordenesMock.reanudarPublicacion).not.toHaveBeenCalled()
    })

    it('un error de la base al reanudar se muestra en la página', async () => {
      estadoCapacidades.puedeDetener = true
      ordenesMock.reanudarPublicacion.mockResolvedValue({ ok: false, error: 'No tienes permiso para esta acción.' })
      render(
        <AccionesRevision
          usuarioId="u-1"
          semanaObjetivo="2026-09-28"
          ordenes={[ordenDetener()]}
          onOrdenCreada={() => {}}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Reanudar la semana del 28-sep' }))
      fireEvent.change(screen.getByLabelText('Motivo para reanudar la semana del 28-sep'), { target: { value: 'x' } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudar' }))
      await waitFor(() => expect(screen.getByText('No tienes permiso para esta acción.')).toBeInTheDocument())
    })
  })

  describe('preparar para firmar y la subida de la firma', () => {
    it('sin la capacidad leer_entrenamiento, no aparece "Preparar para firmar"', () => {
      render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)
      expect(screen.queryByRole('button', { name: 'Preparar para firmar' })).not.toBeInTheDocument()
    })

    it('preparar para firmar llama a prepararFirma con los parámetros correctos', async () => {
      estadoCapacidades.puedeFirma = true
      ordenesMock.prepararFirma.mockResolvedValue({ ok: true, yaExistia: false, orden: {} })
      render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: 'Preparar para firmar' }))
      fireEvent.change(screen.getByLabelText('Motivo para preparar el caso de firma (semana del 28-sep)'), {
        target: { value: 'zona roja por retiros' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar preparación' }))

      await waitFor(() =>
        expect(ordenesMock.prepararFirma).toHaveBeenCalledWith({
          usuarioId: 'u-1',
          semanaInicio: '2026-09-28',
          motivo: 'zona roja por retiros',
          actorId: 'u-actor',
        }),
      )
    })

    it('con el caso listo_para_firmar: la subida acepta un .sig y rechaza otros archivos', async () => {
      estadoCapacidades.puedeFirma = true
      casosFirmaMock.casosFirmaDePersona.mockResolvedValue([
        {
          id: 'caso-1',
          usuarioId: 'u-1',
          semanaInicio: '2026-09-28',
          tipo: 'retiro',
          estado: 'listo_para_firmar',
          rutaDecision: 'casos/u-1/2026-09-28/caso-1.json',
          rutaFirma: null,
          validaHasta: '2026-09-29T00:00:00Z',
          ordenId: 'orden-1',
          error: null,
          creadoEn: '2026-09-28T12:00:00Z',
          actualizadoEn: '2026-09-28T12:00:00Z',
        },
      ])

      render(<AccionesRevision usuarioId="u-1" semanaObjetivo="2026-09-28" ordenes={[]} onOrdenCreada={() => {}} />)

      const entradaArchivo = await screen.findByLabelText('Subir la firma (.sig)')
      const botonRegistrar = screen.getByRole('button', { name: 'Registrar firma' })
      expect(botonRegistrar).toBeDisabled()

      // Rechaza un archivo que no es .sig: el botón sigue deshabilitado y avisa en pantalla.
      const archivoMalo = new File(['x'], 'caso-1.json', { type: 'application/json' })
      await userEvent.upload(entradaArchivo, archivoMalo)
      expect(screen.getByText('El archivo debe terminar en «.sig».')).toBeInTheDocument()
      expect(botonRegistrar).toBeDisabled()
      expect(casosFirmaMock.subirFirma).not.toHaveBeenCalled()

      // Acepta un .sig: el botón se habilita.
      const archivoBueno = new File(['contenido'], 'caso-1.json.sig', { type: 'application/octet-stream' })
      await userEvent.upload(entradaArchivo, archivoBueno)
      expect(screen.queryByText('El archivo debe terminar en «.sig».')).not.toBeInTheDocument()
      expect(botonRegistrar).toBeEnabled()

      casosFirmaMock.subirFirma.mockResolvedValue({ ok: true })
      casosFirmaMock.registrarFirma.mockResolvedValue({
        ok: true,
        caso: {
          id: 'caso-1',
          usuarioId: 'u-1',
          semanaInicio: '2026-09-28',
          tipo: 'retiro',
          estado: 'firmado',
          rutaDecision: 'casos/u-1/2026-09-28/caso-1.json',
          rutaFirma: 'casos/u-1/2026-09-28/caso-1.json.sig',
          validaHasta: '2026-09-29T00:00:00Z',
          ordenId: 'orden-1',
          error: null,
          creadoEn: '2026-09-28T12:00:00Z',
          actualizadoEn: '2026-09-28T12:30:00Z',
        },
      })

      fireEvent.click(botonRegistrar)

      await waitFor(() =>
        expect(casosFirmaMock.subirFirma).toHaveBeenCalledWith('casos/u-1/2026-09-28/caso-1.json', archivoBueno),
      )
      await waitFor(() => expect(casosFirmaMock.registrarFirma).toHaveBeenCalledWith('caso-1'))
      await waitFor(() => expect(screen.getByText('Firma subida y registrada.')).toBeInTheDocument())
      expect(screen.getByText(/esperando verificación del equipo de mesa/)).toBeInTheDocument()
    })
  })
})
