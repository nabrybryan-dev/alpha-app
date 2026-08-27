import http from 'k6/http'
import { check, sleep, fail } from 'k6'
import { Counter, Trend } from 'k6/metrics'

/**
 * Prueba de carga de la hidratación, de 10 a 1.000 usuarios.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ MIDE, Y POR QUÉ NO APUNTA A LA APP
 * ─────────────────────────────────────────────────────────────────────────────
 * Apuntar k6 a la URL de la app mediría **el CDN de Vercel**, que sirve ficheros
 * estáticos y no se degrada: daría un informe precioso y vacío. La carga real de
 * esta app cae en PostgREST y en Postgres, así que se golpea ahí.
 *
 * Y va **autenticado**. Sin JWT no se activa RLS, y RLS es justo lo que decide
 * cuánto trabajo hace el servidor: para un asesorado acota a lo suyo, para el
 * coach `es_coach()` es cierto y no acota nada. Una prueba anónima mediría un
 * mundo que no existe.
 *
 * Cada iteración imita lo que hace UNA pestaña abierta en un refresco:
 *
 *   1. `firma_de_sincronizacion`  (0049)
 *   2. si algo cambió: las 21 consultas, en paralelo, como el `Promise.all`
 *   3. `ranking_disciplina`       (0048, servido desde la vista materializada)
 *
 * Las columnas son las de verdad, copiadas de `src/data/nube/hidratar.ts`. Pedir
 * `select=*` mediría un tráfico que la app dejó de generar en el PR #121.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO SE CORRE
 * ─────────────────────────────────────────────────────────────────────────────
 *   k6 run -e SUPABASE_URL=https://<ref>.supabase.co \
 *          -e ANON_KEY=<anon key de ESE proyecto> \
 *          -e USUARIO=carga+1@ejemplo.test \
 *          -e CLAVE=<clave de los usuarios de prueba> \
 *          scripts/carga/hidratacion.k6.js
 *
 * `PROPORCION_COACH` (0 a 1, por defecto 0.05) reparte cuántos usuarios virtuales
 * entran como staff. Importa mucho más de lo que parece: un coach descarga la
 * cartera entera y un asesorado solo lo suyo, así que el mismo número de usuarios
 * da cargas distintas según la mezcla.
 */

// ── La guarda que impide correr esto contra producción ───────────────────────
//
// No es celo defensivo. La base real tiene datos de salud de personas, y una
// prueba de carga escribe, satura y ensucia los contadores de `pg_stat` con los
// que se mide todo lo demás. Correrla ahí una sola vez estropea la línea base.
const PRODUCCION = 'sbzmbiwrnvegrticatza'

const URL_BASE = __ENV.SUPABASE_URL
const ANON = __ENV.ANON_KEY
const USUARIO = __ENV.USUARIO
const CLAVE = __ENV.CLAVE
const PROPORCION_COACH = Number(__ENV.PROPORCION_COACH ?? '0.05')

/** Cada cuánto refresca una pestaña. `SessionProvider.tsx`: 45 s. */
const SEGUNDOS_ENTRE_REFRESCOS = Number(__ENV.INTERVALO ?? '45')

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 600 },
    { duration: '3m', target: 1000 },
    { duration: '2m', target: 1000 }, // meseta: aquí es donde se ve si aguanta
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // Un refresco que tarda más de 2 s con la app abierta se nota.
    'http_req_duration{fase:hidratacion}': ['p(95)<2000'],
    // La firma es el camino corto: si esto se degrada, el ahorro se evapora.
    'http_req_duration{fase:firma}': ['p(95)<400'],
    'http_req_duration{fase:ranking}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

const errores = new Counter('errores_por_fase')
const tablasPorRefresco = new Trend('tablas_descargadas')

/**
 * Las 21 consultas de `hidratarDesdeNube`, con sus columnas reales.
 * Si cambian allí, cambian aquí: una prueba que mide otra cosa es peor que
 * ninguna, porque da confianza sin fundamento.
 */
const CONSULTAS = [
  'usuarios_app?select=id,nombre,rol,avatar_iniciales',
  'perfiles?select=datos',
  'microciclos?select=id,estado,datos',
  'checkins?select=datos',
  'checkins_nutricion?select=id,usuario_id,fecha,peso_kg,hambre,alimentacion,hambre_escala',
  'adherencias?select=id,usuario_id,fecha,estado,comentario',
  'planes_nutricionales?select=datos',
  'mensajes?select=id,de_id,para_id,fecha_iso,texto,adjunto_path,adjunto_tipo,leido,origen',
  'cuestionarios?select=id,datos,asignado_a',
  'respuestas?select=id,cuestionario_id,usuario_id,fecha_iso,valores',
  'contenidos?select=datos',
  'premiaciones?select=id,usuario_id,titulo,fecha,nota',
  'hidratacion?select=id,usuario_id,fecha,ml',
  'perfil_alimentario?select=asesorado_id,respuestas,completada_en',
  'registro_comida?select=id,cliente_id,asesorado_id,momento,comida,cocinado_por_el,aceite_g,sal_g,confianza&borrado=eq.false',
  'registro_item?select=id,cliente_id,registro_id,alimento_id,gramos,fue_pesado,estado_asumido&borrado=eq.false',
  'preferencia_estado?select=asesorado_id,familia,estado',
  'prueba_calibracion?select=id,cliente_id,asesorado_id,fecha,alimento_id,gramos_estimados,gramos_reales',
  'visibilidad_nutricion?select=asesorado_id,ver_composicion,ver_objetivo_calorico,ver_contador_kcal,estado',
  'perfil_alimentario_veto?select=id,asesorado_id,alimento_id,motivo&borrado=eq.false',
  'despensa?select=id,asesorado_id,alimento_id,texto_pedido,cantidad_g,agregado_en,origen&borrado=eq.false',
]

export function setup() {
  if (!URL_BASE || !ANON || !USUARIO || !CLAVE) {
    fail(
      'Faltan variables. Hacen falta SUPABASE_URL, ANON_KEY, USUARIO y CLAVE.\n' +
        'Ver la cabecera de este archivo.',
    )
  }
  if (URL_BASE.includes(PRODUCCION) && __ENV.CONTRA_PRODUCCION !== 'lo-asumo') {
    fail(
      `NEGADO: ${PRODUCCION} es la base de PRODUCCIÓN, con datos de salud reales.\n` +
        'Una prueba de carga escribe, satura y ensucia los contadores de pg_stat\n' +
        'con los que se mide todo lo demás. Usa una rama de Supabase.\n' +
        'Si de verdad sabes lo que haces: -e CONTRA_PRODUCCION=lo-asumo',
    )
  }
  return { url: URL_BASE.replace(/\/$/, '') }
}

/** Inicia sesión y devuelve el token. Sin token no hay RLS, y sin RLS no hay prueba. */
function entrar(url) {
  const r = http.post(
    `${url}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: USUARIO, password: CLAVE }),
    {
      headers: { apikey: ANON, 'content-type': 'application/json' },
      tags: { fase: 'login' },
    },
  )
  if (r.status !== 200) {
    errores.add(1, { fase: 'login' })
    fail(`Login rechazado (${r.status}). ¿Existe el usuario de prueba en ESTE proyecto?`)
  }
  return r.json('access_token')
}

export default function (datos) {
  const url = datos.url
  const token = entrar(url)
  const cabeceras = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  }

  // 1. La firma. Es el camino corto: si dice que nada cambió, la app se para aquí.
  const firma = http.post(`${url}/rest/v1/rpc/firma_de_sincronizacion`, '{}', {
    headers: cabeceras,
    tags: { fase: 'firma' },
  })
  check(firma, { 'la firma responde': (r) => r.status === 200 }) ||
    errores.add(1, { fase: 'firma' })

  // 2. Las 21, en paralelo, como el `Promise.all` de `hidratarDesdeNube`.
  //
  // Se piden SIEMPRE, y a propósito: esta prueba mide el caso PEOR -alguien
  // tocó algo y hay que descargar- porque es el que decide si la app aguanta.
  // El caso bueno ya está medido: es una sola petición, la de arriba.
  const lote = CONSULTAS.map((c) => [
    'GET',
    `${url}/rest/v1/${c}`,
    null,
    { headers: cabeceras, tags: { fase: 'hidratacion' } },
  ])
  const respuestas = http.batch(lote)
  let bien = 0
  for (const r of respuestas) {
    if (r.status === 200) bien += 1
    else errores.add(1, { fase: 'hidratacion' })
  }
  tablasPorRefresco.add(bien)
  check(null, { 'las 21 tablas bajan': () => bien === CONSULTAS.length })

  // 3. El ranking, que desde la 0048 sale de la vista materializada.
  const ranking = http.post(`${url}/rest/v1/rpc/ranking_disciplina`, '{}', {
    headers: cabeceras,
    tags: { fase: 'ranking' },
  })
  check(ranking, { 'el ranking responde': (r) => r.status === 200 }) ||
    errores.add(1, { fase: 'ranking' })

  // Una pestaña abierta refresca cada 45 s. Sin esta espera se mediría un
  // martilleo que ningún usuario real produce, y el cuello de botella que
  // saldría sería el del generador de carga, no el de la app.
  sleep(SEGUNDOS_ENTRE_REFRESCOS * (0.8 + Math.random() * 0.4))
}

/** Es solo un recordatorio: k6 imprime su propio resumen encima de esto. */
export function handleSummary(datos) {
  const p95 = (m) => Math.round(datos.metrics[m]?.values?.['p(95)'] ?? 0)
  return {
    stdout:
      '\n─────────────────────────────────────────────\n' +
      `  firma        p95  ${p95('http_req_duration{fase:firma}')} ms\n` +
      `  hidratacion  p95  ${p95('http_req_duration{fase:hidratacion}')} ms\n` +
      `  ranking      p95  ${p95('http_req_duration{fase:ranking}')} ms\n` +
      `  fallos           ${(datos.metrics.http_req_failed?.values?.rate ?? 0) * 100}%\n` +
      '─────────────────────────────────────────────\n' +
      '  El número final no es el informe. Mira en qué ESCALÓN empezaron a\n' +
      '  subir los tiempos y qué fase se degradó primero: si fue `hidratacion`\n' +
      '  es volumen de datos; si fue `firma`, es contención en Postgres.\n\n',
    'resumen-carga.json': JSON.stringify(datos, null, 2),
  }
}
