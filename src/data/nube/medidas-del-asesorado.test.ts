import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './sync'

/**
 * LA MEDIDA DEL ASESORADO VIAJA SOLA (0057, 2026-09-06).
 *
 * Hasta hoy `agregarMedida` subía la ficha ENTERA con la medida dentro, y el trigger
 * `proteger_perfil` la comparaba con la de la nube. A quien no tenía ficha se le rechazaba
 * SIEMPRE —la app fabricaba una con valores por defecto y el trigger solo admite «nada más
 * que medidas»—, la cola lo descartaba en silencio tras tres intentos, y el día que se
 * midió eran tres asesorados activos. Ahora la mete el servidor (`registrar_medida`).
 *
 * Lo que se clava: qué sale a la cola (una llamada, no una fila), cómo se funden dos del
 * mismo día, y que la medida siga viéndose aunque la descarga llegue antes que la subida.
 */
const ASESORADA = 'u-valentina'

let ultimoSync: typeof import('./sync') | undefined

async function dbEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  ultimoSync = sync
  const { crearMockDb } = await import('../mockDb')
  const db = sync.crearDbSincronizada(crearMockDb())
  localStorage.setItem('alpha-cola-sync', '[]')
  return { sync, db }
}

function cola(): OperacionPendiente[] {
  return JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[]
}

const dePerfiles = () => cola().filter((o) => o.tabla === 'perfiles')
const medida = (fecha: string, alturaCm: number) => ({ fecha, alturaCm, perimetros: {} })

describe('la medida del asesorado viaja sola', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red en test')))
  })

  afterEach(async () => {
    await ultimoSync?.pendientesDeSync?.()
    ultimoSync = undefined
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('registrar una medida encola la llamada al servidor, no la ficha entera', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-06', 165))
    const ops = dePerfiles()
    expect(ops).toHaveLength(1)
    expect(ops[0].tipo).toBe('rpc')
    expect(ops[0].funcion).toBe('registrar_medida')
    expect(ops[0].payload).toEqual({ p_medida: medida('2026-09-06', 165) })
    expect(ops[0].fila).toBe(ASESORADA)
  })

  it('dos registros del mismo día se funden y manda el último; días distintos, dos llamadas', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-06', 165))
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-06', 166))
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-07', 167))
    const ops = dePerfiles()
    expect(ops.map((o) => (o.payload.p_medida as { alturaCm: number }).alturaCm)).toEqual([166, 167])
    expect(ops.map((o) => o.claveRpc)).toEqual([`${ASESORADA}:2026-09-06`, `${ASESORADA}:2026-09-07`])
  })

  it('sigue viéndose en el móvil aunque la descarga llegue antes que la subida', async () => {
    const { db, sync } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-06', 165))
    // Lo que bajaría del servidor: la ficha de antes, con lo del coach y una medida vieja
    // de ese mismo día que la pendiente tiene que sustituir.
    const bajada = [
      {
        datos: {
          usuarioId: ASESORADA,
          objetivos: 'fuerza',
          edad: 30,
          diasEntrenamiento: 4,
          tiempoSesionMin: 60,
          somatotipo: 'meso',
          volumenSemanal: {},
          medidas: [medida('2026-09-06', 100), medida('2026-08-01', 160)],
        },
      },
    ]
    const fundidas = sync.conPendientes('perfiles', bajada)
    expect(fundidas).toHaveLength(1)
    const datos = fundidas[0].datos as { objetivos: string; medidas: { fecha: string; alturaCm: number }[] }
    expect(datos.objetivos, 'lo del coach se pisó').toBe('fuerza')
    expect(datos.medidas.map((m) => [m.fecha, m.alturaCm])).toEqual([
      ['2026-08-01', 160],
      ['2026-09-06', 165],
    ])
  })

  it('y si el servidor aún no tiene su ficha, la fusión la estrena como la estrenará él', async () => {
    const { db, sync } = await dbEnModoNube()
    db.perfiles.agregarMedida(ASESORADA, medida('2026-09-06', 165))
    const fundidas = sync.conPendientes<{ datos: unknown }>('perfiles', [])
    expect(fundidas).toHaveLength(1)
    expect(fundidas[0].datos).toMatchObject({ usuarioId: ASESORADA, medidas: [medida('2026-09-06', 165)] })
  })

  it('las ocho medidas de la ficha llegan enteras a `perfiles`, sin tocar registrar_medida', async () => {
    // La encuesta de las ocho medidas (`domain/medidas.ts`) viaja DENTRO del objeto de la
    // medida, en `cuerpo`. Eso no es un detalle de estilo: `registrar_medida` (0057) mete
    // el jsonb tal cual con `jsonb_agg`, sin nombrar una sola clave, así que la función SQL
    // no se entera de que hay ocho campos nuevos y no hizo falta migración. Lo que sí
    // podría romperlo es que alguien de esta capa empiece a copiar campo a campo — por eso
    // se clava aquí que sube el objeto ENTERO y que la fusión lo devuelve entero.
    const { db, sync } = await dbEnModoNube()
    const cuerpo = {
      tibiaCm: 38.5,
      femurCm: 47.3,
      torsoCm: 51.4,
      antebrazoCm: 23.1,
      brazoCm: 31.1,
      anchoClavicularCm: 38.8,
      cinturaCm: 82,
      caderasCm: 96,
    }
    const conOcho = { ...medida('2026-09-08', 175), cuerpo }
    db.perfiles.agregarMedida(ASESORADA, conOcho)

    const ops = dePerfiles()
    expect(ops).toHaveLength(1)
    expect(ops[0].funcion).toBe('registrar_medida')
    expect(ops[0].payload).toEqual({ p_medida: conOcho })

    // Y de vuelta: lo que la app enseña mientras la subida está en cola.
    const fundidas = sync.conPendientes<{ datos: unknown }>('perfiles', [])
    expect(fundidas[0].datos).toMatchObject({ medidas: [conOcho] })

    // Y en el almacén local, que es de donde lee la pantalla.
    expect(db.perfiles.byUsuario(ASESORADA)?.medidas.at(-1)?.cuerpo).toEqual(cuerpo)
  })

  it('el coach sigue subiendo la ficha entera, con su columna', async () => {
    const { db } = await dbEnModoNube()
    db.perfiles.guardarSexo(ASESORADA, 'mujer')
    const ops = dePerfiles()
    expect(ops).toHaveLength(1)
    expect(ops[0].tipo).toBe('upsert')
    expect(ops[0].payload.sexo).toBe('mujer')
  })
})
