import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DerechosPage from './DerechosPage'

const DERECHOS = [
  ['conocer', 'Conocer mis datos'],
  ['actualizar_rectificar', 'Actualizar o rectificar mis datos'],
  ['prueba_autorizacion', 'Pedir prueba de mi autorización'],
  ['revocar', 'Revocar la autorización'],
  ['supresion', 'Pedir supresión de mis datos'],
] as const

const nube = vi.hoisted(() => {
  const estado = {
    sesion: { user: { id: 'persona-sintetica' } } as { user: { id: string } } | null,
    coach: 'coach-sintetico' as string | null,
    fallo: null as { message: string } | null,
    consulta: { persona: '', vigente: '' as unknown },
    alCambiar: null as ((evento: string, sesion: { user: { id: string } } | null) => void) | null,
  }
  return { estado, insertar: vi.fn(), avisar: vi.fn(), seleccionar: vi.fn(), desde: vi.fn(), sesion: vi.fn(), modoNube: true }
})
vi.mock('../../data/supabase', () => ({
  get modoNube() { return nube.modoNube },
  supabase: () => ({
    auth: {
      getSession: nube.sesion,
      onAuthStateChange: (fn: typeof nube.estado.alCambiar) => {
        nube.estado.alCambiar = fn
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    from: nube.desde,
  }),
}))

function montar(ruta = '/yo/derechos') {
  return render(<MemoryRouter initialEntries={[ruta]}><DerechosPage /></MemoryRouter>)
}
async function formulario() {
  montar()
  return screen.findByRole('button', { name: 'Enviar solicitud' })
}

beforeEach(() => {
  vi.clearAllMocks()
  nube.modoNube = true
  nube.estado.sesion = { user: { id: 'persona-sintetica' } }
  nube.estado.coach = 'coach-sintetico'
  nube.estado.fallo = null
  nube.estado.consulta = { persona: '', vigente: 'sin-filtrar' }
  nube.sesion.mockImplementation(async () => ({ data: { session: nube.estado.sesion }, error: null }))
  nube.avisar.mockResolvedValue({ error: null })
  nube.seleccionar.mockImplementation(() => ({ single: async () => ({
    data: nube.estado.fallo ? null : { id: 'solicitud-sintetica', creada_en: '2026-11-06T14:30:00Z' }, error: nube.estado.fallo,
  }) }))
  nube.insertar.mockImplementation(() => ({ select: nube.seleccionar }))
  nube.desde.mockImplementation((tabla: string) => {
    if (tabla === 'solicitudes_derechos') return { insert: nube.insertar }
    if (tabla === 'mensajes') return { insert: nube.avisar }
    if (tabla !== 'asignaciones_coach') throw new Error(`Tabla inesperada: ${tabla}`)
    return { select: (columnas: string) => {
      expect(columnas).toBe('coach_id')
      return { eq: (columna: string, valor: string) => {
        expect(columna).toBe('persona_id')
        nube.estado.consulta.persona = valor
        return { is: (columna: string, valor: unknown) => {
          expect(columna).toBe('asignado_hasta')
          nube.estado.consulta.vigente = valor
          return { maybeSingle: async () => ({ data: nube.estado.coach ? { coach_id: nube.estado.coach } : null, error: null }) }
        } }
      } }
    } }
  })
})

describe('Solicitud de derechos, Supabase simulado; sin red ni cuentas reales', () => {
  it.each(['error devuelto', 'promesa rechazada'])('si el aviso falla (%s), conserva constancia y nota sin repetir el insert', async (modo) => {
    if (modo === 'error devuelto') nube.avisar.mockResolvedValue({ error: { message: 'fallo del aviso' } })
    else nube.avisar.mockRejectedValue(new Error('fallo del aviso'))
    const boton = await formulario()
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: 'Detalle privado sintético' } })
    fireEvent.click(boton)
    expect(await screen.findByText('Tu solicitud quedó guardada; avísale a tu coach por el chat.')).toBeInTheDocument()
    const constancia = screen.getByRole('status')
    expect(constancia.querySelector('time')).toHaveAttribute('datetime', '2026-11-06T14:30:00Z')
    expect(constancia).toHaveTextContent('Conocer mis datos')
    expect(nube.insertar).toHaveBeenCalledTimes(1)
    expect(nube.avisar).toHaveBeenCalledTimes(1)
    expect(nube.avisar.mock.calls[0][0].texto).not.toContain('Detalle privado sintético')
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('bloquea el doble envío y una nueva solicitud mientras termina el aviso', async () => {
    let terminar!: (valor: { error: null }) => void
    nube.avisar.mockImplementation(() => new Promise((resolve) => { terminar = resolve }))
    const boton = await formulario()
    fireEvent.submit(boton.closest('form')!)
    fireEvent.submit(boton.closest('form')!)
    await screen.findByRole('status')
    expect(nube.insertar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Nueva solicitud' })).toBeDisabled()
    await act(async () => terminar({ error: null }))
    expect(screen.getByRole('button', { name: 'Nueva solicitud' })).toBeEnabled()
    expect(nube.avisar).toHaveBeenCalledTimes(1)
  })

  it('convierte el detalle de espacios en null', async () => {
    const boton = await formulario()
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: '   ' } })
    fireEvent.click(boton)
    await screen.findByRole('status')
    expect(nube.insertar.mock.calls[0][0].detalle).toBeNull()
  })

  it('al cambiar de sesión limpia detalle y constancia, incluso si el aviso anterior falla después', async () => {
    let terminar!: (valor: { error: { message: string } }) => void
    nube.avisar.mockImplementation(() => new Promise((resolve) => { terminar = resolve }))
    const boton = await formulario()
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: 'Detalle anterior' } })
    fireEvent.click(boton)
    await screen.findByRole('status')
    act(() => nube.estado.alCambiar?.('SIGNED_IN', { user: { id: 'otra-persona' } }))
    await act(async () => terminar({ error: { message: 'fallo tardío' } }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Texto opcional')).toHaveValue('')
    expect(screen.queryByText(/Tu solicitud quedó guardada/)).not.toBeInTheDocument()
  })

  it('en modo demo avisa y no consulta ni guarda', () => {
    nube.modoNube = false
    montar()
    expect(screen.getByText(/En este modo de prueba no se envía nada/)).toBeInTheDocument()
    expect(nube.sesion).not.toHaveBeenCalled()
    expect(nube.desde).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument()
  })

  it.each(DERECHOS)('guarda %s para el coach vigente y muestra la fecha confirmada', async (tipo, etiqueta) => {
    const boton = await formulario()
    fireEvent.change(screen.getByLabelText('Derecho que deseas solicitar'), { target: { value: tipo } })
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: 'Detalle sintético' } })
    fireEvent.click(boton)
    const constancia = await screen.findByRole('status')
    expect(nube.estado.consulta).toEqual({ persona: 'persona-sintetica', vigente: null })
    expect(nube.insertar).toHaveBeenCalledTimes(1)
    expect(nube.insertar).toHaveBeenCalledWith({
      persona_id: 'persona-sintetica', coach_id: 'coach-sintetico',
      derecho: tipo, detalle: 'Detalle sintético',
    })
    expect(nube.seleccionar).toHaveBeenCalledWith('id, creada_en')
    await waitFor(() => expect(nube.avisar).toHaveBeenCalledTimes(1))
    expect(nube.avisar).toHaveBeenCalledWith({
      id: expect.any(String), de_id: 'persona-sintetica', para_id: 'coach-sintetico', origen: 'humano',
      texto: `[Solicitud de derechos: ${tipo}] Nueva solicitud: ${etiqueta}`,
    })
    expect(nube.avisar.mock.calls[0][0].texto).not.toContain('Detalle sintético')
    expect(constancia).toHaveTextContent(etiqueta)
    expect(constancia.querySelector('time')).toHaveAttribute('datetime', '2026-11-06T14:30:00Z')
    expect(constancia.querySelector('time')).toHaveTextContent('6 de noviembre de 2026')
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument()
  })

  it('sin sesión no aparece ni consulta asignación ni inserta', async () => {
    nube.estado.sesion = null
    const { container } = montar()
    await waitFor(() => expect(nube.sesion).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
    expect(nube.desde).not.toHaveBeenCalled()
    expect(nube.insertar).not.toHaveBeenCalled()
  })

  it('con 501 caracteres no envía aunque se fuerce el evento', async () => {
    const boton = await formulario()
    expect(screen.getByLabelText('Texto opcional')).toHaveAttribute('maxlength', '500')
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: 'x'.repeat(501) } })
    fireEvent.click(boton)
    expect(await screen.findByRole('alert')).toHaveTextContent('500')
    expect(nube.insertar).not.toHaveBeenCalled()
    expect(nube.desde).not.toHaveBeenCalled()
  })

  it('admite exactamente 500 caracteres y envío sin detalle', async () => {
    const boton = await formulario()
    fireEvent.change(screen.getByLabelText('Texto opcional'), { target: { value: 'x'.repeat(500) } })
    fireEvent.click(boton)
    await screen.findByRole('status')
    expect(nube.insertar.mock.calls[0][0].detalle).toBe('x'.repeat(500))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva solicitud' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    await screen.findByRole('status')
    expect(nube.insertar.mock.calls[1][0].detalle).toBeNull()
  })

  it('si caducó la sesión con el formulario abierto no envía y lo oculta', async () => {
    const boton = await formulario()
    nube.estado.sesion = null
    fireEvent.click(boton)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument())
    expect(nube.desde).not.toHaveBeenCalled()
    expect(nube.insertar).not.toHaveBeenCalled()
  })

  it('al cerrar sesión oculta la pantalla', async () => {
    await formulario()
    act(() => nube.estado.alCambiar?.('SIGNED_OUT', null))
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(nube.insertar).not.toHaveBeenCalled()
  })

  it('sin coach vigente no elige uno por defecto ni guarda constancia', async () => {
    nube.estado.coach = null
    fireEvent.click(await formulario())
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay un coach asignado')
    expect(nube.insertar).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra el error de base literal y permite reintentar', async () => {
    nube.estado.fallo = { message: 'new row violates row-level security policy for table "solicitudes_derechos"' }
    fireEvent.click(await formulario())
    expect(await screen.findByRole('alert')).toHaveTextContent(nube.estado.fallo.message)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(nube.avisar).not.toHaveBeenCalled()
    nube.estado.fallo = null
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    await screen.findByRole('status')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // 6-nov (Bryan): todo en tú. La app no guarda el trato por persona; un dato de la dirección no lo cambia.
  it('habla siempre de tú, aunque la dirección pida usted, y conserva la advertencia literal', async () => {
    const { container } = montar('/yo/derechos?trato=usted')
    expect(await screen.findByRole('heading')).toHaveTextContent('Tus datos y derechos')
    expect(screen.getByLabelText('Derecho que deseas solicitar')).toBeInTheDocument()
    expect(screen.getByText(/No escribas datos de salud ni nombres/)).toBeInTheDocument()
    expect(screen.getByText('Nadie de Alpha te pedira tu clave por chat, correo o WhatsApp; si alguien lo hace, no se la des.')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\b(Sus|sus|su|Su|Puede|desea|escriba|usted|Usted)\b/)
  })

  it('si falla leer la sesión, lo dice en vez de quedar en blanco', async () => {
    nube.sesion.mockImplementation(async () => ({ data: { session: null }, error: { message: 'fallo sintético de sesión' } }))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('fallo sintético de sesión')
    expect(nube.desde).not.toHaveBeenCalled()
  })
})
