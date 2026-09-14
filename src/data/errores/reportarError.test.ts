/**
 * La recogida de errores del navegador.
 *
 * POR QUÉ EXISTE. Del 10 al 12-sep el cribado falló para todo el mundo —37 llamadas con 42883
 * que la cola reintentó y apartó en silencio— y nadie se enteró hasta que Bryan oyó quejas. La
 * app se traga fallos a propósito, así que necesita contarlos en algún sitio. Pero quien los
 * cuenta corre en el teléfono de cada persona, en pleno entreno, y tiene tres prohibiciones:
 *
 *   1. Nunca rompe la app. Si el envío falla, se calla.
 *   2. Nunca inunda la base. El mismo fallo una vez por sesión, y un tope de envíos.
 *   3. Nunca manda más de lo que ya trae el error, y truncado.
 *
 * Las pruebas van en pareja: lo que se reporta y su gemela, lo que no.
 */
import { describe, expect, it, vi } from 'vitest'
import { crearReportador, type FilaError, type MemoriaDeSesion } from './reportarError'

function memoriaFalsa(): MemoriaDeSesion & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return {
    datos,
    getItem: (c) => datos.get(c) ?? null,
    setItem: (c, v) => void datos.set(c, v),
  }
}

function montar(extra: Partial<Parameters<typeof crearReportador>[0]> = {}) {
  const enviados: FilaError[] = []
  const enviar = vi.fn((fila: FilaError) => {
    enviados.push(fila)
  })
  const reportador = crearReportador({
    enviar,
    memoria: memoriaFalsa(),
    enLinea: () => true,
    pantalla: () => '/hoy',
    userAgent: () => 'Mozilla/5.0 (prueba)',
    version: 'abc123',
    ...extra,
  })
  return { reportador, enviar, enviados }
}

describe('reporta cuando hay error, y no cuando no', () => {
  it('reporta un error con su pantalla, su origen, dónde se tragó y la versión', () => {
    const { reportador, enviados } = montar()
    reportador.reportar(new Error('function contestar_cribado(jsonb) does not exist'), {
      donde: 'cola:contestar_cribado',
    })

    expect(enviados).toHaveLength(1)
    expect(enviados[0]).toMatchObject({
      pantalla: '/hoy',
      mensaje: 'function contestar_cribado(jsonb) does not exist',
      origen: 'reportado',
      donde: 'cola:contestar_cribado',
      user_agent: 'Mozilla/5.0 (prueba)',
      version: 'abc123',
    })
  })

  it('no reporta cuando no hay error que contar', () => {
    const { reportador, enviar } = montar()
    reportador.reportar(undefined)
    reportador.reportar(null)
    reportador.reportar('')
    expect(enviar).not.toHaveBeenCalled()
  })

  it('lee el mensaje y el código de un error de Supabase, que no es un Error', () => {
    const { reportador, enviados } = montar()
    reportador.reportar({ code: '42883', message: 'operator does not exist: boolean = text' })
    expect(enviados[0].mensaje).toBe('[42883] operator does not exist: boolean = text')
  })
})

describe('deduplica: el mismo mensaje una sola vez por sesión', () => {
  it('no reporta dos veces lo mismo', () => {
    const { reportador, enviar } = montar()
    reportador.reportar(new Error('Failed to fetch'))
    reportador.reportar(new Error('Failed to fetch'))
    reportador.reportar(new Error('Failed to fetch'))
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('sí reporta dos mensajes distintos', () => {
    const { reportador, enviar } = montar()
    reportador.reportar(new Error('Failed to fetch'))
    reportador.reportar(new Error('permission denied for table errores_navegador'))
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('una recarga de la pestaña no vuelve a mandar lo que ya se mandó', () => {
    // Un fallo que recarga la página en bucle abriría una «sesión» nueva en cada vuelta si la
    // memoria viviera solo en el módulo. Vive en sessionStorage, que sobrevive a la recarga.
    const memoria = memoriaFalsa()
    const primero = montar({ memoria })
    primero.reportador.reportar(new Error('Loading chunk 12 failed'))
    const trasRecargar = montar({ memoria })
    trasRecargar.reportador.reportar(new Error('Loading chunk 12 failed'))

    expect(primero.enviar).toHaveBeenCalledTimes(1)
    expect(trasRecargar.enviar).not.toHaveBeenCalled()
  })
})

describe('tope: nunca más de N envíos por sesión', () => {
  it('con más mensajes distintos que el tope, se para en el tope', () => {
    const { reportador, enviar } = montar({ tope: 5 })
    for (let i = 0; i < 12; i++) reportador.reportar(new Error(`fallo en bucle ${i}`))
    expect(enviar).toHaveBeenCalledTimes(5)
  })

  it('por debajo del tope, se mandan todos', () => {
    const { reportador, enviar } = montar({ tope: 5 })
    for (let i = 0; i < 5; i++) reportador.reportar(new Error(`fallo ${i}`))
    expect(enviar).toHaveBeenCalledTimes(5)
  })

  it('sin conexión no se manda, y tampoco se gasta: al volver la red, sí', () => {
    let enLinea = false
    const { reportador, enviar } = montar({ enLinea: () => enLinea })
    reportador.reportar(new Error('Failed to fetch'))
    expect(enviar).not.toHaveBeenCalled()

    enLinea = true
    reportador.reportar(new Error('Failed to fetch'))
    expect(enviar).toHaveBeenCalledTimes(1)
  })
})

describe('nunca lanza ni rompe la app', () => {
  it('no lanza si el envío revienta de forma síncrona', () => {
    const { reportador } = montar({
      enviar: () => {
        throw new Error('supabase no configurado')
      },
    })
    expect(() => reportador.reportar(new Error('algo'))).not.toThrow()
  })

  it('no deja una promesa rechazada suelta si el envío falla', async () => {
    const rechazos: unknown[] = []
    const alRechazo = (motivo: unknown) => rechazos.push(motivo)
    process.on('unhandledRejection', alRechazo)
    try {
      const { reportador } = montar({ enviar: () => Promise.reject(new Error('sin red')) })
      reportador.reportar(new Error('algo'))
      await new Promise((r) => setTimeout(r, 20))
      expect(rechazos).toEqual([])
    } finally {
      process.off('unhandledRejection', alRechazo)
    }
  })

  it('no lanza si sessionStorage está bloqueado, y sigue deduplicando en memoria', () => {
    const memoria: MemoriaDeSesion = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const { reportador, enviar } = montar({ memoria })
    expect(() => {
      reportador.reportar(new Error('algo'))
      reportador.reportar(new Error('algo'))
    }).not.toThrow()
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('no lanza con un error cuyo propio mensaje revienta al leerlo', () => {
    const { reportador } = montar()
    const venenoso = {
      get message(): string {
        throw new Error('getter roto')
      },
    }
    expect(() => reportador.reportar(venenoso)).not.toThrow()
  })

  it('cuando el envío sí funciona, la fila llega', () => {
    const { reportador, enviar } = montar()
    reportador.reportar(new Error('algo'))
    expect(enviar).toHaveBeenCalledTimes(1)
  })
})

describe('trunca y no añade datos personales', () => {
  it('recorta mensaje, pila y pantalla a lo que admite la tabla', () => {
    const { reportador, enviados } = montar({ pantalla: () => `/${'p'.repeat(400)}` })
    const err = new Error('m'.repeat(2000))
    err.stack = 's'.repeat(10000)
    reportador.reportar(err)

    expect(enviados[0].mensaje.length).toBeLessThanOrEqual(500)
    expect(enviados[0].pila!.length).toBeLessThanOrEqual(4000)
    expect(enviados[0].pantalla!.length).toBeLessThanOrEqual(200)
  })

  it('tapa un correo que venga dentro del mensaje o de la pila', () => {
    const { reportador, enviados } = montar()
    const err = new Error('Key (email)=(alguien@ejemplo.com) already exists')
    err.stack = 'Error: alguien@ejemplo.com\n    at x'
    reportador.reportar(err)

    expect(enviados[0].mensaje).not.toContain('alguien@ejemplo.com')
    expect(enviados[0].pila).not.toContain('alguien@ejemplo.com')
  })

  it('un mensaje sin correo llega tal cual', () => {
    const { reportador, enviados } = montar()
    reportador.reportar(new Error('permission denied for table cribado'))
    expect(enviados[0].mensaje).toBe('permission denied for table cribado')
  })
})

describe('escucha error y unhandledrejection', () => {
  function eventoError(error: unknown, message = ''): Event {
    return Object.assign(new Event('error'), { error, message })
  }
  function eventoRechazo(reason: unknown): Event {
    return Object.assign(new Event('unhandledrejection'), { reason })
  }

  it('reporta un error suelto de la ventana con origen window.error', () => {
    const { reportador, enviados } = montar()
    const destino = new EventTarget()
    reportador.instalar(destino)
    destino.dispatchEvent(eventoError(new TypeError("Cannot read properties of undefined (reading 'sets')")))

    expect(enviados).toHaveLength(1)
    expect(enviados[0].origen).toBe('window.error')
  })

  it('reporta una promesa rechazada sin catch con origen unhandledrejection', () => {
    const { reportador, enviados } = montar()
    const destino = new EventTarget()
    reportador.instalar(destino)
    destino.dispatchEvent(eventoRechazo(new Error('rpc caída')))

    expect(enviados).toHaveLength(1)
    expect(enviados[0].origen).toBe('unhandledrejection')
  })

  it('sin eventos no reporta nada, y tras desinstalar tampoco', () => {
    const { reportador, enviar } = montar()
    const destino = new EventTarget()
    const desinstalar = reportador.instalar(destino)
    expect(enviar).not.toHaveBeenCalled()

    desinstalar()
    destino.dispatchEvent(eventoError(new Error('después')))
    destino.dispatchEvent(eventoRechazo(new Error('después')))
    expect(enviar).not.toHaveBeenCalled()
  })
})
