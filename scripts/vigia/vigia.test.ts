// @vitest-environment node
/**
 * El vigía, comprobado contra los dos fallos que vino a cazar, sobre datos fijos.
 *
 * 1. El 13-sep-2026 la app estuvo horas respondiendo `402 Payment Required`
 *    (`X-Vercel-Error: DEPLOYMENT_DISABLED`) y nadie se enteró.
 * 2. Días antes, las fusiones a `main` no llegaban a producción por la cuota de
 *    Vercel («Deployment rate limited») y tampoco lo avisó nada.
 *
 * Y contra el fallo que un vigía puede CAUSAR: un aviso repetido cada 15 minutos
 * con el mismo motivo inunda el correo hasta que se ignora. Por eso la mitad de
 * estas pruebas no miran si avisa, sino si CALLA cuando debe.
 *
 * Los tipos vienen del `.d.mts` y los valores del `.mjs`, como en `espejo.test.ts`.
 * Las formas de los datos están recortadas de lo que devolvió la API real el
 * 13-sep-2026, incluidos el guion largo de los entornos y el proyecto
 * `alpha-app-fix-calendario`, que cuelga del mismo repo y hay que ignorar.
 */
import { describe, expect, it } from 'vitest'
import {
  CONFIG,
  decidir,
  evaluarApp,
  evaluarProduccion,
  leerArgumentos,
  leerClave,
  marcar,
  resumir,
  vigilar,
} from './vigia.mjs'
import type { Comprobacion, Despliegue, EstadoCombinado, IssueAbierto, Resumen } from './vigia.d.mts'

const SHA_HEAD = '40aff161a6516fd407cf3334ce97137deff5e6d4'
const SHA_VIEJO = '12a28c5855a454c8d811b80cf0f4f5803b9a08e0'
const FECHA_HEAD = '2026-09-13T21:40:00Z'
const minutosDespues = (min: number) => new Date(Date.parse(FECHA_HEAD) + min * 60_000)

function despliegue(sha: string, environment: string): Despliegue {
  return { sha, environment, created_at: FECHA_HEAD }
}

/** El HEAD de `main` desplegado, más el ruido real: preview y el otro proyecto. */
const DESPLIEGUES_AL_DIA: Despliegue[] = [
  despliegue(SHA_HEAD, 'Production – alpha-athletics-app'),
  despliegue(SHA_HEAD, 'Preview – alpha-athletics-app'),
  despliegue(SHA_VIEJO, 'Production – alpha-athletics-app'),
]

/** Producción sirve el commit anterior; el HEAD solo aparece en el OTRO proyecto. */
const DESPLIEGUES_ATRASADOS: Despliegue[] = [
  despliegue(SHA_HEAD, 'Production – alpha-app-fix-calendario'),
  despliegue(SHA_HEAD, 'Preview – alpha-athletics-app'),
  despliegue(SHA_VIEJO, 'Production – alpha-athletics-app'),
]

function estado(
  propio: { state: string; description: string } | null,
  otro = { state: 'failure', description: 'Account is blocked.' },
): EstadoCombinado {
  // El `state` combinado sale en `failure` por culpa del otro proyecto, igual que
  // el 13-sep. El vigía no debe leerlo: solo el contexto de alpha-athletics-app.
  const statuses = [{ context: 'Vercel – alpha-app-fix-calendario', ...otro }]
  if (propio) statuses.push({ context: 'Vercel – alpha-athletics-app', ...propio })
  return { state: 'failure', statuses }
}
const COMPLETADO = { state: 'success', description: 'Deployment has completed' }
const CONSTRUYENDO = { state: 'pending', description: 'Building' }
const CUOTA = { state: 'failure', description: 'Deployment rate limited — retry in 24 hours' }

// ─────────────────────────────────────────────────────────────────────────────
// Las comprobaciones, una a una
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluarApp', () => {
  it('200 sano: verde', () => {
    expect(evaluarApp({ codigo: 200, errorVercel: null }).estado).toBe('verde')
  })

  it('402 con DEPLOYMENT_DISABLED: alarma, y la clave lleva el código y la cabecera', () => {
    const c = evaluarApp({ codigo: 402, errorVercel: 'DEPLOYMENT_DISABLED' })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('app:402:DEPLOYMENT_DISABLED')
    expect(c.detalle).toContain('402')
    expect(c.detalle).toContain('DEPLOYMENT_DISABLED')
  })

  it('404 sin cabecera de Vercel: alarma igual', () => {
    const c = evaluarApp({ codigo: 404, errorVercel: null })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('app:404')
  })

  it('sin respuesta (red caída tras los reintentos): alarma', () => {
    const c = evaluarApp({ fallo: 'fetch failed' })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('app:sin-respuesta')
  })
})

describe('evaluarProduccion', () => {
  const base = { head: { sha: SHA_HEAD, fecha: FECHA_HEAD }, margenMin: 20 }

  it('HEAD desplegado en producción: verde, aunque el estado combinado diga failure por el otro proyecto', () => {
    const c = evaluarProduccion({ ...base, estado: estado(COMPLETADO), despliegues: DESPLIEGUES_AL_DIA, ahora: minutosDespues(60) })
    expect(c.estado).toBe('verde')
  })

  it('reconoce el entorno por PREFIJO con guion largo: la comparación exacta con "Production" daba null', () => {
    const c = evaluarProduccion({
      ...base,
      estado: estado(null),
      despliegues: [despliegue(SHA_HEAD, 'Production – alpha-athletics-app')],
      ahora: minutosDespues(60),
    })
    expect(c.estado).toBe('verde')
  })

  it('main por delante DENTRO del margen: en espera, no alarma', () => {
    const c = evaluarProduccion({ ...base, estado: estado(CONSTRUYENDO), despliegues: DESPLIEGUES_ATRASADOS, ahora: minutosDespues(8) })
    expect(c.estado).toBe('en-espera')
  })

  it('main por delante FUERA del margen: alarma de producción atrasada', () => {
    const c = evaluarProduccion({ ...base, estado: estado(CONSTRUYENDO), despliegues: DESPLIEGUES_ATRASADOS, ahora: minutosDespues(45) })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('produccion:atrasada')
    expect(c.detalle).toContain(SHA_HEAD.slice(0, 7))
    expect(c.detalle).toContain(SHA_VIEJO.slice(0, 7))
  })

  it('un despliegue del HEAD en `alpha-app-fix-calendario` no cuenta como producción', () => {
    const c = evaluarProduccion({ ...base, estado: estado(null), despliegues: DESPLIEGUES_ATRASADOS, ahora: minutosDespues(45) })
    expect(c.estado).toBe('alarma')
  })

  it('estado Vercel en failure: alarma al momento, sin esperar el margen, con la descripción', () => {
    const c = evaluarProduccion({ ...base, estado: estado(CUOTA), despliegues: DESPLIEGUES_ATRASADOS, ahora: minutosDespues(2) })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('vercel:failure:Deployment rate limited — retry in N hours')
    expect(c.detalle).toContain('Deployment rate limited')
  })

  it('la clave del failure no cambia porque cambie el número de horas', () => {
    const a = evaluarProduccion({ ...base, estado: estado(CUOTA), despliegues: [], ahora: minutosDespues(2) })
    const b = evaluarProduccion({
      ...base,
      estado: estado({ state: 'failure', description: 'Deployment rate limited — retry in 23 hours' }),
      despliegues: [],
      ahora: minutosDespues(2),
    })
    expect(a.clave).toBe(b.clave)
  })

  it('«Account is blocked.» en el contexto propio: alarma con su propia clave', () => {
    const c = evaluarProduccion({
      ...base,
      estado: estado({ state: 'failure', description: 'Account is blocked.' }),
      despliegues: [],
      ahora: minutosDespues(2),
    })
    expect(c.estado).toBe('alarma')
    expect(c.clave).toBe('vercel:failure:Account is blocked.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Qué se hace con el issue: aquí vive el «sin inundar»
// ─────────────────────────────────────────────────────────────────────────────

const verde = (nombre: 'app' | 'produccion'): Comprobacion => ({ nombre, estado: 'verde', detalle: 'ok' })
const alarma = (nombre: 'app' | 'produccion', clave: string): Comprobacion => ({ nombre, estado: 'alarma', clave, detalle: clave })
const indeterminado: Comprobacion = { nombre: 'produccion', estado: 'indeterminado', detalle: 'API caída' }

describe('resumir', () => {
  it('la clave junta las alarmas en orden estable', () => {
    const a = resumir([alarma('produccion', 'vercel:failure:x'), alarma('app', 'app:402')])
    const b = resumir([alarma('app', 'app:402'), alarma('produccion', 'vercel:failure:x')])
    expect(a.clave).toBe(b.clave)
    expect(a.concluyente).toBe(true)
  })

  it('una comprobación indeterminada o en espera no es concluyente', () => {
    expect(resumir([verde('app'), indeterminado]).concluyente).toBe(false)
    expect(resumir([verde('app'), { nombre: 'produccion', estado: 'en-espera', detalle: '' }]).concluyente).toBe(false)
  })
})

describe('decidir', () => {
  const issue = (clave: string | null): IssueAbierto => ({ numero: 7, clave })
  const r = (...c: Comprobacion[]): Resumen => resumir(c)

  it('todo verde y sin issue: nada', () => {
    expect(decidir(null, r(verde('app'), verde('produccion'))).tipo).toBe('nada')
  })

  it('alarma y sin issue: abrir', () => {
    expect(decidir(null, r(alarma('app', 'app:402'), verde('produccion'))).tipo).toBe('abrir')
  })

  it('LA MISMA alarma con el issue ya abierto: nada, ni un comentario', () => {
    expect(decidir(issue('app:402'), r(alarma('app', 'app:402'), verde('produccion'))).tipo).toBe('nada')
  })

  it('cambia el motivo: comentar', () => {
    expect(decidir(issue('app:402'), r(verde('app'), alarma('produccion', 'produccion:atrasada'))).tipo).toBe('comentar')
  })

  it('vuelve todo a verde con issue abierto: cerrar', () => {
    expect(decidir(issue('app:402'), r(verde('app'), verde('produccion'))).tipo).toBe('cerrar')
  })

  it('API caída con issue abierto: ni cierra ni comenta', () => {
    expect(decidir(issue('app:402'), r(verde('app'), indeterminado)).tipo).toBe('nada')
    expect(decidir(issue('app:402+vercel:failure:x'), r(alarma('app', 'app:402'), indeterminado)).tipo).toBe('nada')
  })

  it('en espera del build con issue abierto: no lo cierra antes de tiempo', () => {
    const espera: Comprobacion = { nombre: 'produccion', estado: 'en-espera', detalle: '' }
    expect(decidir(issue('produccion:atrasada'), r(verde('app'), espera)).tipo).toBe('nada')
  })

  it('API caída sin issue pero con la app en 402: abre igual, la alarma de la app es cierta', () => {
    expect(decidir(null, r(alarma('app', 'app:402'), indeterminado)).tipo).toBe('abrir')
  })
})

describe('marcar y leerClave', () => {
  it('ida y vuelta, incluso con guion largo y espacios', () => {
    const clave = 'app:402:DEPLOYMENT_DISABLED + vercel:failure:Deployment rate limited — retry in N hours'
    expect(leerClave(`texto\n${marcar(clave)}\nmás`)).toBe(clave)
  })

  it('texto sin marca: null', () => {
    expect(leerClave('un comentario de Bryan')).toBeNull()
  })

  it('con varias marcas se queda con la última', () => {
    expect(leerClave(`${marcar('a')}\n${marcar('b')}`)).toBe('b')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// La corrida entera, con un fetch falso y quince minutos de por medio
// ─────────────────────────────────────────────────────────────────────────────

interface Llamada {
  metodo: string
  url: string
  cuerpo: unknown
}

type Respuesta = Response | Error | (() => Response | Error)

interface Escenario {
  app?: Respuesta
  commit?: Respuesta
  estado?: Respuesta
  despliegues?: Respuesta
  issues?: Respuesta
  comentarios?: Respuesta
  etiqueta?: Respuesta
}

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'content-type': 'application/json' } })

function falsoFetch(e: Escenario) {
  const llamadas: Llamada[] = []
  const servir = (r: Respuesta | undefined): Response => {
    const valor = typeof r === 'function' ? r() : r
    if (!valor) return json({ message: 'Not Found' }, 404)
    if (valor instanceof Error) throw valor
    return valor.clone()
  }
  const fetch = async (entrada: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(entrada))
    const metodo = (init?.method ?? 'GET').toUpperCase()
    llamadas.push({ metodo, url: url.toString(), cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.host === 'alpha-athletics-app.vercel.app') return servir(e.app)
    const ruta = url.pathname.replace('/repos/nabrybryan-dev/alpha-app', '')
    if (metodo !== 'GET') return json({ number: 99, html_url: 'https://github.com/x/issues/99' }, 201)
    if (ruta === '/commits/main') return servir(e.commit)
    if (/^\/commits\/[0-9a-f]+\/status$/.test(ruta)) return servir(e.estado)
    if (ruta === '/deployments') return servir(e.despliegues)
    if (ruta === '/issues') return servir(e.issues)
    if (/^\/issues\/\d+\/comments$/.test(ruta)) return servir(e.comentarios)
    if (ruta === '/labels/vigia') return servir(e.etiqueta)
    throw new Error(`ruta no prevista en la prueba: ${metodo} ${ruta}`)
  }
  return { fetch, llamadas, escrituras: () => llamadas.filter((l) => l.metodo !== 'GET') }
}

const app200 = () => new Response('<html></html>', { status: 200 })
const app402 = () =>
  new Response('Payment required', { status: 402, headers: { 'X-Vercel-Error': 'DEPLOYMENT_DISABLED' } })
const commitHead = json({ sha: SHA_HEAD, commit: { committer: { date: FECHA_HEAD } } })
const sinIssues = json([])
const conIssue = (clave: string) =>
  json([{ number: 7, title: 'Vigía', body: `cuerpo\n${marcar(clave)}`, labels: [{ name: 'vigia' }] }])

const SANO: Escenario = {
  app: app200,
  commit: commitHead,
  estado: json(estado(COMPLETADO)),
  despliegues: json(DESPLIEGUES_AL_DIA),
  issues: sinIssues,
  comentarios: json([]),
  etiqueta: json({ name: 'vigia' }),
}

const correr = (e: Escenario, extra: { avisar?: boolean; ahora?: Date } = {}) => {
  const f = falsoFetch(e)
  const promesa = vigilar({
    fetch: f.fetch,
    token: 'token-falso',
    ahora: extra.ahora ?? minutosDespues(60),
    avisar: extra.avisar ?? true,
    esperaMs: 0,
    registrar: () => {},
  })
  return { f, promesa }
}

describe('vigilar (la corrida entera)', () => {
  it('200 sano y producción al día: no escribe nada', async () => {
    const { f, promesa } = correr(SANO)
    const r = await promesa
    expect(r.accion.tipo).toBe('nada')
    expect(f.escrituras()).toEqual([])
  })

  it('pide la app con ?nocache=<ts> para no leer una copia de caché', async () => {
    const { f, promesa } = correr(SANO)
    await promesa
    const pedida = f.llamadas.find((l) => l.url.includes('vercel.app'))
    expect(pedida?.url).toMatch(/[?&]nocache=\d+/)
  })

  it('402: abre UN issue con la etiqueta `vigia`, el código y la cabecera', async () => {
    const { f, promesa } = correr({ ...SANO, app: app402 })
    const r = await promesa
    expect(r.accion.tipo).toBe('abrir')
    const creados = f.escrituras().filter((l) => l.url.endsWith('/issues'))
    expect(creados).toHaveLength(1)
    const cuerpo = creados[0].cuerpo as { labels: string[]; body: string }
    expect(cuerpo.labels).toEqual(['vigia'])
    expect(cuerpo.body).toContain('402')
    expect(cuerpo.body).toContain('DEPLOYMENT_DISABLED')
    expect(leerClave(cuerpo.body)).toBe('app:402:DEPLOYMENT_DISABLED')
  })

  it('crea la etiqueta si no existe, antes de abrir el issue', async () => {
    const { f, promesa } = correr({ ...SANO, app: app402, etiqueta: undefined })
    await promesa
    const urls = f.escrituras().map((l) => new URL(l.url).pathname)
    expect(urls[0]).toMatch(/\/labels$/)
    expect(urls[1]).toMatch(/\/issues$/)
  })

  it('402 durante cuatro corridas seguidas: un issue y CERO comentarios más', async () => {
    const primera = correr({ ...SANO, app: app402 })
    await primera.promesa
    expect(primera.f.escrituras()).toHaveLength(1)
    for (let i = 0; i < 3; i++) {
      const siguiente = correr({ ...SANO, app: app402, issues: conIssue('app:402:DEPLOYMENT_DISABLED') })
      const r = await siguiente.promesa
      expect(r.accion.tipo).toBe('nada')
      expect(siguiente.f.escrituras()).toEqual([])
    }
  })

  it('el motivo se lee del ÚLTIMO comentario marcado, no del cuerpo original', async () => {
    const { f, promesa } = correr({
      ...SANO,
      estado: json(estado(CUOTA)),
      despliegues: json(DESPLIEGUES_ATRASADOS),
      issues: conIssue('app:402:DEPLOYMENT_DISABLED'),
      comentarios: json([
        { body: 'lo miro mañana' },
        { body: `cambió\n${marcar('vercel:failure:Deployment rate limited — retry in N hours')}` },
      ]),
    })
    const r = await promesa
    expect(r.accion.tipo).toBe('nada')
    expect(f.escrituras()).toEqual([])
  })

  it('main por delante dentro del margen: nada, ni abre ni cierra', async () => {
    const e = { ...SANO, estado: json(estado(CONSTRUYENDO)), despliegues: json(DESPLIEGUES_ATRASADOS) }
    const sinIssue = correr(e, { ahora: minutosDespues(8) })
    expect((await sinIssue.promesa).accion.tipo).toBe('nada')
    const conUno = correr({ ...e, issues: conIssue('produccion:atrasada') }, { ahora: minutosDespues(8) })
    expect((await conUno.promesa).accion.tipo).toBe('nada')
    expect(conUno.f.escrituras()).toEqual([])
  })

  it('main por delante fuera del margen: abre con el motivo de producción atrasada', async () => {
    const { f, promesa } = correr(
      { ...SANO, estado: json(estado(CONSTRUYENDO)), despliegues: json(DESPLIEGUES_ATRASADOS) },
      { ahora: minutosDespues(45) },
    )
    const r = await promesa
    expect(r.accion.tipo).toBe('abrir')
    const cuerpo = f.escrituras().find((l) => l.url.endsWith('/issues'))?.cuerpo as { body: string }
    expect(leerClave(cuerpo.body)).toBe('produccion:atrasada')
  })

  it('estado failure con issue abierto por otro motivo: comenta el cambio, sin abrir otro', async () => {
    const { f, promesa } = correr({
      ...SANO,
      estado: json(estado(CUOTA)),
      despliegues: json(DESPLIEGUES_ATRASADOS),
      issues: conIssue('app:402:DEPLOYMENT_DISABLED'),
    })
    const r = await promesa
    expect(r.accion.tipo).toBe('comentar')
    const escritas = f.escrituras()
    expect(escritas).toHaveLength(1)
    expect(escritas[0].url).toMatch(/\/issues\/7\/comments$/)
    expect((escritas[0].cuerpo as { body: string }).body).toContain('Deployment rate limited')
  })

  it('vuelve a verde: comenta y cierra el issue', async () => {
    const { f, promesa } = correr({ ...SANO, issues: conIssue('app:402:DEPLOYMENT_DISABLED') })
    const r = await promesa
    expect(r.accion.tipo).toBe('cerrar')
    const escritas = f.escrituras()
    expect(escritas.map((l) => `${l.metodo} ${new URL(l.url).pathname}`)).toEqual([
      'POST /repos/nabrybryan-dev/alpha-app/issues/7/comments',
      'PATCH /repos/nabrybryan-dev/alpha-app/issues/7',
    ])
    expect(escritas[1].cuerpo).toMatchObject({ state: 'closed' })
  })

  it('API de GitHub caída (red): sin falsa alarma y sin cerrar el issue abierto', async () => {
    const caida = new TypeError('fetch failed')
    const e: Escenario = { ...SANO, commit: caida, estado: caida, despliegues: caida }
    const sinIssue = correr(e)
    const r1 = await sinIssue.promesa
    expect(r1.accion.tipo).toBe('nada')
    expect(r1.comprobaciones.find((c) => c.nombre === 'produccion')?.estado).toBe('indeterminado')
    expect(sinIssue.f.escrituras()).toEqual([])

    const conUno = correr({ ...e, issues: conIssue('produccion:atrasada') })
    expect((await conUno.promesa).accion.tipo).toBe('nada')
    expect(conUno.f.escrituras()).toEqual([])
  })

  it('API de GitHub con 502: también indeterminado, no alarma', async () => {
    const { f, promesa } = correr({ ...SANO, despliegues: () => json({ message: 'Bad Gateway' }, 502) })
    const r = await promesa
    expect(r.comprobaciones.find((c) => c.nombre === 'produccion')?.estado).toBe('indeterminado')
    expect(r.accion.tipo).toBe('nada')
    expect(f.escrituras()).toEqual([])
  })

  it('un fallo transitorio que se recupera al reintentar no cuenta como fallo', async () => {
    let veces = 0
    const { promesa } = correr({
      ...SANO,
      app: () => (veces++ === 0 ? new TypeError('fetch failed') : app200()),
      despliegues: () => (veces++ < 3 ? json({ message: 'Bad Gateway' }, 502) : json(DESPLIEGUES_AL_DIA)),
    })
    const r = await promesa
    expect(r.comprobaciones.map((c) => c.estado)).toEqual(['verde', 'verde'])
  })

  it('si no se pueden leer los issues, no escribe: abrir a ciegas duplicaría', async () => {
    const { f, promesa } = correr({ ...SANO, app: app402, issues: new TypeError('fetch failed') })
    const r = await promesa
    expect(r.accion.tipo).toBe('nada')
    expect(f.escrituras()).toEqual([])
  })

  it('en seco (sin --avisar) decide igual pero no escribe nada', async () => {
    const { f, promesa } = correr({ ...SANO, app: app402 }, { avisar: false })
    const r = await promesa
    expect(r.accion.tipo).toBe('abrir')
    expect(r.escrito).toBe(false)
    expect(f.escrituras()).toEqual([])
  })
})

describe('leerArgumentos', () => {
  it('por defecto va en seco y apunta a la app real', () => {
    const a = leerArgumentos([])
    expect(a.avisar).toBe(false)
    expect(a.urlApp).toBe(CONFIG.urlApp)
    expect(a.margenMin).toBe(20)
  })

  it('--avisar, --url y --margen', () => {
    const a = leerArgumentos(['--avisar', '--url', 'https://ejemplo.test/x', '--margen', '5'])
    expect(a).toMatchObject({ avisar: true, urlApp: 'https://ejemplo.test/x', margenMin: 5 })
  })

  it('una bandera desconocida es un error, no se ignora', () => {
    expect(() => leerArgumentos(['--avisa'])).toThrow()
  })
})
