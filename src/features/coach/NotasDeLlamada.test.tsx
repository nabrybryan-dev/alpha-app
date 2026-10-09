import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listarMock = vi.fn()
const agregarMock = vi.fn()

// Se conserva el módulo REAL salvo las dos funciones que hablan con la base: `fechaDeLlamada`
// y `horaDeLlamada` son las de producción, así que lo que estas pruebas leen en pantalla es
// lo que de verdad se pinta.
vi.mock('../../data/consola/notasLlamada', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/consola/notasLlamada')>()),
  notasLlamadaDe: (...args: unknown[]) => listarMock(...args),
  agregarNotaLlamada: (...args: unknown[]) => agregarMock(...args),
}))

vi.mock('../../data/dbInstance', () => ({
  hoyIso: () => '2026-10-08',
  db: {
    usuarios: {
      byId: (id: string) => (id === 'u-manuela' ? { id, nombre: 'Manuela' } : undefined),
    },
  },
}))

const { NotasDeLlamada } = await import('./NotasDeLlamada')

const CLAVE_U1 = 'notas-llamada:borrador:u-1'
const ERROR_CARGA = 'No se pudieron cargar las notas de llamada.'

function nota(extra: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    usuarioId: 'u-1',
    coachId: 'u-manuela',
    fecha: '2026-10-01',
    // Tal como la devuelve la base: con segundos.
    hora: '17:00:00',
    conclusiones: 'Le cuesta el desayuno antes de entrenar.',
    tareas: null,
    proximaReunion: 'en 2 semanas',
    creadoEn: '2026-10-01T22:00:00Z',
    ...extra,
  }
}

const lista = (...notas: ReturnType<typeof nota>[]) => ({ ok: true, notas })
const falla = () => ({ ok: false, error: ERROR_CARGA })

beforeEach(() => {
  listarMock.mockReset().mockResolvedValue(lista())
  agregarMock.mockReset()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Abre el formulario ya con la carga inicial asentada (si no, su `setNotas` cae fuera de
 *  `act()` en mitad de la prueba siguiente). */
async function abrirFormulario(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Todavía no hay llamadas anotadas.')
  await user.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
}

describe('NotasDeLlamada · lo que se lee', () => {
  it('pinta las notas que ya existen, en el orden en que las manda el servicio', async () => {
    listarMock.mockResolvedValue(
      lista(
        nota({ id: 'n-2', conclusiones: 'La más reciente.', fecha: '2026-10-08', proximaReunion: null }),
        nota({ id: 'n-1', conclusiones: 'La más vieja.' }),
      ),
    )
    render(<NotasDeLlamada usuarioId="u-1" />)

    await screen.findByText('La más reciente.')
    const textos = screen.getAllByText(/^La más/).map((e) => e.textContent)
    expect(textos).toEqual(['La más reciente.', 'La más vieja.'])
    expect(screen.getByText('Próxima reunión: en 2 semanas', { selector: 'p' })).toBeInTheDocument()
  })

  it('la cabecera trae día de la semana, fecha legible, hora SIN segundos y quién la escribió', async () => {
    listarMock.mockResolvedValue(lista(nota({ fecha: '2026-10-08', hora: '18:30:00' })))
    render(<NotasDeLlamada usuarioId="u-1" />)

    expect(await screen.findByText('jue 8 oct 2026 · 18:30 · Manuela')).toBeInTheDocument()
    expect(screen.queryByText(/18:30:00/)).not.toBeInTheDocument()
  })

  it('una nota sin hora no deja un «·» suelto', async () => {
    listarMock.mockResolvedValue(lista(nota({ fecha: '2026-10-08', hora: null })))
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByText('jue 8 oct 2026 · Manuela')).toBeInTheDocument()
  })

  it('si el autor no está en la cartera local, dice «alguien del equipo» en vez de dejarlo en blanco', async () => {
    listarMock.mockResolvedValue(lista(nota({ coachId: 'u-desconocido' })))
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByText('jue 1 oct 2026 · 17:00 · alguien del equipo')).toBeInTheDocument()
  })

  it('las tareas se pintan como «Tareas: …» respetando los saltos de línea', async () => {
    listarMock.mockResolvedValue(lista(nota({ tareas: 'Mandar el menú\nMedir cintura' })))
    render(<NotasDeLlamada usuarioId="u-1" />)

    const tareas = await screen.findByText(/^Tareas:/)
    expect(tareas.textContent).toBe('Tareas: Mandar el menú\nMedir cintura')
    expect(tareas).toHaveClass('whitespace-pre-wrap')
  })

  it('una nota sin tareas no pinta la línea «Tareas:»', async () => {
    listarMock.mockResolvedValue(lista(nota({ tareas: null })))
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Le cuesta el desayuno antes de entrenar.')
    expect(screen.queryByText(/Tareas:/)).not.toBeInTheDocument()
  })

  it('sin ninguna todavía, lo dice en vez de dejar la tarjeta vacía', async () => {
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByText('Todavía no hay llamadas anotadas.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('NotasDeLlamada · cuando la carga falla', () => {
  it('avisa con role=alert y ofrece Reintentar; NUNCA dice «todavía no hay llamadas»', async () => {
    listarMock.mockResolvedValue(falla())
    render(<NotasDeLlamada usuarioId="u-1" />)

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(ERROR_CARGA)
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay llamadas anotadas.')).not.toBeInTheDocument()
  })

  it('Reintentar vuelve a pedir la lista y, si ahora llega, la pinta y quita el aviso', async () => {
    listarMock.mockResolvedValueOnce(falla()).mockResolvedValueOnce(lista(nota()))
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Le cuesta el desayuno antes de entrenar.')).toBeInTheDocument()
    expect(listarMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('si Reintentar vuelve a fallar, sigue el aviso y sigue sin decir «todavía no hay llamadas»', async () => {
    listarMock.mockResolvedValue(falla())
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_CARGA)
    expect(listarMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Todavía no hay llamadas anotadas.')).not.toBeInTheDocument()
  })
})

describe('NotasDeLlamada · anotar', () => {
  it('el botón «Guardar nota» empieza deshabilitado sin conclusiones', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    expect(screen.getByRole('button', { name: 'Guardar nota' })).toBeDisabled()
  })

  it('el formulario tiene el campo opcional «Tareas que quedan (opcional)» entre lo hablado y la próxima reunión', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)

    const hablado = screen.getByLabelText('Qué se habló')
    const tareas = screen.getByLabelText('Tareas que quedan (opcional)')
    const proxima = screen.getByLabelText('Próxima reunión (opcional)')
    expect(tareas.tagName).toBe('TEXTAREA')
    expect(tareas).toHaveAttribute('rows', '2')
    // Orden en el documento: hablado → tareas → próxima.
    expect(hablado.compareDocumentPosition(tareas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tareas.compareDocumentPosition(proxima) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('guarda con sus tareas y VUELVE A PEDIR la lista: el orden en pantalla es el del servidor', async () => {
    const guardada = nota({ id: 'n-nueva', conclusiones: 'Nueva llamada.', tareas: 'Subir la carga', fecha: '2026-10-05' })
    const reciente = nota({ id: 'n-reciente', conclusiones: 'Llamada de hoy.', fecha: '2026-10-08' })
    // Antes de guardar solo estaba «Llamada de hoy»; el servidor, al recargar, pone la nueva
    // DEBAJO (su fecha es anterior). Anteponerla a mano la dejaría arriba: distinto de al cargar.
    listarMock.mockResolvedValueOnce(lista(reciente)).mockResolvedValueOnce(lista(reciente, guardada))
    agregarMock.mockResolvedValue({ ok: true, nota: guardada })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Llamada de hoy.')

    await user.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    await user.type(screen.getByLabelText('Qué se habló'), 'Nueva llamada.')
    await user.type(screen.getByLabelText('Tareas que quedan (opcional)'), 'Subir la carga')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('Nueva llamada.', { selector: 'p' })).toBeInTheDocument()
    expect(agregarMock).toHaveBeenCalledWith('u-1', {
      fecha: '2026-10-08',
      hora: undefined,
      conclusiones: 'Nueva llamada.',
      tareas: 'Subir la carga',
      proximaReunion: undefined,
    })
    expect(listarMock).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText(/^(Nueva llamada|Llamada de hoy)\./, { selector: 'p' }).map((e) => e.textContent)).toEqual([
      'Llamada de hoy.',
      'Nueva llamada.',
    ])
    expect(screen.getByText('Tareas: Subir la carga')).toBeInTheDocument()
    // El formulario se cierra tras guardar.
    expect(screen.queryByRole('button', { name: 'Guardar nota' })).not.toBeInTheDocument()
  })

  it('si la recarga tras guardar falla, la nota nueva queda ARRIBA de las que ya había', async () => {
    const guardada = nota({ id: 'n-nueva', conclusiones: 'Nueva llamada.' })
    listarMock
      .mockResolvedValueOnce(lista(nota({ id: 'n-vieja', conclusiones: 'Vieja llamada.' })))
      .mockResolvedValueOnce(falla())
    agregarMock.mockResolvedValue({ ok: true, nota: guardada })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Vieja llamada.')

    await user.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    await user.type(screen.getByLabelText('Qué se habló'), 'Nueva llamada.')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('Nueva llamada.', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getAllByText(/^(Nueva|Vieja) llamada\./, { selector: 'p' }).map((e) => e.textContent)).toEqual([
      'Nueva llamada.',
      'Vieja llamada.',
    ])
  })

  it('si la base rechaza, enseña el error y no limpia lo que ya había escrito', async () => {
    agregarMock.mockResolvedValue({ ok: false, error: 'No tienes permiso para anotar llamadas de este asesorado.' })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)

    await user.type(screen.getByLabelText('Qué se habló'), 'Algo que se pierde si recarga')
    await user.type(screen.getByLabelText('Tareas que quedan (opcional)'), 'Una tarea')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('No tienes permiso para anotar llamadas de este asesorado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Qué se habló')).toHaveValue('Algo que se pierde si recarga')
    expect(screen.getByLabelText('Tareas que quedan (opcional)')).toHaveValue('Una tarea')
    // Un guardado fallido no es un guardado: el borrador sigue ahí.
    expect(window.sessionStorage.getItem(CLAVE_U1)).not.toBeNull()
  })

  it('el guardado no se dispara dos veces aunque se insista mientras la base contesta', async () => {
    let terminar: (valor: unknown) => void = () => {}
    agregarMock.mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    // La recarga tras guardar devuelve lo que ahora hay en la base: la nota ya está.
    listarMock.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(nota({ conclusiones: 'Una sola vez' })))
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Una sola vez')

    const guardar = screen.getByRole('button', { name: 'Guardar nota' })
    await user.click(guardar)
    await user.click(guardar)
    await user.click(guardar)

    expect(agregarMock).toHaveBeenCalledTimes(1)
    terminar({ ok: true, nota: nota({ conclusiones: 'Una sola vez' }) })
    // `selector: 'p'`: el texto también está en el cuadro del formulario hasta que se cierra.
    expect(await screen.findByText('Una sola vez', { selector: 'p' })).toBeInTheDocument()
    expect(agregarMock).toHaveBeenCalledTimes(1)
  })

  it('los botones miden al menos 44 px y las etiquetas de campo son de 12 px (text-xs), no de 11', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Todavía no hay llamadas anotadas.')
    expect(screen.getByRole('button', { name: '+ Anotar llamada' })).toHaveClass('min-h-[44px]')

    await user.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    expect(screen.getByRole('button', { name: 'Guardar nota' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('min-h-[44px]')
    for (const etiqueta of ['Qué se habló', 'Tareas que quedan (opcional)', 'Próxima reunión (opcional)']) {
      const label = screen.getByText(etiqueta)
      expect(label).toHaveClass('text-xs')
      expect(label.className).not.toContain('text-[11px]')
    }
  })

  it('Reintentar mide al menos 44 px', async () => {
    listarMock.mockResolvedValue(falla())
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveClass('min-h-[44px]')
  })
})

describe('NotasDeLlamada · el borrador no se pierde', () => {
  it('lo escrito sobrevive a desmontar y volver a montar (cambiar de pestaña de la consola)', async () => {
    const user = userEvent.setup()
    const primera = render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('Hora (opcional)'), { target: { value: '18:30' } })
    await user.type(screen.getByLabelText('Qué se habló'), 'Hablamos de la sentadilla')
    await user.type(screen.getByLabelText('Tareas que quedan (opcional)'), 'Mandar el menú')
    await user.type(screen.getByLabelText('Próxima reunión (opcional)'), 'en 2 semanas')
    primera.unmount()

    render(<NotasDeLlamada usuarioId="u-1" />)

    // El formulario vuelve ABIERTO, con todo lo que había.
    expect(await screen.findByLabelText('Qué se habló')).toHaveValue('Hablamos de la sentadilla')
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-05')
    expect(screen.getByLabelText('Hora (opcional)')).toHaveValue('18:30')
    expect(screen.getByLabelText('Tareas que quedan (opcional)')).toHaveValue('Mandar el menú')
    expect(screen.getByLabelText('Próxima reunión (opcional)')).toHaveValue('en 2 semanas')
  })

  it('el borrador es de cada asesorado: el de uno no aparece en otro', async () => {
    const user = userEvent.setup()
    const primera = render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Solo de u-1')
    primera.unmount()

    render(<NotasDeLlamada usuarioId="u-2" />)
    await screen.findByText('Todavía no hay llamadas anotadas.')
    expect(screen.queryByLabelText('Qué se habló')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem('notas-llamada:borrador:u-1')).not.toBeNull()
    expect(window.sessionStorage.getItem('notas-llamada:borrador:u-2')).toBeNull()
  })

  it('se guarda en sessionStorage con la clave notas-llamada:borrador:<usuarioId> en cada cambio', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Hola')

    const guardado = JSON.parse(window.sessionStorage.getItem(CLAVE_U1) ?? 'null')
    expect(guardado).toMatchObject({ abierto: true, fecha: '2026-10-08', hora: '', conclusiones: 'Hola', tareas: '', proximaReunion: '' })
  })

  it('al guardar bien se borra: ni queda en sessionStorage ni vuelve el formulario abierto', async () => {
    agregarMock.mockResolvedValue({ ok: true, nota: nota({ conclusiones: 'Guardada.' }) })
    listarMock.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(nota({ conclusiones: 'Guardada.' })))
    const user = userEvent.setup()
    const primera = render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Guardada.')
    expect(window.sessionStorage.getItem(CLAVE_U1)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))
    await screen.findByText('Guardada.', { selector: 'p' })

    expect(window.sessionStorage.getItem(CLAVE_U1)).toBeNull()
    primera.unmount()
    listarMock.mockResolvedValue(lista(nota({ conclusiones: 'Guardada.' })))
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Guardada.', { selector: 'p' })
    expect(screen.queryByLabelText('Qué se habló')).not.toBeInTheDocument()
  })

  it('al pulsar Cancelar se borra y la próxima vez el formulario abre limpio', async () => {
    const user = userEvent.setup()
    const primera = render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Mejor no')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(window.sessionStorage.getItem(CLAVE_U1)).toBeNull()
    primera.unmount()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Todavía no hay llamadas anotadas.')
    await user.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    expect(screen.getByLabelText('Qué se habló')).toHaveValue('')
  })

  it('un borrador ilegible (JSON roto) se ignora: el componente arranca como siempre', async () => {
    window.sessionStorage.setItem(CLAVE_U1, '{esto no es json')
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByText('Todavía no hay llamadas anotadas.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Qué se habló')).not.toBeInTheDocument()
  })

  it('sin sessionStorage (lanza al leer y al escribir) funciona igual que sin borrador', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    agregarMock.mockResolvedValue({ ok: true, nota: nota({ conclusiones: 'Sin almacenamiento.' }) })
    listarMock
      .mockResolvedValueOnce(lista())
      .mockResolvedValueOnce(lista(nota({ conclusiones: 'Sin almacenamiento.' })))
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await abrirFormulario(user)
    await user.type(screen.getByLabelText('Qué se habló'), 'Sin almacenamiento.')
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(agregarMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Sin almacenamiento.', { selector: 'p' })).toBeInTheDocument()
  })
})
