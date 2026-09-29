// @vitest-environment node
/**
 * La Edge Function `salud-atajo` (Fase A de salud del celular).
 *
 * El repo prueba sus funciones de Supabase con vitest importando el archivo tal cual
 * (`respuestaChat.test.ts` hace lo mismo con `responder-chat`): no hay Deno en esta
 * máquina y la función es un solo archivo que se pega en el panel.
 *
 * Qué se comprueba, y por qué es lo que importa:
 *   1. La puerta: sin código, con código mal formado, desconocido, revocado, sin la casilla
 *      E o pasado de frecuencia, NO se guarda nada.
 *   2. Solo entra lo plausible: los 6 tipos, con su unidad y su rango. Lo demás se descarta
 *      con su motivo y sin repetir el valor.
 *   3. Idempotente: el mismo envío dos veces deja el mismo estado.
 *   4. Nada sensible en los registros: ni valores, ni el código, ni el hash, ni el error de
 *      la base (que puede repetir la fila).
 *   5. Los números y la unidad de la función son los de la CHECK de la migración 0093, y el
 *      hash es el que calcula la base.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ErrorDeAlmacen,
  LIMITE_POR_HORA,
  MAX_BYTES,
  MAX_DIAS_ATRAS,
  MAX_MUESTRAS,
  RANGOS,
  almacenSupabase,
  hashDeToken,
  leerFecha,
  leerNumero,
  leerToken,
  manejar,
  validarMuestras,
  type Almacen,
  type FilaMuestra,
  type ResultadoAutorizar,
} from '../../supabase/functions/salud-atajo/index.ts'

const RUTA_FUNCION = join(process.cwd(), 'supabase', 'functions', 'salud-atajo', 'index.ts')
const RUTA_MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0093_salud_del_celular_atajo.sql')

// Un mediodía de Bogotá: 2026-09-28 12:00 (-05:00) = 17:00 UTC.
const AHORA = new Date('2026-09-28T17:00:00Z')
const TOKEN = 'sa_' + 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12'
const USUARIO = '11111111-1111-4111-8111-111111111111'

// ─── Un almacén en memoria que se comporta como las dos funciones SQL ───────

class AlmacenFalso implements Almacen {
  filas = new Map<string, FilaMuestra & { usuarioId: string }>()
  autorizaciones: string[] = []
  respuesta: ResultadoAutorizar = { estado: 'ok', usuarioId: USUARIO }
  falla: Error | null = null

  async autorizar(hash: string): Promise<ResultadoAutorizar> {
    this.autorizaciones.push(hash)
    if (this.falla) throw this.falla
    return this.respuesta
  }

  async guardar(usuarioId: string, filas: FilaMuestra[]): Promise<number> {
    if (this.falla) throw this.falla
    for (const f of filas) this.filas.set(`${usuarioId}|${f.fecha}|${f.tipo}|atajo`, { ...f, usuarioId })
    return filas.length
  }
}

function peticion(cuerpo: unknown, cabeceras: Record<string, string> = { 'x-alpha-token': TOKEN }, metodo = 'POST') {
  return new Request('https://ejemplo.test/functions/v1/salud-atajo', {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabeceras },
    body: metodo === 'POST' ? (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  })
}

const ENVIO_BUENO = {
  muestras: [
    { fecha: '2026-09-28', tipo: 'pasos', valor: 8123 },
    { fecha: '2026-09-28', tipo: 'peso', valor: 72.4 },
    { fecha: '2026-09-27', tipo: 'sueno', valor: 7.5 },
  ],
}

let registros: string[]
let espias: ReturnType<typeof vi.spyOn>[]

beforeEach(() => {
  registros = []
  espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
    vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
      registros.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }),
  )
})
afterEach(() => espias.forEach((e) => e.mockRestore()))

const deps = (almacen: Almacen) => ({ almacen, ahora: () => AHORA })

// ═══════════════════════════════════════════════════════════════════════════
// El código
// ═══════════════════════════════════════════════════════════════════════════

describe('leerToken', () => {
  it('acepta sa_ + 40 hexadecimales, y tolera mayúsculas y espacios que mete el teléfono', () => {
    expect(leerToken(TOKEN)).toBe(TOKEN)
    expect(leerToken(`  ${TOKEN.toUpperCase()}\n`)).toBe(TOKEN)
    // iOS pone la primera letra en mayúscula al pegar en un campo de texto.
    expect(leerToken('S' + TOKEN.slice(1))).toBe(TOKEN)
  })

  it('rechaza lo que no es un código: vacío, corto, largo, otro prefijo, no hexadecimal', () => {
    for (const malo of [null, '', 'sa_', 'sa_abc', TOKEN + '0', 'xx_' + TOKEN.slice(3), 'sa_' + 'z'.repeat(40)]) {
      expect(leerToken(malo)).toBeNull()
    }
  })
})

describe('hashDeToken', () => {
  it('es el sha-256 en hexadecimal del texto (vector conocido de «abc»)', async () => {
    expect(await hashDeToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('siempre 64 hexadecimales en minúscula: lo que exige la CHECK de la tabla de códigos', async () => {
    expect(await hashDeToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Números y fechas que salen de un Atajo
// ═══════════════════════════════════════════════════════════════════════════

describe('leerNumero', () => {
  it('lee números y texto numérico', () => {
    expect(leerNumero(8123, 0)).toBe(8123)
    expect(leerNumero('8123', 0)).toBe(8123)
    expect(leerNumero(72.44, 1)).toBe(72.4)
    expect(leerNumero('72.4', 1)).toBe(72.4)
  })

  it('en Colombia la coma es decimal y el punto agrupa: 7,5 h y 72,4 kg', () => {
    expect(leerNumero('7,5', 2)).toBe(7.5)
    expect(leerNumero('72,4', 1)).toBe(72.4)
  })

  it('en lo que se guarda sin decimales, 8.123 y 8,123 son ocho mil ciento veintitrés', () => {
    expect(leerNumero('8.123', 0)).toBe(8123)
    expect(leerNumero('8,123', 0)).toBe(8123)
    expect(leerNumero('12.345', 0)).toBe(12345)
    expect(leerNumero('1.234.567', 0)).toBe(1234567)
    // Y un .0 que deja el formato no cambia nada.
    expect(leerNumero('8123.0', 0)).toBe(8123)
  })

  it('redondea a los decimales que se guardan', () => {
    expect(leerNumero(61.6, 0)).toBe(62)
    expect(leerNumero(7.456, 2)).toBe(7.46)
  })

  it('rechaza negativos, exponentes, letras, vacíos, NaN, infinitos y lo que no es número', () => {
    for (const malo of [-1, '-5', '1e3', '12 pasos', '', ' ', 'abc', NaN, Infinity, null, undefined, true, {}, [], '1,2,3', '9'.repeat(30)]) {
      expect(leerNumero(malo, 1)).toBeNull()
    }
  })
})

describe('leerFecha', () => {
  it('acepta AAAA-MM-DD y una fecha ISO de la que toma el día del teléfono', () => {
    expect(leerFecha('2026-09-28')).toBe('2026-09-28')
    expect(leerFecha('2026-09-28T23:30:00-05:00')).toBe('2026-09-28')
    expect(leerFecha('2026-09-28 07:00')).toBe('2026-09-28')
    expect(leerFecha(' 2026-09-28 ')).toBe('2026-09-28')
  })

  it('rechaza fechas que no existen o que no son fechas', () => {
    for (const mala of ['2026-02-30', '2026-13-01', '28/09/2026', '2026-9-28', '', 'hoy', 20260928, null, '2026-09-28x']) {
      expect(leerFecha(mala)).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Validación: los 6 tipos, su unidad y su rango
// ═══════════════════════════════════════════════════════════════════════════

describe('validarMuestras', () => {
  const uno = (m: Record<string, unknown>) => validarMuestras([m], AHORA)

  it('guarda los seis tipos con su unidad canónica', () => {
    const { filas, descartadas } = validarMuestras(
      [
        { fecha: '2026-09-28', tipo: 'pasos', valor: 8123 },
        { fecha: '2026-09-28', tipo: 'sueno', valor: 7.5 },
        { fecha: '2026-09-28', tipo: 'fc_reposo', valor: 58 },
        { fecha: '2026-09-28', tipo: 'vfc', valor: 42.3 },
        { fecha: '2026-09-28', tipo: 'minutos_ejercicio', valor: 35 },
        { fecha: '2026-09-28', tipo: 'peso', valor: 72.4 },
      ],
      AHORA,
    )
    expect(descartadas).toEqual([])
    expect(filas.map((f) => [f.tipo, f.valor, f.unidad])).toEqual([
      ['pasos', 8123, 'pasos'],
      ['sueno', 7.5, 'h'],
      ['fc_reposo', 58, 'lpm'],
      ['vfc', 42.3, 'ms'],
      ['minutos_ejercicio', 35, 'min'],
      ['peso', 72.4, 'kg'],
    ])
  })

  it('la unidad es opcional pero, si viene, tiene que ser la del tipo', () => {
    expect(uno({ fecha: '2026-09-28', tipo: 'pasos', valor: 100, unidad: 'pasos' }).filas).toHaveLength(1)
    expect(uno({ fecha: '2026-09-28', tipo: 'peso', valor: 72, unidad: 'lb' }).descartadas).toEqual([
      { indice: 0, motivo: 'unidad_invalida' },
    ])
    expect(uno({ fecha: '2026-09-28', tipo: 'pasos', valor: 100, unidad: 'kg' }).descartadas[0].motivo).toBe('unidad_invalida')
  })

  it('el sueño puede llegar en minutos y se guarda en horas', () => {
    const { filas } = uno({ fecha: '2026-09-28', tipo: 'sueno', valor: 450, unidad: 'min' })
    expect(filas).toEqual([expect.objectContaining({ tipo: 'sueno', valor: 7.5, unidad: 'h' })])
    // Y los minutos fuera de rango se descartan después de convertir (30 h no existe).
    expect(uno({ fecha: '2026-09-28', tipo: 'sueno', valor: 1800, unidad: 'min' }).descartadas[0].motivo).toBe('fuera_de_rango')
    // Solo el sueño admite minutos.
    expect(uno({ fecha: '2026-09-28', tipo: 'peso', valor: 72, unidad: 'min' }).descartadas[0].motivo).toBe('unidad_invalida')
  })

  it('descarta lo implausible en cada tipo, en los dos bordes', () => {
    const fuera: [string, number][] = [
      ['pasos', 100001],
      ['sueno', 21],
      ['fc_reposo', 24],
      ['fc_reposo', 141],
      ['vfc', 4],
      ['vfc', 301],
      ['minutos_ejercicio', 601],
      ['peso', 24],
      ['peso', 301],
    ]
    for (const [tipo, valor] of fuera) {
      expect(uno({ fecha: '2026-09-28', tipo, valor }).descartadas, `${tipo} ${valor}`).toEqual([
        { indice: 0, motivo: 'fuera_de_rango' },
      ])
    }
    // Los bordes exactos SÍ entran.
    for (const tipo of Object.keys(RANGOS) as (keyof typeof RANGOS)[]) {
      const { minimo, maximo } = RANGOS[tipo]
      expect(uno({ fecha: '2026-09-28', tipo, valor: minimo }).filas, `${tipo} mínimo`).toHaveLength(1)
      expect(uno({ fecha: '2026-09-28', tipo, valor: maximo }).filas, `${tipo} máximo`).toHaveLength(1)
    }
  })

  it('descarta el tipo que no es de los seis, sea salud o no', () => {
    for (const tipo of ['ubicacion', 'ruta', 'presion', 'glucosa', 'calorias', 'comentario', '', 7, null]) {
      expect(uno({ fecha: '2026-09-28', tipo, valor: 1 }).descartadas[0].motivo, String(tipo)).toBe('tipo_desconocido')
    }
  })

  it('descarta el que no es un objeto, con fecha mala o con valor que no es número', () => {
    expect(validarMuestras([null, 'x', 5, [], { tipo: 'pasos', valor: 1 }], AHORA).descartadas.map((d) => d.motivo)).toEqual([
      'no_es_objeto',
      'no_es_objeto',
      'no_es_objeto',
      'no_es_objeto',
      'fecha_invalida',
    ])
    expect(uno({ fecha: '2026-09-28', tipo: 'pasos', valor: 'muchos' }).descartadas[0].motivo).toBe('valor_invalido')
  })

  it('la ventana de fechas: hasta 14 días atrás y como mucho un día por delante', () => {
    // hoy (UTC) = 2026-09-28
    expect(uno({ fecha: '2026-09-14', tipo: 'pasos', valor: 1 }).filas).toHaveLength(1) // 14 días atrás
    expect(uno({ fecha: '2026-09-13', tipo: 'pasos', valor: 1 }).descartadas[0].motivo).toBe('fecha_antigua')
    expect(uno({ fecha: '2026-09-29', tipo: 'pasos', valor: 1 }).filas).toHaveLength(1) // teléfono al este de UTC
    expect(uno({ fecha: '2026-09-30', tipo: 'pasos', valor: 1 }).descartadas[0].motivo).toBe('fecha_futura')
    expect(MAX_DIAS_ATRAS).toBe(14)
  })

  it('si el mismo día y tipo viene repetido gana el último, y queda una sola fila', () => {
    const { filas } = validarMuestras(
      [
        { fecha: '2026-09-28', tipo: 'pasos', valor: 3000 },
        { fecha: '2026-09-27', tipo: 'pasos', valor: 9000 },
        { fecha: '2026-09-28', tipo: 'pasos', valor: 8123 },
      ],
      AHORA,
    )
    expect(filas.map((f) => [f.fecha, f.valor])).toEqual([
      ['2026-09-27', 9000],
      ['2026-09-28', 8123],
    ])
  })

  it('la VFC es SDNN, la pone la función y no el cuerpo; los demás tipos no llevan método', () => {
    const { filas } = validarMuestras(
      [
        { fecha: '2026-09-28', tipo: 'vfc', valor: 40, metodo: 'rmssd' },
        { fecha: '2026-09-28', tipo: 'pasos', valor: 100, metodo: 'sdnn' },
      ],
      AHORA,
    )
    expect(filas.find((f) => f.tipo === 'vfc')?.metodo).toBe('sdnn')
    expect(filas.find((f) => f.tipo === 'pasos')?.metodo).toBeNull()
  })

  it('cualquier otra clave (un comentario, una nota, una ubicación) no llega a la fila', () => {
    const { filas } = uno({
      fecha: '2026-09-28',
      tipo: 'pasos',
      valor: 100,
      comentario: 'me duele la rodilla',
      lat: 4.6,
      lon: -74.1,
    })
    expect(Object.keys(filas[0]).sort()).toEqual(['fecha', 'metodo', 'tipo', 'unidad', 'valor'])
    expect(JSON.stringify(filas)).not.toContain('rodilla')
  })

  it('tolera lo que hace una región: tipo en mayúsculas, valor con coma, fecha ISO', () => {
    const { filas, descartadas } = validarMuestras(
      [
        { fecha: '2026-09-28T07:00:00-05:00', tipo: ' Peso ', valor: '72,4' },
        { fecha: '2026-09-28', tipo: 'PASOS', valor: '8.123' },
      ],
      AHORA,
    )
    expect(descartadas).toEqual([])
    expect(filas.map((f) => [f.tipo, f.valor])).toEqual([
      ['peso', 72.4],
      ['pasos', 8123],
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El manejador: la puerta
// ═══════════════════════════════════════════════════════════════════════════

describe('manejar: la puerta', () => {
  it('solo acepta POST', async () => {
    const a = new AlmacenFalso()
    for (const metodo of ['GET', 'PUT', 'DELETE']) {
      const r = await manejar(peticion(null, { 'x-alpha-token': TOKEN }, metodo), deps(a))
      expect(r.status, metodo).toBe(405)
      expect(r.headers.get('allow')).toBe('POST')
    }
    expect(a.autorizaciones).toEqual([])
  })

  it('sin cabecera de código, o con uno mal formado: 401 sin tocar la base', async () => {
    const a = new AlmacenFalso()
    const casos: Record<string, string>[] = [{}, { 'x-alpha-token': 'sa_corto' }, { 'x-alpha-token': 'Bearer ' + TOKEN }]
    for (const cabeceras of casos) {
      const r = await manejar(peticion(ENVIO_BUENO, cabeceras), deps(a))
      expect(r.status).toBe(401)
      expect((await r.json()).error).toBe('token_invalido')
    }
    expect(a.autorizaciones).toEqual([])
    expect(a.filas.size).toBe(0)
  })

  it('el código NO se acepta en la URL: solo la cabecera cuenta', async () => {
    const a = new AlmacenFalso()
    const req = new Request(`https://ejemplo.test/functions/v1/salud-atajo?token=${TOKEN}`, {
      method: 'POST',
      body: JSON.stringify(ENVIO_BUENO),
    })
    expect((await manejar(req, deps(a))).status).toBe(401)
    expect(a.autorizaciones).toEqual([])
  })

  it('a la base solo llega el HASH del código, nunca el código', async () => {
    const a = new AlmacenFalso()
    await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(a.autorizaciones).toEqual([await hashDeToken(TOKEN)])
    expect(a.autorizaciones[0]).not.toContain(TOKEN)
  })

  it('código desconocido o revocado: 401 y no se guarda nada', async () => {
    const a = new AlmacenFalso()
    a.respuesta = { estado: 'token_invalido' }
    const r = await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(r.status).toBe(401)
    expect(a.filas.size).toBe(0)
  })

  it('sin la casilla E vigente: 403 con un mensaje que dice qué hacer, y no se guarda nada', async () => {
    const a = new AlmacenFalso()
    a.respuesta = { estado: 'sin_consentimiento' }
    const r = await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(r.status).toBe(403)
    const c = await r.json()
    expect(c.error).toBe('sin_consentimiento')
    expect(c.mensaje).toMatch(/permiso/i)
    expect(a.filas.size).toBe(0)
  })

  it('pasado de frecuencia: 429 con Retry-After, y no se guarda nada', async () => {
    const a = new AlmacenFalso()
    a.respuesta = { estado: 'limite' }
    const r = await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('3600')
    expect(a.filas.size).toBe(0)
    expect(LIMITE_POR_HORA).toBe(20)
  })

  it('una caída de la base es un 500 breve, sin el detalle', async () => {
    const a = new AlmacenFalso()
    a.falla = new ErrorDeAlmacen(500, 'XX000')
    const r = await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ ok: false, error: 'servidor', mensaje: expect.any(String) })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El manejador: el cuerpo
// ═══════════════════════════════════════════════════════════════════════════

describe('manejar: el cuerpo', () => {
  it('un envío bueno responde 200, breve, y guarda lo suyo a nombre de quien dice el código', async () => {
    const a = new AlmacenFalso()
    const r = await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, guardadas: 3, descartadas: 0 })
    expect([...a.filas.keys()].sort()).toEqual([
      `${USUARIO}|2026-09-27|sueno|atajo`,
      `${USUARIO}|2026-09-28|pasos|atajo`,
      `${USUARIO}|2026-09-28|peso|atajo`,
    ])
  })

  it('el usuario sale del código, no del cuerpo: un usuario_id en el cuerpo se ignora', async () => {
    const a = new AlmacenFalso()
    await manejar(peticion({ ...ENVIO_BUENO, usuario_id: 'otra-persona', usuarioId: 'otra-persona' }), deps(a))
    for (const f of a.filas.values()) expect(f.usuarioId).toBe(USUARIO)
  })

  it('es idempotente: el mismo envío dos veces deja el mismo estado', async () => {
    const a = new AlmacenFalso()
    await manejar(peticion(ENVIO_BUENO), deps(a))
    const antes = JSON.stringify([...a.filas.entries()])
    await manejar(peticion(ENVIO_BUENO), deps(a))
    expect(JSON.stringify([...a.filas.entries()])).toBe(antes)
    expect(a.filas.size).toBe(3)
  })

  it('reenviar el día con un valor más completo lo ACTUALIZA, no lo duplica', async () => {
    const a = new AlmacenFalso()
    await manejar(peticion({ muestras: [{ fecha: '2026-09-28', tipo: 'pasos', valor: 3000 }] }), deps(a))
    await manejar(peticion({ muestras: [{ fecha: '2026-09-28', tipo: 'pasos', valor: 8123 }] }), deps(a))
    expect(a.filas.size).toBe(1)
    expect([...a.filas.values()][0].valor).toBe(8123)
  })

  it('guarda lo bueno y descarta lo malo con su motivo, sin repetir el valor', async () => {
    const a = new AlmacenFalso()
    const r = await manejar(
      peticion({
        muestras: [
          { fecha: '2026-09-28', tipo: 'pasos', valor: 8123 },
          { fecha: '2026-09-28', tipo: 'peso', valor: 999 },
          { fecha: '2026-09-28', tipo: 'ubicacion', valor: 1 },
        ],
      }),
      deps(a),
    )
    expect(r.status).toBe(200)
    const c = await r.json()
    expect(c).toMatchObject({ ok: true, guardadas: 1, descartadas: 2 })
    expect(c.detalle).toEqual([
      { indice: 1, motivo: 'fuera_de_rango' },
      { indice: 2, motivo: 'tipo_desconocido' },
    ])
    expect(JSON.stringify(c)).not.toContain('999')
    expect(a.filas.size).toBe(1)
  })

  it('si NADA es válido: 422 y no se guarda nada', async () => {
    const a = new AlmacenFalso()
    const r = await manejar(peticion({ muestras: [{ fecha: '2026-09-28', tipo: 'peso', valor: 5 }] }), deps(a))
    expect(r.status).toBe(422)
    expect((await r.json()).error).toBe('todas_descartadas')
    expect(a.filas.size).toBe(0)
  })

  it('cuerpo que no es JSON, sin «muestras» o con «muestras» que no es una lista: 400', async () => {
    const a = new AlmacenFalso()
    for (const cuerpo of ['no es json', '{', '[]', '"texto"', 'null', '{}', '{"muestras":"x"}', '{"muestras":{"a":1}}']) {
      const r = await manejar(peticion(cuerpo), deps(a))
      expect(r.status, cuerpo).toBe(400)
      expect((await r.json()).error).toBe('cuerpo_invalido')
    }
    expect(a.filas.size).toBe(0)
  })

  it('una lista vacía es un 400 propio', async () => {
    const r = await manejar(peticion({ muestras: [] }), deps(new AlmacenFalso()))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('sin_muestras')
  })

  it(`más de ${MAX_MUESTRAS} muestras: 413`, async () => {
    const muchas = Array.from({ length: MAX_MUESTRAS + 1 }, () => ({ fecha: '2026-09-28', tipo: 'pasos', valor: 1 }))
    const r = await manejar(peticion({ muestras: muchas }), deps(new AlmacenFalso()))
    expect(r.status).toBe(413)
  })

  it('un cuerpo grande se corta por Content-Length sin leerlo', async () => {
    const a = new AlmacenFalso()
    const req = new Request('https://ejemplo.test/x', {
      method: 'POST',
      headers: { 'x-alpha-token': TOKEN, 'content-length': String(MAX_BYTES + 1) },
      body: '{}',
    })
    expect((await manejar(req, deps(a))).status).toBe(413)
    expect(a.autorizaciones).toEqual([])
  })

  it('y si no declara el tamaño (trozos), se corta al pasarse de los 16 KB', async () => {
    const a = new AlmacenFalso()
    const trozo = new TextEncoder().encode('x'.repeat(1024))
    let enviados = 0
    const flujo = new ReadableStream<Uint8Array>({
      pull(control) {
        enviados += 1
        if (enviados > 64) return control.close()
        control.enqueue(trozo)
      },
    })
    // `duplex` es obligatorio en Node para un cuerpo en flujo y no está en los tipos DOM.
    const init = { method: 'POST', headers: { 'x-alpha-token': TOKEN }, body: flujo, duplex: 'half' } as RequestInit
    const req = new Request('https://ejemplo.test/x', init)
    const r = await manejar(req, deps(a))
    expect(r.status).toBe(413)
    // Se dejó de leer al pasarse: no llegó a consumir los 64 KB enteros.
    expect(enviados).toBeLessThan(64)
    expect(a.filas.size).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Nada sensible en los registros
// ═══════════════════════════════════════════════════════════════════════════

describe('manejar: los registros', () => {
  const VALOR_RARO = 73.9137
  const ENVIO_RARO = { muestras: [{ fecha: '2026-09-28', tipo: 'peso', valor: VALOR_RARO }] }

  it('un envío bueno registra estado y conteos, y ni el valor, ni el código, ni su hash', async () => {
    await manejar(peticion(ENVIO_RARO), deps(new AlmacenFalso()))
    expect(registros.length).toBeGreaterThan(0)
    const todo = registros.join('\n')
    expect(todo).toContain('"estado":200')
    expect(todo).not.toContain('73.9')
    expect(todo).not.toContain(TOKEN)
    expect(todo).not.toContain(TOKEN.slice(3))
    expect(todo).not.toContain(await hashDeToken(TOKEN))
    expect(todo).not.toContain(USUARIO)
    expect(todo).not.toContain('peso')
  })

  it('un envío rechazado tampoco registra valores ni el código', async () => {
    const a = new AlmacenFalso()
    a.respuesta = { estado: 'sin_consentimiento' }
    await manejar(peticion(ENVIO_RARO), deps(a))
    await manejar(peticion({ muestras: [{ fecha: '2026-09-28', tipo: 'peso', valor: 5.5555 }] }), deps(new AlmacenFalso()))
    const todo = registros.join('\n')
    expect(todo).not.toContain('73.9')
    expect(todo).not.toContain('5.5555')
    expect(todo).not.toContain(TOKEN)
  })

  it('un fallo de la base registra solo el estado y el código, no el mensaje (que puede repetir la fila)', async () => {
    const a = new AlmacenFalso()
    a.falla = new ErrorDeAlmacen(400, '23514')
    await manejar(peticion(ENVIO_RARO), deps(a))
    const todo = registros.join('\n')
    expect(todo).toContain('almacen_400_23514')
    expect(todo).not.toContain('73.9')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El almacén real (PostgREST), sin red
// ═══════════════════════════════════════════════════════════════════════════

describe('almacenSupabase', () => {
  const respuestaJson = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })

  it('autorizar llama a salud_atajo_autorizar con la clave de servicio y solo el hash', async () => {
    const peticionFalsa = vi.fn(async () => respuestaJson({ estado: 'ok', usuario_id: USUARIO }))
    const almacen = almacenSupabase('https://x.supabase.co', 'CLAVE-DE-PRUEBA', peticionFalsa as unknown as typeof fetch)
    expect(await almacen.autorizar('a'.repeat(64))).toEqual({ estado: 'ok', usuarioId: USUARIO })

    const [url, init] = peticionFalsa.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/salud_atajo_autorizar')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ p_hash: 'a'.repeat(64) })
    expect((init.headers as Record<string, string>).apikey).toBe('CLAVE-DE-PRUEBA')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer CLAVE-DE-PRUEBA')
  })

  it('traduce los tres estados que no son ok y rechaza uno que no conoce', async () => {
    for (const estado of ['token_invalido', 'limite', 'sin_consentimiento'] as const) {
      const f = vi.fn(async () => respuestaJson({ estado }))
      expect(await almacenSupabase('https://x', 'k', f as unknown as typeof fetch).autorizar('h')).toEqual({ estado })
    }
    const rara = vi.fn(async () => respuestaJson({ estado: 'quiza' }))
    await expect(almacenSupabase('https://x', 'k', rara as unknown as typeof fetch).autorizar('h')).rejects.toBeInstanceOf(ErrorDeAlmacen)
  })

  it('guardar manda el usuario y las filas a salud_atajo_guardar y devuelve cuántas', async () => {
    const f = vi.fn(async () => respuestaJson(2))
    const almacen = almacenSupabase('https://x.supabase.co', 'k', f as unknown as typeof fetch)
    const filas: FilaMuestra[] = [
      { fecha: '2026-09-28', tipo: 'pasos', valor: 1, unidad: 'pasos', metodo: null },
      { fecha: '2026-09-28', tipo: 'vfc', valor: 40, unidad: 'ms', metodo: 'sdnn' },
    ]
    expect(await almacen.guardar(USUARIO, filas)).toBe(2)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/rpc/salud_atajo_guardar')
    expect(JSON.parse(init.body as string)).toEqual({ p_usuario: USUARIO, p_muestras: filas })
  })

  it('un error de la base lanza con el estado y el código y NADA del mensaje', async () => {
    const f = vi.fn(async () =>
      respuestaJson({ code: '23514', message: 'Failing row contains (1, 2026-09-28, peso, 73.9137)' }, 400),
    )
    const almacen = almacenSupabase('https://x', 'k', f as unknown as typeof fetch)
    const error = await almacen.guardar(USUARIO, []).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ErrorDeAlmacen)
    expect((error as ErrorDeAlmacen).estado).toBe(400)
    expect((error as ErrorDeAlmacen).codigo).toBe('23514')
    expect(String((error as Error).message)).not.toContain('73.9137')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La función y la migración dicen lo mismo
// ═══════════════════════════════════════════════════════════════════════════

describe('la función y la migración 0093 coinciden', () => {
  const sql = readFileSync(RUTA_MIGRACION, 'utf8')

  it('unidad y rango de cada tipo son los de la CHECK de salud_muestras', () => {
    const patron = /tipo = '(\w+)'\s+and unidad = '([^']+)'\s+and valor between ([\d.]+) and ([\d.]+)/g
    const enSql = [...sql.matchAll(patron)].map(([, tipo, unidad, minimo, maximo]) => [tipo, unidad, Number(minimo), Number(maximo)])
    const enFuncion = (Object.keys(RANGOS) as (keyof typeof RANGOS)[]).map((t) => [t, RANGOS[t].unidad, RANGOS[t].minimo, RANGOS[t].maximo])
    expect(enSql.length).toBe(6)
    expect(enSql).toEqual(enFuncion)
  })

  it('los seis tipos de la función son los de la lista de la tabla', () => {
    const lista = sql.match(/tipo\s+text not null check \(tipo in\s*\(([^)]*)\)/)?.[1] ?? ''
    const enSql = [...lista.matchAll(/'(\w+)'/g)].map((m) => m[1])
    expect(enSql).toEqual(Object.keys(RANGOS))
  })

  it('el hash de la base es el sha-256 hexadecimal del texto UTF-8 que calcula la función', () => {
    expect(sql).toContain("encode(sha256(convert_to(v_token, 'UTF8')), 'hex')")
    expect(sql).toContain("'sa_' || left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 40)")
  })

  it('el límite por hora de la base es el que anuncia la función', () => {
    expect(sql).toContain(`v_limite constant integer := ${LIMITE_POR_HORA};`)
  })

  it('la VFC del atajo se guarda como SDNN y la tabla acepta ese método', () => {
    expect(sql).toContain("metodo in ('sdnn', 'rmssd')")
  })
})

describe('el archivo de la función se puede pegar tal cual en el panel', () => {
  const fuente = readFileSync(RUTA_FUNCION, 'utf8')

  it('no lleva NINGUNA barra invertida: el despliegue por el MCP se come los escapes', () => {
    expect(fuente.includes(String.fromCharCode(92))).toBe(false)
  })

  it('es un solo archivo: sin imports relativos', () => {
    expect(fuente).not.toMatch(/^\s*import\s/m)
    expect(fuente).not.toMatch(/from\s+['"]\.{1,2}\//)
  })

  it('no escribe el cuerpo, las cabeceras ni el error de la base en los registros', () => {
    const llamadas = fuente.match(/console\.\w+\(([^)]*)\)/g) ?? []
    expect(llamadas.length).toBeGreaterThan(0)
    for (const l of llamadas) {
      expect(l, l).not.toMatch(/req|headers|cuerpo|texto|token|valor|e\.message|error\.message/i)
    }
  })
})
