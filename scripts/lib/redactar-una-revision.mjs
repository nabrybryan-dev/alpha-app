/**
 * Redactar UNA revisión larga: la ficha de la tasa → huecos → modelo → revisión → reintentos.
 *
 * Lo comparten `scripts/redactar-revision.mjs` (una persona, para probar) y
 * `scripts/revision-larga.mjs` (la tanda de la noche). Una sola copia del prompt y de los
 * reintentos: si cada uno llevara la suya, el jueves correría un prompt distinto del que se
 * probó a mano.
 *
 * EL MODELO SE LLAMA SIN HERRAMIENTAS (`--tools ""`) y con un system prompt propio: aquí solo
 * redacta. El mensaje va por la entrada estándar y no por la línea de órdenes.
 */

import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { contextoSinCifras, microciclosEnPalabras } from '../../src/domain/redaccion/contexto.ts'
import { esSemanaMala, LARGO_MAXIMO, LARGO_MINIMO, revisarBorrador } from '../../src/domain/redaccion/huecos.ts'

export const INTENTOS = 3

const hablado = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

/**
 * Qué mide cada eje, dicho como se lo diría Bryan. NO la unidad interna de la pieza: el 12-sep
 * el modelo leyó en voz alta «el 20 por ciento de las sesiones con huella o series».
 */
const QUE_MIDE = {
  registro: 'la parte de sus ejercicios que anotó con lo que de verdad hizo',
  sesiones: 'la parte de sus sesiones pautadas que llegó a hacer',
  rir: 'la parte de sus series que hizo con el margen (RIR) que se le pidió',
  cargas: 'cómo va el trabajo que mueve frente al ritmo que preveía la semana anterior',
  peso: 'hacia dónde va su peso, semana a semana',
  perimetro: 'la medida de perímetro que pide su plan',
}

/** Qué quiere decir un eje sin número. Ninguno de estos estados es culpa de la persona. */
const SIN_NUMERO = {
  sin_dato: 'no hay dato: no llegó ninguno en esa ventana',
  ilegible: 'hay dato pero no sirve: por ejemplo, series idénticas a la pauta, o pesos repetidos',
  solo_linea_base: 'solo hay una medida: es el punto de partida, todavía no hay ritmo',
  no_se_mide_aun: 'la app TODAVÍA NO LO LEE: no es que la persona no lo registre, y no se le puede reprochar',
  no_clasificado: 'su plan lo nombra con palabras que el sistema no sabe medir: lo lee el coach',
}

/** La ficha de la tasa convertida en lo único que el modelo puede nombrar. */
export function huecosDeLaFicha(ficha) {
  const huecos = {
    nombre: { valor: (ficha.nombre || '').trim().split(/\s+/)[0], significa: 'su nombre de pila' },
  }
  for (const e of ficha.ejes || []) {
    const base = e.eje
    const unidad = e.unidad || ''
    const que = QUE_MIDE[base] || base
    // La ventana es la del ÚLTIMO MICROCICLO CERRADO, no la semana en curso: el 12-sep el
    // modelo dijo «esta semana completaste el 20 %» con el dato del M21. Y va EN PALABRAS: con
    // «(M23)» escrito aquí, el modelo decía «el M23» y el filtro le tumbaba el borrador por
    // escribir una cifra que le habíamos puesto nosotros delante.
    const cuando = e.ventana
      ? `de ${microciclosEnPalabras(e.ventana, ficha.microciclo_activo ?? null)}, ya cerrado, NO de esta semana en curso`
      : ''
    if (e.estado === 'medido' && typeof e.valor === 'number') {
      let valor
      if (base === 'cargas') {
        valor = `${hablado(Math.abs(e.valor))} por ciento ${e.valor < 0 ? 'por debajo' : 'por encima'} del ritmo previsto`
      } else if (unidad.startsWith('%')) valor = `${hablado(e.valor)} por ciento`
      else if (unidad.startsWith('kg/semana')) valor = `${hablado(e.valor)} kilos por semana`
      else if (unidad.startsWith('cm')) valor = `${hablado(e.valor)} centímetros`
      else valor = hablado(e.valor)
      huecos[`${base}_valor`] = {
        valor,
        significa: `${que}, ${cuando}${e.dudoso ? ' · DUDOSO: no lo afirmes como hecho' : ''}`,
      }
    } else {
      huecos[`${base}_valor`] = {
        significa: `${que}: SIN NÚMERO, no uses este hueco · ${SIN_NUMERO[e.estado] || String(e.estado).replace(/_/g, ' ')}`,
      }
    }
    const numeroMeta = typeof e.meta === 'string' ? e.meta.match(/-?\d+(?:[.,]\d+)?/) : null
    if (numeroMeta) {
      const n = Number(numeroMeta[0].replace(',', '.'))
      const dicho = unidad.startsWith('kg')
        ? `${hablado(n)} kilos por semana`
        : unidad.startsWith('cm')
          ? `${hablado(n)} centímetros`
          : `${hablado(n)} por ciento`
      huecos[`${base}_meta`] = { valor: dicho, significa: `la meta que escribió su plan para ${base}` }
    }
    if (typeof e.desvio_pct === 'number') {
      // Sin «de su plan» dentro del valor: en tercera persona chocaba con el «tu plan» del
      // modelo y salía «por detrás de su plan respecto a lo que tu plan preveía».
      huecos[`${base}_desvio`] = {
        valor: `${hablado(Math.abs(e.desvio_pct))} por ciento ${e.desvio_pct < 0 ? 'por detrás' : 'por delante'}`,
        significa: `cuánto va por detrás o por delante de su meta en ${que} (el valor ya dice «por detrás» o «por delante»)`,
      }
    }
  }
  return huecos
}

export function sistema() {
  return [
    'Eres la voz escrita de Bryan, entrenador de Alpha Athletics, grabando la revisión semanal de un asesorado.',
    'Escribes en español, en segunda persona, como se habla en voz alta: frases completas, directas, sin tecnicismos y sin listas.',
    '',
    'REGLAS QUE NO SE NEGOCIAN:',
    '1. No escribas NINGUNA cifra: ni dígitos ni cantidades con letras (dos, tres, mitad, doble, por ciento, kilos...).',
    '   Toda cantidad va con su hueco entre llaves, tal cual aparece en la lista: {registro_valor}.',
    '2. Solo existen los huecos de la lista. Los marcados SIN DATO no se usan nunca.',
    '3. No inventes nada que no esté en el contexto: ni ejercicios, ni sensaciones, ni motivos.',
    '4. Si «semana_mala» es verdadero, no felicites ni digas que va bien: di lo que pasó con respeto y pide la acción concreta.',
    '5. Lo que el contexto marca como ilegible o calcado se dice claro: por qué ese dato no sirve y qué tiene que hacer para que sirva.',
    '6. No traduzcas la jerga del plan (MEV, MAV, MRV, MTO, RIR, RPE) a «más» o «menos»: «MAV bajo» no es «menos volumen».',
    '   Si hace falta nombrarla, di que su plan ajusta la carga de trabajo de esa semana, sin inventar la dirección.',
    '7. Las reglas de su plan que aparecen en el contexto son las VIGENTES: no cites ninguna otra.',
    '8. Un dato «que la app todavía no lee» NO es un dato que la persona no registre: nunca se lo reproches ni le pidas que lo anote.',
    '9. Los números son del MICROCICLO ANTERIOR, ya cerrado: dilos como «el microciclo pasado», nunca como «esta semana».',
    '10. No leas en voz alta las descripciones de los huecos: di la idea con tus palabras y pon solo el hueco donde va la cifra.',
    '11. «Los dos», «las dos» o «las dos cosas» cuentan como cantidad: di «ambos» o «ambas».',
    '12. No nombres un microciclo por su número: di «el microciclo pasado», «este microciclo» o «el siguiente».',
    '13. Como mucho OCHO cifras en toda la revisión: elige las que de verdad importan y el resto dilo sin cantidad («casi todas», «muy poco»).',
    '14. No leas el número de una regla: di lo que manda la regla.',
    '15. Háblale de tú, como se habla en Colombia; nunca «vosotros». No prometas nada que no esté en el contexto (ni fechas, ni que vas a estar).',
    '',
    'Devuelve SOLO un objeto JSON, sin texto alrededor, con estas cinco claves en este orden:',
    '  "semana": lo más importante que pasó esta semana (qué estás haciendo);',
    '  "recordar": lo que se le está olvidando de su propio plan;',
    '  "plan": a qué se está acercando y qué lo está sacando de su plan estratégico;',
    '  "cambiar": qué vamos a hacer la semana que viene y a qué tiene que darle respuesta;',
    '  "progresion": cómo va su tasa de progresión frente a su adherencia al plan.',
    `El texto completo, con las cifras ya puestas, tiene que medir entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres (entre dos y tres minutos hablando).`,
    'Empieza la sección «semana» saludando por su nombre con {nombre}. Cierra «progresion» con una frase de despedida breve.',
  ].join('\n')
}

/**
 * El contexto de la ficha SIN UNA CIFRA a la vista: los microciclos en palabras y cada número
 * convertido en un hueco con su valor (`src/domain/redaccion/contexto.ts`). Devuelve las líneas
 * que lee el modelo y los huecos nuevos, que `revisarBorrador` tiene que conocer.
 */
export function contextoDeLaFicha(ficha, contextoCoach = '') {
  const activo = ficha.microciclo_activo ?? null
  const huecos = {}
  const limpio = (texto, prefijo, significa) => {
    const r = contextoSinCifras(String(texto), prefijo, significa, activo)
    Object.assign(huecos, r.huecos)
    return r.texto
  }
  const plan = ficha.plan || {}
  const lineas = [
    `  métrica principal de su plan: ${plan.metrica_principal ? limpio(plan.metrica_principal, 'metrica', 'cifra de la métrica principal de su plan') : 'su plan no la declara'}`,
    `  fila de su plan para esta semana: ${plan.fila_vigente ? limpio(plan.fila_vigente, 'plan_esta_semana', 'cifra de lo que pide su plan para esta semana') : 'no hay'}`,
    `  fila de su plan para la semana que viene: ${plan.fila_siguiente ? limpio(plan.fila_siguiente, 'plan_proxima_semana', 'cifra de lo que pide su plan para la semana que viene') : 'su plan no tiene fila: se le acaba el plan'}`,
    ...(plan.reglas || []).map((r, i) => `  regla vigente de su plan: ${limpio(r, `regla_${i + 1}`, 'cifra de una regla vigente de su plan')}`),
    ...(ficha.ejes || []).map((e) => `  eje ${e.eje}: ${e.estado}${e.motivo ? ` · ${limpio(e.motivo, `motivo_${e.eje}`, `cifra del motivo del eje ${e.eje}`)}` : ''}`),
    ...(ficha.avisos || []).map((a, i) => `  aviso: ${limpio(a, `aviso_${i + 1}`, 'cifra de un aviso de la ficha')}`),
  ]
  const coach = contextoCoach ? limpio(contextoCoach.trim(), 'coach', 'cifra de lo que escribió el coach') : ''
  return { lineas, huecos, coach }
}

export function mensaje(ficha, huecos, semanaMala, contexto, ejemplos, problemas) {
  const lineas = [
    `semana_mala: ${semanaMala}`,
    '',
    'HUECOS (lo único que puedes nombrar con cantidades):',
    ...Object.entries(huecos).map(([k, h]) => `  {${k}} = ${h.valor === undefined ? 'SIN DATO' : 'con dato'} · ${h.significa}`),
    '',
    'CONTEXTO (para entender; las cantidades ya están en sus huecos):',
    ...contexto.lineas,
  ]
  if (contexto.coach) lineas.push('', 'MÁS CONTEXTO DEL COACH:', contexto.coach)
  // Los ejemplos son solo de TONO: sus cifras no son de esta persona, así que ni se muestran
  // ni se convierten en huecos que el modelo pudiera citar.
  if (ejemplos) {
    lineas.push('', 'ASÍ LE HABLA BRYAN (copia el tono, no el contenido):', microciclosEnPalabras(ejemplos.trim(), null).replace(/\d+(?:[.,]\d+)?/g, '…'))
  }
  if (problemas?.length) {
    lineas.push('', 'TU BORRADOR ANTERIOR NO PASÓ. Corrige exactamente esto y devuelve el JSON entero otra vez:')
    for (const p of problemas) lineas.push(`  - ${p}`)
  }
  return lineas.join('\n')
}

function llamarAlModelo(sistemaTexto, mensajeTexto, modelo, carpetaTemporal) {
  const bin = process.env.CLAUDE_BIN || (process.platform === 'win32' ? 'claude.exe' : 'claude')
  const r = spawnSync(
    bin,
    ['-p', '--model', modelo, '--output-format', 'json', '--tools', '', '--strict-mcp-config',
      '--no-session-persistence', '--system-prompt', sistemaTexto],
    { input: mensajeTexto, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 10 * 60 * 1000, cwd: carpetaTemporal },
  )
  if (r.error) throw new Error(`no se pudo lanzar el modelo (${bin}): ${r.error.message}`)
  if (r.status !== 0) throw new Error(`el modelo salió con código ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 400)}`)
  const salida = JSON.parse(r.stdout)
  const bruto = String(salida.result ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  let borrador
  try {
    borrador = JSON.parse(bruto)
  } catch {
    borrador = {}
  }
  return { borrador, coste: Number(salida.total_cost_usd || 0), bruto }
}

/**
 * Redacta la revisión larga de una ficha. Nunca lanza por un borrador malo: devuelve
 * `entregada: false` con los problemas de cada intento, y quien llama decide qué sale.
 */
export function redactarUna(ficha, { contexto = '', ejemplos = '', modelo = 'sonnet', carpetaTemporal = '.', log = console.log } = {}) {
  const contextoLimpio = contextoDeLaFicha(ficha, contexto)
  const huecos = { ...contextoLimpio.huecos, ...huecosDeLaFicha(ficha) }
  const semanaMala = esSemanaMala(ficha.ejes || [], ficha.avisos || [])
  const sistemaTexto = sistema()
  const intentos = []
  let problemas = []
  let final = null

  for (let n = 1; n <= INTENTOS; n++) {
    const { borrador, coste, bruto } = llamarAlModelo(
      sistemaTexto, mensaje(ficha, huecos, semanaMala, contextoLimpio, ejemplos, problemas), modelo, carpetaTemporal,
    )
    const revision = revisarBorrador(borrador, huecos, { semanaMala })
    if (!Object.keys(borrador).length) revision.problemas.unshift('la respuesta no era un JSON con las cinco secciones')
    intentos.push({ intento: n, coste, problemas: revision.problemas, caracteres: revision.caracteres ?? null, bruto })
    log(`  intento ${n}: ${revision.ok ? 'PASA' : `NO PASA (${revision.problemas.length})`} · ${coste.toFixed(4)} USD`)
    for (const p of revision.problemas) log(`     - ${p}`)
    if (revision.ok) {
      final = { borrador, texto: revision.texto, caracteres: revision.caracteres }
      break
    }
    problemas = revision.problemas
  }

  return {
    persona: ficha.nombre,
    usuarioId: ficha.usuario_id,
    semanaMala,
    huecos,
    intentos,
    costeTotalUsd: Number(intentos.reduce((s, i) => s + i.coste, 0).toFixed(4)),
    entregada: Boolean(final),
    ...(final || {}),
  }
}

export function slugDe(nombre) {
  return String(nombre)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
