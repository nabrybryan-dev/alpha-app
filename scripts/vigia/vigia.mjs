// El vigía de la app — testeado en scripts/vigia/vigia.test.ts
//
// Por qué existe. El 13-sep-2026 la app de los asesorados estuvo horas respondiendo
// `402 Payment Required` (`X-Vercel-Error: DEPLOYMENT_DISABLED`) y nadie se enteró
// hasta que Bryan lo vio. Días antes, las fusiones a `main` no llegaban a producción
// por la cuota de Vercel («Deployment rate limited») y tampoco lo avisó nada.
//
// Qué mira, cada 15 minutos desde `.github/workflows/vigia.yml`:
//   1. La app responde 200.
//   2. Producción va al día con `main`: el estado de Vercel del HEAD no está en
//      `failure`, y el HEAD tiene despliegue de producción o lleva menos de
//      `margenMin` minutos esperándolo (construir tarda unos minutos).
//
// Cómo avisa, SIN INUNDAR. Un único issue abierto con la etiqueta `vigia`. Cada
// aviso deja en el texto una marca invisible con la clave del motivo; la corrida
// siguiente la lee y solo vuelve a escribir si el motivo CAMBIA. Cuando todo vuelve
// a verde, comenta y cierra. Hubo un vigía que repetía la misma alarma cada 15
// minutos: eso es lo que las claves y `decidir` impiden.
//
// Y sin falsas alarmas. Una API que falla se reintenta; si sigue fallando, esa
// comprobación queda «indeterminada», y con algo indeterminado no se cierra ni se
// comenta nada. Tampoco se escribe si no se ha podido leer qué issue hay abierto:
// abrir a ciegas duplicaría.
//
// Por defecto va EN SECO: decide y lo cuenta, pero no escribe. Solo `--avisar`
// toca GitHub. Sin dependencias: Node 24 trae `fetch`.
//
//   node scripts/vigia/vigia.mjs                       # en seco, contra la app real
//   node scripts/vigia/vigia.mjs --url https://…/404   # ver una alarma de verdad
//   node scripts/vigia/vigia.mjs --avisar              # lo que hace Actions
import { pathToFileURL } from 'node:url'

export const CONFIG = {
  repo: 'nabrybryan-dev/alpha-app',
  urlApp: 'https://alpha-athletics-app.vercel.app/',
  // PREFIJO, no igualdad: desde que Vercel renombró los entornos, comparar con
  // "Production" a secas no encuentra nada. Guion largo (U+2013), no el del teclado.
  // Del mismo repo cuelga otro proyecto, `alpha-app-fix-calendario`, que no cuenta.
  prefijoProduccion: 'Production – alpha-athletics-app',
  contextoVercel: 'Vercel – alpha-athletics-app',
  margenMin: 20,
  etiqueta: 'vigia',
  intentos: 3,
  esperaMs: 5000,
}

const corto = (sha) => String(sha ?? '').slice(0, 7)

// ─────────────────────────────────────────────────────────────────────────────
// Evaluación: funciones puras sobre lo que se leyó
// ─────────────────────────────────────────────────────────────────────────────

/** La app responde 200, o no. */
export function evaluarApp(respuesta) {
  if ('fallo' in respuesta) {
    return {
      nombre: 'app',
      estado: 'alarma',
      clave: 'app:sin-respuesta',
      detalle: `La app no responde (${respuesta.fallo}).`,
    }
  }
  const { codigo, errorVercel } = respuesta
  if (codigo === 200) return { nombre: 'app', estado: 'verde', detalle: 'La app responde 200.' }
  return {
    nombre: 'app',
    estado: 'alarma',
    clave: errorVercel ? `app:${codigo}:${errorVercel}` : `app:${codigo}`,
    detalle: errorVercel
      ? `La app responde ${codigo} con \`X-Vercel-Error: ${errorVercel}\`.`
      : `La app responde ${codigo}.`,
  }
}

/** El número de horas de «retry in 24 hours» cambia; el motivo, no. */
const normalizarDescripcion = (texto) => String(texto ?? '').trim().replace(/\d+/g, 'N')

/** Producción va al día con el HEAD de `main`, o no. */
export function evaluarProduccion({ head, estado, despliegues, ahora, margenMin }) {
  const propio = (estado.statuses ?? []).find((s) => s.context === CONFIG.contextoVercel)
  const produccion = despliegues.filter((d) => String(d.environment ?? '').startsWith(CONFIG.prefijoProduccion))
  const servido = produccion[0]?.sha

  // El `state` combinado NO sirve: sale en `failure` por el otro proyecto del repo.
  if (propio && (propio.state === 'failure' || propio.state === 'error')) {
    return {
      nombre: 'produccion',
      estado: 'alarma',
      clave: `vercel:${propio.state}:${normalizarDescripcion(propio.description)}`,
      detalle:
        `Vercel marca \`${propio.state}\` en el HEAD de main (${corto(head.sha)}): ` +
        `«${propio.description ?? 'sin descripción'}». Producción sirve ${corto(servido) || 'nada conocido'}.`,
    }
  }

  if (produccion.some((d) => d.sha === head.sha)) {
    return {
      nombre: 'produccion',
      estado: 'verde',
      detalle: `Producción tiene desplegado el HEAD de main (${corto(head.sha)}).`,
    }
  }

  const minutos = Math.floor((ahora.getTime() - Date.parse(head.fecha)) / 60_000)
  if (minutos <= margenMin) {
    return {
      nombre: 'produccion',
      estado: 'en-espera',
      detalle: `El HEAD de main (${corto(head.sha)}) lleva ${minutos} min; se le dan ${margenMin} para desplegar.`,
    }
  }
  return {
    nombre: 'produccion',
    estado: 'alarma',
    clave: 'produccion:atrasada',
    detalle:
      `El HEAD de main (${corto(head.sha)}) lleva ${minutos} min sin despliegue de producción ` +
      `(margen: ${margenMin}). Producción sirve ${corto(servido) || 'nada conocido'}.`,
  }
}

export function resumir(comprobaciones) {
  const alarmas = comprobaciones.filter((c) => c.estado === 'alarma')
  return {
    comprobaciones,
    alarmas,
    concluyente: comprobaciones.every((c) => c.estado === 'verde' || c.estado === 'alarma'),
    clave: alarmas
      .map((c) => c.clave)
      .sort()
      .join(' + '),
  }
}

/**
 * Qué hacer con el issue. Aquí vive el «sin inundar»:
 * - la misma clave que el último aviso no escribe nada;
 * - con algo indeterminado o en espera no se comenta ni se cierra, porque el
 *   motivo aún no se conoce entero;
 * - sí se abre si no hay issue y hay una alarma cierta (la app en 402 no necesita
 *   que la API de despliegues responda para ser verdad).
 */
export function decidir(issue, resumen) {
  const hayAlarma = resumen.alarmas.length > 0
  if (!issue) {
    return hayAlarma
      ? { tipo: 'abrir', motivo: `Alarma nueva: ${resumen.clave}` }
      : { tipo: 'nada', motivo: 'Sin alarmas y sin issue abierto.' }
  }
  if (!resumen.concluyente) {
    return { tipo: 'nada', motivo: `Issue #${issue.numero} abierto; alguna comprobación sin concluir, no se toca.` }
  }
  if (!hayAlarma) return { tipo: 'cerrar', motivo: `Todo en verde: se cierra #${issue.numero}.` }
  if (issue.clave === resumen.clave) {
    return { tipo: 'nada', motivo: `Mismo motivo que el último aviso de #${issue.numero}: no se repite.` }
  }
  return { tipo: 'comentar', motivo: `El motivo cambió en #${issue.numero}: ${resumen.clave}` }
}

// La clave va codificada: así ni un `-->` ni un salto de línea pueden romper la marca.
const PATRON_MARCA = /<!-- vigia:clave=([^\s>]*) -->/g

export function marcar(clave) {
  return `<!-- vigia:clave=${encodeURIComponent(clave)} -->`
}

export function leerClave(texto) {
  const marcas = [...String(texto ?? '').matchAll(PATRON_MARCA)]
  if (marcas.length === 0) return null
  return decodeURIComponent(marcas[marcas.length - 1][1])
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura, con reintentos
// ─────────────────────────────────────────────────────────────────────────────

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

class ErrorHttp extends Error {
  constructor(metodo, ruta, status, texto) {
    super(`${metodo} ${ruta} → ${status}${texto ? `: ${texto.slice(0, 200)}` : ''}`)
    this.status = status
  }
}

/** Reintenta lo que puede ser pasajero: red, 5xx y 429. Un 404 o un 401 no mejoran por insistir. */
async function conReintentos(fn, { intentos, esperaMs }) {
  let ultimo
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn()
    } catch (error) {
      ultimo = error
      const pasajero = !(error instanceof ErrorHttp) || error.status >= 500 || error.status === 429
      if (!pasajero || i === intentos - 1) break
      await dormir(esperaMs * (i + 1))
    }
  }
  throw ultimo
}

function clienteGithub({ fetch, token, intentos, esperaMs }) {
  const cabeceras = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'alpha-app-vigia',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const pedir = async (metodo, ruta, cuerpo) => {
    const url = `https://api.github.com/repos/${CONFIG.repo}${ruta}`
    const r = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { ...cabeceras, 'Content-Type': 'application/json' } : cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) throw new ErrorHttp(metodo, ruta, r.status, await r.text().catch(() => ''))
    return r.status === 204 ? null : r.json()
  }
  return {
    // Solo las lecturas se reintentan. Reintentar un POST cuya respuesta se perdió
    // podría abrir dos issues, que es justo lo que no puede pasar.
    leer: (ruta) => conReintentos(() => pedir('GET', ruta), { intentos, esperaMs }),
    escribir: (metodo, ruta, cuerpo) => pedir(metodo, ruta, cuerpo),
  }
}

async function comprobarApp({ fetch, urlApp, ahora, intentos, esperaMs }) {
  const url = new URL(urlApp)
  url.searchParams.set('nocache', String(ahora.getTime()))
  let respuesta
  try {
    // Un código distinto de 200 también se reintenta: un 503 de un segundo no es
    // una caída. Un 402 de verdad sigue ahí al tercer intento.
    respuesta = await conReintentos(
      async () => {
        const r = await fetch(url.toString(), {
          headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'alpha-app-vigia' },
          signal: AbortSignal.timeout(20_000),
        })
        // Solo interesa el código: se suelta el cuerpo SIN esperar. Esperar a
        // `cancel()` puede no volver nunca (en un cuerpo bifurcado solo resuelve
        // cuando se cancelan todas las ramas), y colgaría la corrida entera.
        r.body?.cancel().catch(() => {})
        const leida = { codigo: r.status, errorVercel: r.headers.get('x-vercel-error') }
        if (r.status !== 200) throw Object.assign(new Error(`HTTP ${r.status}`), { leida })
        return leida
      },
      { intentos, esperaMs },
    )
  } catch (error) {
    respuesta = error.leida ?? { fallo: error.message }
  }
  return evaluarApp(respuesta)
}

async function comprobarProduccion({ github, ahora, margenMin }) {
  try {
    const commit = await github.leer('/commits/main')
    const head = { sha: commit.sha, fecha: commit.commit.committer.date }
    const [estado, despliegues] = await Promise.all([
      github.leer(`/commits/${head.sha}/status`),
      github.leer('/deployments?per_page=30'),
    ])
    return evaluarProduccion({ head, estado, despliegues, ahora, margenMin })
  } catch (error) {
    return {
      nombre: 'produccion',
      estado: 'indeterminado',
      detalle: `No se pudo leer el estado de despliegue (${error.message}).`,
    }
  }
}

async function leerIssueAbierto(github) {
  const issues = await github.leer(`/issues?labels=${CONFIG.etiqueta}&state=open&per_page=10`)
  const propios = issues.filter((i) => !i.pull_request).sort((a, b) => a.number - b.number)
  if (propios.length === 0) return null
  const issue = propios[0]
  let clave = leerClave(issue.body)
  for (let pagina = 1; pagina <= 10; pagina++) {
    const comentarios = await github.leer(`/issues/${issue.number}/comments?per_page=100&page=${pagina}`)
    for (const c of comentarios) clave = leerClave(c.body) ?? clave
    if (comentarios.length < 100) break
  }
  return { numero: issue.number, clave }
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

function lista(resumen) {
  return resumen.comprobaciones
    .map((c) => {
      const icono = { verde: 'OK', alarma: 'ALARMA', 'en-espera': 'en espera', indeterminado: 'sin leer' }[c.estado]
      return `- **${c.nombre === 'app' ? 'App' : 'Producción'}** (${icono}): ${c.detalle}`
    })
    .join('\n')
}

function pie(resumen, { ahora, enlaceCorrida }) {
  const corrida = enlaceCorrida ? ` · [corrida](${enlaceCorrida})` : ''
  return `\n\n<sub>Vigía, ${ahora.toISOString()}${corrida}</sub>\n${marcar(resumen.clave)}`
}

function redactar(tipo, resumen, contexto) {
  if (tipo === 'abrir') {
    return (
      `La app de los asesorados necesita atención.\n\n${lista(resumen)}\n\n` +
      'Dónde mirar: el panel de Vercel del proyecto `alpha-athletics-app` (cuota, cuenta, ' +
      'último despliegue) y `https://alpha-athletics-app.vercel.app/`.\n\n' +
      'Este issue no se repite: solo recibe un comentario si el motivo cambia, y se cierra ' +
      'solo cuando todo vuelve a verde.' +
      pie(resumen, contexto)
    )
  }
  if (tipo === 'comentar') return `El motivo cambió.\n\n${lista(resumen)}${pie(resumen, contexto)}`
  return `Todo vuelve a verde.\n\n${lista(resumen)}${pie(resumen, contexto)}`
}

async function aplicar(accion, issue, resumen, github, contexto) {
  if (accion.tipo === 'abrir') {
    try {
      await github.leer(`/labels/${CONFIG.etiqueta}`)
    } catch (error) {
      if (error.status !== 404) throw error
      await github.escribir('POST', '/labels', {
        name: CONFIG.etiqueta,
        color: 'b60205',
        description: 'Aviso automático: la app se cae o producción va atrasada',
      })
    }
    const titulo = resumen.alarmas.some((c) => c.nombre === 'app')
      ? 'Vigía: la app de los asesorados no responde bien'
      : 'Vigía: producción no va al día con main'
    await github.escribir('POST', '/issues', {
      title: titulo,
      body: redactar('abrir', resumen, contexto),
      labels: [CONFIG.etiqueta],
    })
  } else if (accion.tipo === 'comentar') {
    await github.escribir('POST', `/issues/${issue.numero}/comments`, { body: redactar('comentar', resumen, contexto) })
  } else if (accion.tipo === 'cerrar') {
    await github.escribir('POST', `/issues/${issue.numero}/comments`, { body: redactar('cerrar', resumen, contexto) })
    await github.escribir('PATCH', `/issues/${issue.numero}`, { state: 'closed', state_reason: 'completed' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La corrida
// ─────────────────────────────────────────────────────────────────────────────

export async function vigilar(opciones = {}) {
  const {
    fetch = globalThis.fetch,
    token = null,
    ahora = new Date(),
    avisar = false,
    urlApp = CONFIG.urlApp,
    margenMin = CONFIG.margenMin,
    intentos = CONFIG.intentos,
    esperaMs = CONFIG.esperaMs,
    registrar = (linea) => console.log(linea),
    enlaceCorrida = null,
  } = opciones

  const github = clienteGithub({ fetch, token, intentos, esperaMs })
  const comprobaciones = [
    await comprobarApp({ fetch, urlApp, ahora, intentos, esperaMs }),
    await comprobarProduccion({ github, ahora, margenMin }),
  ]
  const resumen = resumir(comprobaciones)
  for (const c of comprobaciones) registrar(`[${c.estado}] ${c.nombre}: ${c.detalle}`)

  let issue = null
  let accion
  try {
    issue = await leerIssueAbierto(github)
    accion = decidir(issue, resumen)
  } catch (error) {
    accion = { tipo: 'nada', motivo: `No se pudo leer qué issue hay abierto (${error.message}); no se escribe a ciegas.` }
  }

  let escrito = false
  if (accion.tipo !== 'nada' && avisar) {
    await aplicar(accion, issue, resumen, github, { ahora, enlaceCorrida })
    escrito = true
    registrar(`Hecho: ${accion.tipo}. ${accion.motivo}`)
  } else if (accion.tipo !== 'nada') {
    registrar(`[en seco] Haría: ${accion.tipo}. ${accion.motivo}`)
  } else {
    registrar(`Nada que hacer. ${accion.motivo}`)
  }
  return { comprobaciones, resumen, issue, accion, escrito }
}

export function leerArgumentos(argv) {
  const argumentos = { avisar: false, urlApp: CONFIG.urlApp, margenMin: CONFIG.margenMin }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--avisar') argumentos.avisar = true
    else if (a === '--url' && argv[i + 1]) argumentos.urlApp = argv[++i]
    else if (a === '--margen' && Number.isFinite(Number(argv[i + 1]))) argumentos.margenMin = Number(argv[++i])
    else throw new Error(`Argumento no reconocido: ${a}. Uso: vigia.mjs [--avisar] [--url URL] [--margen MIN]`)
  }
  return argumentos
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentos = leerArgumentos(process.argv.slice(2))
  const token = process.env.GITHUB_TOKEN || null
  if (argumentos.avisar && !token) {
    console.error('--avisar necesita GITHUB_TOKEN para escribir en los issues.')
    process.exit(2)
  }
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
  const enlaceCorrida =
    GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
      : null
  // Una alarma NO es un fallo de la corrida: el aviso es el issue. Si la corrida
  // saliera en rojo con cada alarma, Actions mandaría además un correo cada 15
  // minutos, que es la inundación que se quiere evitar. Solo sale en rojo si el
  // vigía mismo se rompe (por ejemplo, no puede escribir el issue).
  await vigilar({ ...argumentos, token, enlaceCorrida })
}
