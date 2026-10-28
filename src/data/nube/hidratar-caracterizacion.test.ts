/**
 * Caracterización de `hidratarDesdeNube`: los caminos que ninguna otra prueba pisaba.
 *
 * `hidratarDesdeNube` reemplaza la base local ENTERA (`aplicarSnapshot`), así que cada
 * rama de error, cada respuesta vacía y cada fila rara decide si alguien conserva o
 * pierde lo suyo. Aquí se fija lo que el código HACE hoy en esos caminos; no se cambia
 * ninguno. Lo que se descubrió roto se documentó primero como `it.fails` y luego se corrigió
 * (ver la prueba de `preferencia_estado`).
 *
 * Solo datos ficticios: Valentina (`u-val`) y una persona ajena inventada (`u-otra`).
 *
 * Lo ya cubierto en otros archivos (no se repite): la firma y el salto por tabla
 * (`hidratar-firma`), el filtro de microciclos del staff, la visibilidad, el grito de
 * `hidratacion` y `ranking_disciplina`, la guarda de `versionEscrituras`
 * (`perdida-datos`), `microciclosDe` y `fusionarCheckins`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeedDb } from '../seed'

type ErrorSb = { message: string; code?: string } | null

/** Qué devuelve cada tabla. Lo que no esté, sale vacío. */
let tablas: Record<string, unknown[] | null> = {}
/** Tablas cuya lectura responde con error de PostgREST. */
let errores: Record<string, ErrorSb> = {}
/** Tablas cuya lectura se cae de verdad (la promesa se rechaza: se cortó la red). */
let caidas: Set<string> = new Set()
let errorRanking: ErrorSb = null
let rankingCaido = false
let filasRanking: unknown[] = []
/** Qué dice `auth.getSession()`: una persona, nadie, o lanza. */
let sesion: { user: { id: string } } | null | 'lanza' = null
/** Se ejecuta en el instante en que se pide una tabla: la descarga está «en vuelo». */
let alPedir: ((tabla: string) => void) | undefined
let pedidas: string[] = []
let filtroMicrociclos: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    auth: {
      getSession: () =>
        sesion === 'lanza'
          ? Promise.reject(new Error('sin auth'))
          : Promise.resolve({ data: { session: sesion } }),
    },
    from: (tabla: string) => ({
      select: () => {
        pedidas.push(tabla)
        alPedir?.(tabla)
        const error = errores[tabla] ?? null
        const datos = tablas[tabla]
        const resultado = caidas.has(tabla)
          ? Promise.reject(new Error('Failed to fetch'))
          : Promise.resolve({
              data: error ? null : datos === undefined ? [] : datos,
              error,
            })
        const q = Object.assign(resultado, {
          eq: () => q,
          or: (f: string) => {
            if (tabla === 'microciclos') filtroMicrociclos = f
            return q
          },
        })
        return q
      },
    }),
    rpc: () =>
      rankingCaido
        ? Promise.reject(new Error('Failed to fetch'))
        : Promise.resolve(
            errorRanking
              ? { data: null, error: errorRanking }
              : { data: filasRanking, error: null },
          ),
  }),
}))

const VAL = {
  id: 'u-val',
  nombre: 'Valentina Cruz',
  rol: 'asesorado' as const,
  avatarIniciales: 'VC',
}
const FILA_VAL = { id: 'u-val', nombre: 'Valentina Cruz', rol: 'asesorado', avatar_iniciales: 'VC' }
const FILA_OTRA = { id: 'u-otra', nombre: 'Persona Ajena', rol: 'asesorado', avatar_iniciales: 'PA' }

/** Deja en el dispositivo lo que la persona ya tenía, antes de hidratar. */
async function sembrarLocal(parcial: Partial<SeedDb> = {}) {
  const { aplicarSnapshot } = await import('../mockDb')
  aplicarSnapshot({
    usuarios: [VAL],
    perfiles: [],
    microciclos: [],
    checkins: [],
    planes: [],
    adherencias: [],
    mensajes: [],
    cuestionarios: [],
    respuestas: [],
    contenidos: [],
    premiaciones: [],
    ...parcial,
  } as SeedDb)
}

async function hidratar() {
  const { hidratarDesdeNube } = await import('./hidratar')
  await hidratarDesdeNube()
}

async function local(): Promise<SeedDb> {
  const { instantaneaLocal } = await import('../mockDb')
  return instantaneaLocal()
}

beforeEach(() => {
  localStorage.clear()
  tablas = {}
  errores = {}
  caidas = new Set()
  errorRanking = null
  rankingCaido = false
  filasRanking = []
  sesion = null
  alPedir = undefined
  pedidas = []
  filtroMicrociclos = undefined
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('datos de otra persona no entran al almacén local', () => {
  /**
   * Valentina cierra sesión (o entra otra persona) mientras la descarga está en
   * vuelo. La foto trae lo del servidor para la sesión VIEJA: aplicarla repondría en
   * el teléfono datos que ya no pertenecen a quien esté dentro.
   */
  it('si la sesión cambia durante la descarga, la foto se descarta entera', async () => {
    await sembrarLocal({ usuarios: [{ ...VAL, id: 'u-nueva', nombre: 'Nueva Sesion' }] })
    tablas.usuarios_app = [FILA_VAL, FILA_OTRA]
    const { abrirSesionLocal } = await import('../mockDb')
    alPedir = (tabla) => {
      if (tabla === 'premiaciones') abrirSesionLocal() // entra otra persona
    }

    await hidratar()

    expect((await local()).usuarios.map((u) => u.id)).toEqual(['u-nueva'])
  })

  it('lo mismo si se cierra la sesión (olvidarDatosLocales) a mitad de la descarga', async () => {
    tablas.usuarios_app = [FILA_VAL, FILA_OTRA]
    const { olvidarDatosLocales } = await import('../mockDb')
    alPedir = (tabla) => {
      if (tabla === 'mensajes') olvidarDatosLocales()
    }

    await hidratar()

    const ids = (await local()).usuarios.map((u) => u.id)
    expect(ids).not.toContain('u-otra')
  })

  /**
   * Un ítem cuya comida no bajó (borrada, o de otra persona) no tiene dónde colgarse:
   * se descarta, y no se le inventa una comida ni se pega a otra.
   */
  it('un ítem de la comida de otra persona no se cuelga de la comida de Valentina', async () => {
    tablas.registro_comida = [
      {
        id: 10,
        cliente_id: 'c-val-1',
        asesorado_id: 'u-val',
        momento: '2026-10-20T08:00:00Z',
        comida: 'desayuno',
        cocinado_por_el: false,
        aceite_g: 0,
        sal_g: 0,
        confianza: 'alta',
      },
    ]
    tablas.registro_item = [
      { id: 100, cliente_id: 'i-val-1', registro_id: 10, alimento_id: 'avena', gramos: '40', fue_pesado: true, estado_asumido: 'crudo' },
      { id: 101, cliente_id: null, registro_id: 999, alimento_id: 'pollo', gramos: '150', fue_pesado: false, estado_asumido: 'cocido' },
    ]

    await hidratar()

    const comidas = (await local()).registrosComida ?? []
    expect(comidas).toHaveLength(1)
    expect(comidas[0].usuarioId).toBe('u-val')
    expect(comidas[0].items.map((i) => i.alimentoId)).toEqual(['avena'])
  })

  it('con la sesión dentro, los microciclos ajenos se piden solo activos/propuestos', async () => {
    sesion = { user: { id: 'u-val' } }
    await hidratar()
    expect(filtroMicrociclos).toBe('estado.in.(activo,propuesto),usuario_id.eq.u-val')
  })

  it('si getSession lanza, se baja todo sin filtrar y la descarga NO se cae', async () => {
    sesion = 'lanza'
    await expect(hidratar()).resolves.toBeUndefined()
    expect(filtroMicrociclos).toBeUndefined()
    expect(pedidas).toContain('microciclos')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('un fallo no borra lo que la persona ya tenía', () => {
  const TABLAS_QUE_GRITAN = [
    'usuarios_app',
    'perfiles',
    'microciclos',
    'checkins',
    'checkins_nutricion',
    'adherencias',
    'planes_nutricionales',
    'mensajes',
    'cuestionarios',
    'respuestas',
    'contenidos',
    'premiaciones',
  ]

  it.each(TABLAS_QUE_GRITAN)(
    'si «%s» responde con error, se lanza y NO se aplica nada',
    async (tabla) => {
      await sembrarLocal({
        premiaciones: [{ id: 'p-1', usuarioId: 'u-val', titulo: 'Constancia', fecha: '2026-10-01' }],
      })
      tablas.usuarios_app = [FILA_OTRA]
      errores[tabla] = { message: 'permission denied', code: '42501' }

      await expect(hidratar()).rejects.toThrow(/No se pudo descargar tus datos: permission denied/)

      const l = await local()
      expect(l.usuarios.map((u) => u.id)).toEqual(['u-val'])
      expect(l.premiaciones.map((p) => p.id)).toEqual(['p-1'])
    },
  )

  it('si la red se corta a media descarga (la promesa se rechaza), no queda nada a medias', async () => {
    await sembrarLocal({
      mensajes: [
        { id: 'm-1', deId: 'u-val', paraId: 'u-coach', fechaIso: '2026-10-20T10:00:00Z', texto: 'Hola', origen: 'humano', leido: true },
      ],
    })
    tablas.usuarios_app = [FILA_OTRA]
    caidas.add('perfil_alimentario')

    await expect(hidratar()).rejects.toThrow('Failed to fetch')

    const l = await local()
    expect(l.usuarios.map((u) => u.id)).toEqual(['u-val'])
    expect(l.mensajes.map((m) => m.id)).toEqual(['m-1'])
  })

  it('lo mismo si se cae el ranking (RPC rechazada) después de haber leído las tablas', async () => {
    await sembrarLocal()
    tablas.usuarios_app = [FILA_OTRA]
    rankingCaido = true

    await expect(hidratar()).rejects.toThrow('Failed to fetch')

    expect((await local()).usuarios.map((u) => u.id)).toEqual(['u-val'])
  })

  /**
   * Las tablas posteriores al esquema inicial bajan con `error ? local : servidor`.
   * Cada una se prueba con su propia fila local y un 500 pasajero.
   */
  it('perfil_alimentario con error: se conserva la encuesta local', async () => {
    const perfil = { usuarioId: 'u-val', respuestas: { alergias: [] }, completadaEn: '2026-10-01' }
    await sembrarLocal({ perfilesNutricion: [perfil] as never })
    errores.perfil_alimentario = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).perfilesNutricion).toEqual([perfil])
  })

  it('perfil_alimentario sin error: las filas sin respuestas se descartan', async () => {
    tablas.perfil_alimentario = [
      { asesorado_id: 'u-val', respuestas: { alergias: [] }, completada_en: null },
      { asesorado_id: 'u-otra', respuestas: null, completada_en: null },
    ]
    await hidratar()
    const p = (await local()).perfilesNutricion ?? []
    expect(p.map((x) => x.usuarioId)).toEqual(['u-val'])
    expect(p[0].completadaEn).toBeUndefined()
  })

  it('perfil_alimentario_veto con error: se conserva el veto local (lo que NO puede comer)', async () => {
    const veto = { usuarioId: 'u-val', alimentoId: 'mani', motivo: 'alergia' }
    await sembrarLocal({ vetosAlimentarios: [veto] })
    errores.perfil_alimentario_veto = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).vetosAlimentarios).toEqual([veto])
  })

  it('un veto sin motivo se conserva con motivo vacío, no se descarta', async () => {
    tablas.perfil_alimentario_veto = [{ id: 1, asesorado_id: 'u-val', alimento_id: 'mani', motivo: null }]
    await hidratar()
    expect((await local()).vetosAlimentarios).toEqual([
      { usuarioId: 'u-val', alimentoId: 'mani', motivo: '' },
    ])
  })

  it('despensa con error: se conserva la despensa local', async () => {
    const item = { usuarioId: 'u-val', alimentoId: 'arroz', cantidadG: 500, agregadoEn: '2026-10-20', origen: 'manual' }
    await sembrarLocal({ despensa: [item] as never })
    errores.despensa = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).despensa).toEqual([item])
  })

  it('despensa: null en cantidad_g sobrevive como null, no como 0', async () => {
    tablas.despensa = [
      { id: 1, asesorado_id: 'u-val', alimento_id: null, texto_pedido: 'algo de arroz', cantidad_g: null, agregado_en: '2026-10-20', origen: 'manual' },
    ]
    await hidratar()
    const [d] = (await local()).despensa ?? []
    expect(d.cantidadG).toBeNull()
    expect(d.alimentoId).toBeNull()
    expect(d.textoPedido).toBe('algo de arroz')
  })

  it('prueba_calibracion con error: se conservan las pruebas locales', async () => {
    const prueba = { id: 'pc-1', usuarioId: 'u-val', fecha: '2026-10-10', alimentoId: 'arroz', gramosEstimados: 100, gramosReales: 120 }
    await sembrarLocal({ pruebasCalibracion: [prueba] })
    errores.prueba_calibracion = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).pruebasCalibracion).toEqual([prueba])
  })

  it('cribado_vigente con error: se conserva el cribado local', async () => {
    const cribado = { usuarioId: 'u-val', fecha: '2026-10-01', fuente: 'app', detalle: {} }
    await sembrarLocal({ cribados: [cribado] as never })
    errores.cribado_vigente = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).cribados).toEqual([cribado])
  })

  /**
   * Registro de comidas: la tabla que no existe apaga el interruptor; un fallo
   * pasajero NO lo apaga. Y en ambos casos las comidas locales se conservan.
   */
  const COMIDA_LOCAL = {
    id: 'c-val-1',
    usuarioId: 'u-val',
    momentoIso: '2026-10-20T08:00:00Z',
    comida: 'desayuno' as const,
    cocinadoPorEl: false,
    aceiteG: 0,
    salG: 0,
    confianza: 'pesado' as const,
    items: [],
  }

  it('registro_comida inexistente (42P01): apaga el interruptor y conserva las comidas locales', async () => {
    await sembrarLocal({ registrosComida: [COMIDA_LOCAL] })
    errores.registro_comida = { message: 'relation does not exist', code: '42P01' }
    await hidratar()
    expect(localStorage.getItem('alpha-tablas-registro')).toBe('0')
    expect((await local()).registrosComida).toEqual([COMIDA_LOCAL])
  })

  it('registro_item con error pasajero (500): NO apaga el interruptor y conserva las comidas locales', async () => {
    await sembrarLocal({ registrosComida: [COMIDA_LOCAL] })
    errores.registro_item = { message: 'internal error', code: '500' }
    await hidratar()
    expect(localStorage.getItem('alpha-tablas-registro')).not.toBe('0')
    expect((await local()).registrosComida).toEqual([COMIDA_LOCAL])
  })

  it('con las tablas del registro bien, el interruptor queda encendido', async () => {
    await hidratar()
    expect(localStorage.getItem('alpha-tablas-registro')).toBe('1')
  })

  it('hidratacion inexistente (42P01): apaga su interruptor y la descarga sigue', async () => {
    errores.hidratacion = { message: 'relation does not exist', code: '42P01' }
    await expect(hidratar()).resolves.toBeUndefined()
    expect(localStorage.getItem('alpha-tabla-hidratacion')).toBe('0')
  })

  it('hidratacion bien: el interruptor queda encendido', async () => {
    await hidratar()
    expect(localStorage.getItem('alpha-tabla-hidratacion')).toBe('1')
  })

  /**
   * Regresión (hallazgo del 26-oct-2026, ya CORREGIDO): `preferencia_estado` usaba
   * `local?.…`, y `local` solo existe cuando FALLÓ el registro de comidas. Si fallaba SOLO
   * esta tabla, las preferencias del dispositivo se sobrescribían con `[]`. Ahora conserva
   * `instantaneaLocal()`, como las demás tablas. Fue `it.fails` hasta el arreglo.
   */
  it('preferencia_estado con error aislado debería conservar las preferencias locales', async () => {
    const pref = { usuarioId: 'u-val', familia: 'lacteos', estado: 'evita' }
    await sembrarLocal({ preferenciasEstado: [pref] as never })
    errores.preferencia_estado = { message: 'timeout', code: '57014' }
    await hidratar()
    expect((await local()).preferenciasEstado).toEqual([pref])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('el cribado: manda el servidor, y el hueco no se inventa', () => {
  const FILA_CRIBADO = {
    usuario_id: 'u-val',
    fecha: '2026-10-01',
    fuente: null,
    diagnostico: 'ausente',
    quien_lo_lleva: null,
    tratamiento_activo: 'quizas', // fuera del vocabulario
    medicacion_cronica: 'no_declarado',
    autorizacion_sanitaria: undefined,
    restricciones_explicitas: 'presente',
    sintomas_con_esfuerzo: 'ausente',
    nivel_funcional: 'ausente',
    que_le_han_dicho_que_no_haga: 'ausente',
    parq_enfermedad_cardiaca: false,
    parq_medicamento_presion: null,
    parq_huesos_articulaciones: 'si', // no es booleano
    detalle: null,
    actualizado_en: null,
  }

  it('null y valores desconocidos no se rellenan: la clave queda ausente', async () => {
    tablas.cribado_vigente = [FILA_CRIBADO]
    await hidratar()
    const [c] = (await local()).cribados ?? []
    expect(c.diagnostico).toBe('ausente')
    expect(c.medicacionCronica).toBe('no_declarado')
    expect(c.restriccionesExplicitas).toBe('presente')
    expect('quienLoLleva' in c).toBe(false)
    expect('tratamientoActivo' in c).toBe(false)
    expect('autorizacionSanitaria' in c).toBe(false)
    expect(c.parqEnfermedadCardiaca).toBe(false)
    expect('parqMedicamentoPresion' in c).toBe(false)
    expect('parqHuesosArticulaciones' in c).toBe(false)
    expect(c.fuente).toBe('app')
    expect(c.detalle).toEqual({})
    expect('actualizadoEn' in c).toBe(false)
  })

  it('el cribado local sin subir se conserva si el servidor no tiene fila de esa persona', async () => {
    const pendiente = { usuarioId: 'u-val', fecha: '2026-10-19', fuente: 'app', detalle: {}, diagnostico: 'presente' }
    await sembrarLocal({ cribados: [pendiente] as never })
    tablas.cribado_vigente = [{ ...FILA_CRIBADO, usuario_id: 'u-otra' }]
    await hidratar()
    const ids = ((await local()).cribados ?? []).map((c) => c.usuarioId).sort()
    expect(ids).toEqual(['u-otra', 'u-val'])
  })

  it('si el servidor SÍ tiene fila de esa persona, gana sobre la local', async () => {
    const local1 = { usuarioId: 'u-val', fecha: '2026-10-19', fuente: 'app', detalle: {}, diagnostico: 'presente' }
    await sembrarLocal({ cribados: [local1] as never })
    tablas.cribado_vigente = [FILA_CRIBADO]
    await hidratar()
    const cs = (await local()).cribados ?? []
    expect(cs).toHaveLength(1)
    expect(cs[0].fecha).toBe('2026-10-01')
    expect(cs[0].diagnostico).toBe('ausente')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('respuestas vacías o nulas', () => {
  it('data null sin error en todas las tablas: no revienta y deja listas vacías', async () => {
    for (const t of [
      'usuarios_app', 'perfiles', 'microciclos', 'checkins', 'checkins_nutricion',
      'adherencias', 'planes_nutricionales', 'mensajes', 'cuestionarios', 'respuestas',
      'contenidos', 'premiaciones', 'hidratacion', 'perfil_alimentario', 'registro_comida',
      'registro_item', 'preferencia_estado', 'prueba_calibracion', 'visibilidad_nutricion',
      'perfil_alimentario_veto', 'despensa', 'cribado_vigente',
    ]) tablas[t] = null
    await sembrarLocal()

    await expect(hidratar()).resolves.toBeUndefined()

    const l = await local()
    expect(l.usuarios).toEqual([])
    expect(l.registrosComida).toEqual([])
    expect(l.cribados).toEqual([])
  })

  it('una lista vacía y SIN error del servidor sí reemplaza lo local (es la verdad del servidor)', async () => {
    await sembrarLocal({
      premiaciones: [{ id: 'p-1', usuarioId: 'u-val', titulo: 'Constancia', fecha: '2026-10-01' }],
    })
    tablas.usuarios_app = [FILA_VAL]
    await hidratar()
    const l = await local()
    expect(l.premiaciones).toEqual([])
    expect(l.usuarios.map((u) => u.id)).toEqual(['u-val'])
  })

  it('la RPC del ranking con data null no revienta', async () => {
    filasRanking = null as never
    await expect(hidratar()).resolves.toBeUndefined()
    expect((await local()).ranking).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('filas malformadas o incompletas', () => {
  it('un usuario sin iniciales las saca del nombre', async () => {
    tablas.usuarios_app = [{ id: 'u-val', nombre: 'Valentina Cruz', rol: 'asesorado', avatar_iniciales: '' }]
    await hidratar()
    expect((await local()).usuarios[0].avatarIniciales).toBe('VA')
  })

  it('un mensaje sin columna origen es humano; con adjunto queda listo; sin adjunto, nada', async () => {
    tablas.mensajes = [
      { id: 'm-1', de_id: 'u-val', para_id: 'u-coach', fecha_iso: '2026-10-20T10:00:00Z', texto: 'hola', adjunto_path: null, adjunto_tipo: null, leido: false },
      { id: 'm-2', de_id: 'u-coach', para_id: 'u-val', fecha_iso: '2026-10-20T11:00:00Z', texto: 'foto', adjunto_path: 'u-val/a.jpg', adjunto_tipo: 'imagen', leido: true, origen: 'alpha' },
    ]
    await hidratar()
    const [m1, m2] = (await local()).mensajes
    expect(m1.origen).toBe('humano')
    expect(m1.adjuntoPath).toBeUndefined()
    expect(m1.adjuntoEstado).toBeUndefined()
    expect(m2.origen).toBe('alpha')
    expect(m2.adjuntoEstado).toBe('listo')
    expect(m2.adjuntoTipo).toBe('imagen')
  })

  it('un cuestionario sin asignados queda con lista vacía y el id de la fila manda sobre el del blob', async () => {
    tablas.cuestionarios = [{ id: 'q-1', asignado_a: null, datos: { id: 'otro', titulo: 'Bienestar' } }]
    await hidratar()
    const [q] = (await local()).cuestionarios
    expect(q.id).toBe('q-1')
    expect(q.asignadoA).toEqual([])
  })

  it('hidratacion con ml null cuenta 0 y el ranking con columnas null cuenta 0', async () => {
    tablas.hidratacion = [{ id: 'h1', usuario_id: 'u-val', fecha: '2026-10-20', ml: null }]
    filasRanking = [{ usuario_id: 'u-val', nombre: 'Valentina Cruz', iniciales: 'VC', puntos: null }]
    await hidratar()
    const l = await local()
    expect(l.hidratacion?.[0].ml).toBe(0)
    expect(l.ranking?.[0]).toMatchObject({ usuarioId: 'u-val', puntos: 0, sesionesCompletas: 0, preguntas: 0 })
  })

  it('comida: el cliente_id manda como id local y null en aceite/sal sobrevive como null', async () => {
    tablas.registro_comida = [
      { id: 10, cliente_id: 'c-val-1', asesorado_id: 'u-val', momento: '2026-10-20T08:00:00Z', comida: 'desayuno', cocinado_por_el: true, aceite_g: null, sal_g: '1.5', confianza: 'media' },
      { id: 11, cliente_id: null, asesorado_id: 'u-val', momento: '2026-10-20T13:00:00Z', comida: 'almuerzo', cocinado_por_el: false, aceite_g: 0, sal_g: null, confianza: 'alta' },
    ]
    tablas.registro_item = [
      { id: 100, cliente_id: 'i-1', registro_id: 10, alimento_id: 'avena', gramos: '40', fue_pesado: 1, estado_asumido: 'crudo' },
      { id: 101, cliente_id: null, registro_id: 11, alimento_id: 'arroz', gramos: '120', fue_pesado: false, estado_asumido: 'cocido' },
    ]
    await hidratar()
    const [a, b] = (await local()).registrosComida ?? []
    expect(a.id).toBe('c-val-1')
    expect(a.aceiteG).toBeNull()
    expect(a.salG).toBe(1.5)
    expect(a.items).toEqual([
      { id: 'i-1', alimentoId: 'avena', gramos: 40, fuePesado: true, estadoAsumido: 'crudo' },
    ])
    expect(b.id).toBe('11')
    expect(b.aceiteG).toBe(0)
    expect(b.salG).toBeNull()
    expect(b.items[0].id).toBe('101')
  })

  it('un plan al que le faltan arrays se sanea en vez de borrar las secciones', async () => {
    tablas.planes_nutricionales = [{ datos: { id: 'pl-1', usuarioId: 'u-val', menus: null } }]
    await hidratar()
    const [p] = (await local()).planes
    expect(p.menus).toEqual([])
    expect(p.equivalencias).toEqual([])
  })

  it('un microciclo con sesiones null se sanea y conserva la columna estado', async () => {
    tablas.microciclos = [
      { id: 'm-1', estado: 'cerrado', datos: { id: 'm-1', usuarioId: 'u-val', numero: 1, estado: 'activo', sesiones: null } },
    ]
    await hidratar()
    const [m] = (await local()).microciclos
    expect(m.estado).toBe('cerrado')
    expect(m.sesiones).toEqual([])
  })
})
