import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Decision } from '../../data/consola/decisiones'

/**
 * La tarjeta «Decisiones compartidas» (0094). La sesión y la capa de datos se sustituyen en su
 * punto de entrada: aquí se prueba lo que la persona ve y lo que se manda, no la red.
 */
const estado = {
  rol: 'nutricionista' as 'nutricionista' | 'coach',
  lectura: { ok: true, datos: [] } as { ok: true; datos: Decision[] } | { ok: false; error: string },
  companeros: { ok: true, datos: [{ id: 'u-bryan', nombre: 'Bryan de prueba' }] } as
    | { ok: true; datos: { id: string; nombre: string }[] }
    | { ok: false; error: string },
  anotar: vi.fn(),
  firmar: vi.fn(),
  lecturas: 0,
}

vi.mock('../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({
    usuario: { id: estado.rol === 'coach' ? 'u-bryan' : 'u-manuela', nombre: 'Prueba', rol: estado.rol, avatarIniciales: 'PP' },
  }),
}))

vi.mock('../../data/consola/decisiones', async (original) => {
  const real = await original<typeof import('../../data/consola/decisiones')>()
  return {
    ...real,
    decisionesCompartidas: () => {
      estado.lecturas++
      return Promise.resolve(estado.lectura)
    },
    companerosDeDecision: () => Promise.resolve(estado.companeros),
    anotarDecision: (...a: unknown[]) => estado.anotar(...a),
    firmarDecision: (...a: unknown[]) => estado.firmar(...a),
  }
})

const { DecisionesCompartidas } = await import('./DecisionesCompartidas')

function decision(parcial: Partial<Decision> = {}): Decision {
  return {
    id: 'd-1',
    decididoPor: 'u-bryan',
    decididoPorNombre: 'Bryan de prueba',
    decididoEn: '2026-09-28',
    area: 'creadores',
    palanca: 'segmento',
    direccion: 'incluye',
    sujeto: 'negocio:segmento',
    valor: null,
    montoCop: null,
    periodicidad: null,
    vigenciaDesde: '2026-09-28',
    vigenciaHasta: null,
    resumen: 'Entrenadores que venden coaching → oferta de alquiler',
    notas: null,
    leTocaA: 'manuela',
    leTocaQue: 'preparar el mensaje',
    leTocaVence: null,
    firmaDe: null,
    firmaDeNombre: null,
    firmaNivel: null,
    firmaEstado: null,
    firmaVenceEn: null,
    firmaMotivo: null,
    faltan: [],
    programada: false,
    estado: 'vigente',
    ...parcial,
  }
}

beforeEach(() => {
  localStorage.clear()
  estado.rol = 'nutricionista'
  estado.lectura = { ok: true, datos: [] }
  estado.companeros = { ok: true, datos: [{ id: 'u-bryan', nombre: 'Bryan de prueba' }] }
  estado.anotar = vi.fn().mockResolvedValue({ ok: true, id: 'd-9' })
  estado.firmar = vi.fn().mockResolvedValue({ ok: true, id: 'd-1' })
  estado.lecturas = 0
})

describe('la lectura, con sus tres estados', () => {
  it('cargando primero, y luego el vacío CONFIRMADO', async () => {
    render(<DecisionesCompartidas puedeAnotar />)
    expect(screen.getByText('Cargando las decisiones…')).toBeInTheDocument()
    expect(await screen.findByText('Todavía no hay decisiones anotadas.')).toBeInTheDocument()
  })

  it('un error NO se pinta como «no hay decisiones»: se dice y se puede reintentar', async () => {
    estado.lectura = { ok: false, error: 'permiso denegado' }
    render(<DecisionesCompartidas puedeAnotar />)
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudieron leer las decisiones (permiso denegado)')
    expect(screen.queryByText('Todavía no hay decisiones anotadas.')).not.toBeInTheDocument()
    estado.lectura = { ok: true, datos: [decision()] }
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(/oferta de alquiler/)).toBeInTheDocument()
  })

  it('pinta quién decidió, la frase, a quién le toca y el estado', async () => {
    estado.lectura = { ok: true, datos: [decision()] }
    render(<DecisionesCompartidas puedeAnotar />)
    expect(await screen.findByText(/Bryan de prueba · 28 .+ · Creadores/i)).toBeInTheDocument()
    expect(screen.getByText(/le toca a Manuela: preparar el mensaje/)).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
  })

  it('en entrenamiento y nutrición no hay texto libre: la frase sale de los enums', async () => {
    estado.lectura = {
      ok: true,
      datos: [decision({ id: 'd-2', area: 'nutricion', palanca: 'plan_nuevo', direccion: 'inicia', resumen: null, estado: 'incompleta', faltan: ['FALTA: referencia al plan en la app'] })],
    }
    render(<DecisionesCompartidas puedeAnotar />)
    expect(await screen.findByText('Nutrición · plan nuevo · inicia')).toBeInTheDocument()
    expect(screen.getByText('FALTA: referencia al plan en la app')).toBeInTheDocument()
  })
})

describe('la firma del otro', () => {
  const porFirmar = () =>
    decision({
      firmaDe: 'u-manuela',
      firmaDeNombre: 'Manuela de prueba',
      firmaNivel: 'firma',
      firmaEstado: 'pendiente',
      firmaVenceEn: '2026-10-05',
      estado: 'propuesta',
    })

  it('a quien le toca firmar le salen «Firmar» y «No firmar»; firmar llama a la base y recarga', async () => {
    estado.lectura = { ok: true, datos: [porFirmar()] }
    render(<DecisionesCompartidas puedeAnotar />)
    fireEvent.click(await screen.findByRole('button', { name: 'Firmar' }))
    await waitFor(() => expect(estado.firmar).toHaveBeenCalledWith('d-1', 'firmada', undefined))
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(1))
  })

  it('rechazar pide el motivo: sin él no se puede', async () => {
    estado.lectura = { ok: true, datos: [porFirmar()] }
    render(<DecisionesCompartidas puedeAnotar />)
    fireEvent.click(await screen.findByRole('button', { name: 'No firmar' }))
    const rechazar = screen.getByRole('button', { name: 'Rechazar' })
    expect(rechazar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: 'falta el precio' } })
    expect(rechazar).toBeEnabled()
    fireEvent.click(rechazar)
    await waitFor(() => expect(estado.firmar).toHaveBeenCalledWith('d-1', 'rechazada', 'falta el precio'))
  })

  it('si la base rechaza la firma, lo dice', async () => {
    estado.firmar = vi.fn().mockResolvedValue({ ok: false, error: 'esta firma no te toca' })
    estado.lectura = { ok: true, datos: [porFirmar()] }
    render(<DecisionesCompartidas puedeAnotar />)
    fireEvent.click(await screen.findByRole('button', { name: 'Firmar' }))
    expect(await screen.findByText('esta firma no te toca')).toBeInTheDocument()
  })

  it('quien decidió no ve botones para firmar lo suyo; ve su estado', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [porFirmar()] }
    render(<DecisionesCompartidas puedeAnotar />)
    expect(await screen.findByText(/firma de Manuela de prueba: pendiente/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Firmar' })).not.toBeInTheDocument()
  })

  it('una firma vencida no se puede dar y se ve vencida', async () => {
    estado.lectura = { ok: true, datos: [{ ...porFirmar(), estado: 'vencida' }] }
    render(<DecisionesCompartidas puedeAnotar />)
    expect(await screen.findByText('Firma vencida')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Firmar' })).not.toBeInTheDocument()
  })
})

describe('anotar una decisión', () => {
  async function abrir() {
    render(<DecisionesCompartidas puedeAnotar />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Anotar mi decisión' }))
    return screen.getByRole('form', { name: 'Anotar una decisión' })
  }

  it('Manuela no ve finanzas ni las altas de creadores entre sus opciones (solo el coach)', async () => {
    const form = await abrir()
    const area = within(form).getByLabelText('Área')
    expect(Array.from((area as HTMLSelectElement).options).map((o) => o.value)).toEqual(['entrenamiento', 'nutricion', 'creadores'])
    const palanca = within(form).getByLabelText('Qué se decide') as HTMLSelectElement
    expect(Array.from(palanca.options).map((o) => o.value)).not.toContain('incorporacion')
    expect(Array.from(palanca.options).map((o) => o.value)).not.toContain('microprueba')
  })

  it('el coach sí ve finanzas', async () => {
    estado.rol = 'coach'
    const form = await abrir()
    const area = within(form).getByLabelText('Área') as HTMLSelectElement
    expect(Array.from(area.options).map((o) => o.value)).toContain('finanzas')
  })

  it('un texto con datos de salud no se envía: se avisa antes y no se llama a la base', async () => {
    const form = await abrir()
    fireEvent.change(within(form).getByLabelText(/En una frase/), { target: { value: 'bajar a 1.900 kcal' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Anotar decisión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/El resumen trae una cifra de carga o de comida/)
    expect(estado.anotar).not.toHaveBeenCalled()
  })

  it('en nutrición no hay campo de texto libre', async () => {
    const form = await abrir()
    fireEvent.change(within(form).getByLabelText('Área'), { target: { value: 'nutricion' } })
    expect(within(form).queryByLabelText(/En una frase/)).not.toBeInTheDocument()
    expect(within(form).getByText(/no se escribe texto/)).toBeInTheDocument()
  })

  it('manda la entrada con sus nombres y, al anotarse, cierra y recarga', async () => {
    const form = await abrir()
    fireEvent.change(within(form).getByLabelText(/En una frase/), { target: { value: 'Entrenadores → oferta de alquiler' } })
    fireEvent.change(within(form).getByLabelText('Quién firma'), { target: { value: 'u-bryan' } })
    fireEvent.change(within(form).getByLabelText('Plazo de la firma'), { target: { value: '2026-10-10' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Anotar decisión' }))
    await waitFor(() => expect(estado.anotar).toHaveBeenCalledTimes(1))
    expect(estado.anotar.mock.calls[0][0]).toMatchObject({
      area: 'creadores',
      palanca: 'puerta_nicho',
      sujeto: 'negocio:puerta_nicho',
      resumen: 'Entrenadores → oferta de alquiler',
      firmaDe: 'u-bryan',
      firmaNivel: 'firma',
      firmaVenceEn: '2026-10-10',
    })
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Anotar una decisión' })).not.toBeInTheDocument())
    expect(localStorage.getItem('alpha.decisiones.borrador')).toBeNull()
  })

  it('si la base no la anota, dice «NO ANOTADA», conserva lo escrito y deja reintentar', async () => {
    estado.anotar = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'sin conexión' })
      .mockResolvedValueOnce({ ok: true, id: 'd-9' })
    const form = await abrir()
    fireEvent.change(within(form).getByLabelText(/En una frase/), { target: { value: 'Oferta de alquiler' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Anotar decisión' }))
    expect(await screen.findByText('NO ANOTADA: sin conexión')).toBeInTheDocument()
    // Lo escrito sigue ahí, en pantalla y en el dispositivo, y el botón ya dice «Reintentar».
    expect(within(form).getByLabelText(/En una frase/)).toHaveValue('Oferta de alquiler')
    expect(localStorage.getItem('alpha.decisiones.borrador')).toContain('Oferta de alquiler')
    fireEvent.click(within(form).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(estado.anotar).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(localStorage.getItem('alpha.decisiones.borrador')).toBeNull())
  })

  it('una decisión que quedó sin anotar reabre el formulario con lo escrito', async () => {
    localStorage.setItem(
      'alpha.decisiones.borrador',
      JSON.stringify({
        area: 'creadores', palanca: 'segmento', direccion: 'incluye', sujetoTipo: 'negocio', sujetoEquipo: 'manuela', seudonimo: '',
        resumen: 'Quedó pendiente', monto: '', periodicidad: '', referenciaTabla: '', referenciaId: '', leTocaA: '', leTocaQue: '',
        leTocaVence: '', firmaDe: '', firmaNivel: 'firma', firmaVenceEn: '',
      }),
    )
    render(<DecisionesCompartidas puedeAnotar />)
    expect(await screen.findByLabelText(/En una frase/)).toHaveValue('Quedó pendiente')
  })

  it('sin el permiso no hay botón para anotar y se dice por qué', async () => {
    render(<DecisionesCompartidas puedeAnotar={false} />)
    await screen.findByText('Todavía no hay decisiones anotadas.')
    expect(screen.queryByRole('button', { name: '+ Anotar mi decisión' })).not.toBeInTheDocument()
    expect(screen.getByText(/pide el permiso de decisiones compartidas/)).toBeInTheDocument()
  })
})
