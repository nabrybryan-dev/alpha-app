/**
 * La revisión LARGA de una persona: el modelo redacta con huecos, la plantilla pone las cifras.
 *
 *     npm run redactar-revision -- --fichas <fichas.json> --persona "Dhanny Agudelo" \
 *        [--contexto <archivo.txt>] [--ejemplos <archivo.txt>] [--salida <carpeta>] [--modelo sonnet]
 *
 * `fichas.json` es la salida de `agentes/tasa_contra_el_plan.py` (cerebro-alpha-agentes): la
 * tasa de progresión contra el plan de cada persona, con lo que se midió y lo que no.
 *
 * QUÉ HACE, en orden:
 *   1. convierte la ficha en HUECOS con su valor ya dicho en voz alta («7,4 por ciento»), y
 *      los ejes sin dato en huecos SIN valor, que el modelo tiene prohibido usar;
 *   2. le pide al modelo las cinco secciones que dictó Bryan, sin una sola cifra;
 *   3. `revisarBorrador` (src/domain/redaccion/huecos.ts) lo comprueba y pone las cifras;
 *   4. si no pasa, se lo devuelve CON LOS PROBLEMAS, hasta dos veces más;
 *   5. a la tercera no se entrega: se dice, y el viernes sale la revisión corta de siempre.
 *
 * EL MODELO SE LLAMA SIN HERRAMIENTAS (`--tools ""`) y con un system prompt propio: aquí solo
 * redacta. El mensaje va por la entrada estándar y no por la línea de órdenes, porque en
 * Windows `claude.cmd` pasa por cmd.exe y un texto de varias líneas con comillas se rompe ahí.
 *
 * NUNCA PUBLICA NI APRUEBA: escribe `<salida>/<slug>.redaccion.json` y el texto por pantalla.
 */

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { esSemanaMala, LARGO_MAXIMO, LARGO_MINIMO, revisarBorrador, SECCIONES } from '../src/domain/redaccion/huecos.ts'

const INTENTOS = 3

function argumentos() {
  const args = {}
  const lista = process.argv.slice(2)
  for (let i = 0; i < lista.length; i++) {
    const trozo = lista[i]
    if (!trozo.startsWith('--')) continue
    const [clave, enLinea] = trozo.slice(2).split('=')
    if (enLinea !== undefined) args[clave] = enLinea
    else if (lista[i + 1] !== undefined && !lista[i + 1].startsWith('--')) args[clave] = lista[++i]
    else args[clave] = true
  }
  return args
}

const hablado = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

/** La ficha de la tasa convertida en lo único que el modelo puede nombrar. */
export function huecosDeLaFicha(ficha) {
  const huecos = {
    nombre: { valor: (ficha.nombre || '').trim().split(/\s+/)[0], significa: 'su nombre de pila' },
  }
  for (const e of ficha.ejes || []) {
    const base = e.eje
    const unidad = e.unidad || ''
    if (e.estado === 'medido' && typeof e.valor === 'number') {
      let valor
      if (base === 'cargas') {
        valor = `${hablado(Math.abs(e.valor))} por ciento ${e.valor < 0 ? 'por debajo' : 'por encima'} del ritmo previsto`
      } else if (unidad.startsWith('%')) valor = `${hablado(e.valor)} por ciento`
      else if (unidad.startsWith('kg/semana')) valor = `${hablado(e.valor)} kilos por semana`
      else if (unidad.startsWith('cm')) valor = `${hablado(e.valor)} centímetros`
      else valor = hablado(e.valor)
      huecos[`${base}_valor`] = { valor, significa: `${unidad} (${e.ventana})${e.dudoso ? ' · DUDOSO: no lo afirmes como hecho' : ''}` }
    } else {
      huecos[`${base}_valor`] = { significa: `${base}: ${String(e.estado).replace(/_/g, ' ')} — SIN DATO, no lo uses` }
    }
    const numeroMeta = typeof e.meta === 'string' ? e.meta.match(/-?\d+(?:[.,]\d+)?/) : null
    if (numeroMeta) {
      const n = Number(numeroMeta[0].replace(',', '.'))
      const dicho = unidad.startsWith('kg') ? `${hablado(n)} kilos por semana` : unidad.startsWith('cm') ? `${hablado(n)} centímetros` : `${hablado(n)} por ciento`
      huecos[`${base}_meta`] = { valor: dicho, significa: `la meta que escribió su plan para ${base}` }
    }
    if (typeof e.desvio_pct === 'number') {
      huecos[`${base}_desvio`] = {
        valor: `${hablado(Math.abs(e.desvio_pct))} por ciento ${e.desvio_pct < 0 ? 'por detrás' : 'por delante'} de su plan`,
        significa: `cuánto se desvía ${base} de lo que su plan preveía`,
      }
    }
  }
  return huecos
}

function sistema() {
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

function mensaje(ficha, huecos, semanaMala, contexto, ejemplos, problemas) {
  const lineas = [
    `semana_mala: ${semanaMala}`,
    '',
    'HUECOS (lo único que puedes nombrar con cantidades):',
    ...Object.entries(huecos).map(([k, h]) => `  {${k}} = ${h.valor === undefined ? 'SIN DATO' : 'con dato'} · ${h.significa}`),
    '',
    'CONTEXTO (para entender; NO copies sus cifras):',
    `  métrica principal de su plan: ${ficha.plan?.metrica_principal || 'su plan no la declara'}`,
    `  fila de su plan para esta semana: ${ficha.plan?.fila_vigente || 'no hay'}`,
    ...(ficha.ejes || []).map((e) => `  eje ${e.eje}: ${e.estado}${e.motivo ? ` · ${e.motivo}` : ''}`),
    ...(ficha.avisos || []).map((a) => `  aviso: ${a}`),
  ]
  if (contexto) lineas.push('', 'MÁS CONTEXTO DEL COACH:', contexto.trim())
  if (ejemplos) lineas.push('', 'ASÍ LE HABLA BRYAN (copia el tono, no el contenido):', ejemplos.trim())
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

async function main() {
  const args = argumentos()
  if (!args.fichas || !args.persona) {
    console.error('uso: redactar-revision --fichas <fichas.json> --persona "<nombre>" [--contexto f] [--ejemplos f] [--salida d]')
    process.exit(2)
  }
  const datos = JSON.parse(await readFile(args.fichas, 'utf8'))
  const ficha = (datos.fichas || []).find((f) => f.nombre === args.persona || f.usuario_id === args.persona)
  if (!ficha) {
    console.error(`No hay ficha para «${args.persona}» en ${args.fichas}.`)
    process.exit(2)
  }
  const contexto = args.contexto ? await readFile(args.contexto, 'utf8') : ''
  const ejemplos = args.ejemplos ? await readFile(args.ejemplos, 'utf8') : ''
  const salida = args.salida || '.'
  const modelo = args.modelo || 'sonnet'
  await mkdir(salida, { recursive: true })

  const huecos = huecosDeLaFicha(ficha)
  const semanaMala = esSemanaMala(ficha.ejes || [], ficha.avisos || [])
  const sistemaTexto = sistema()
  const intentos = []
  let problemas = []
  let final = null

  for (let n = 1; n <= INTENTOS; n++) {
    const { borrador, coste, bruto } = llamarAlModelo(
      sistemaTexto, mensaje(ficha, huecos, semanaMala, contexto, ejemplos, problemas), modelo, salida,
    )
    const revision = revisarBorrador(borrador, huecos, { semanaMala })
    if (!Object.keys(borrador).length) revision.problemas.unshift('la respuesta no era un JSON con las cinco secciones')
    intentos.push({ intento: n, coste, problemas: revision.problemas, caracteres: revision.caracteres ?? null, bruto })
    console.log(`intento ${n}: ${revision.ok ? 'PASA' : `NO PASA (${revision.problemas.length})`} · ${coste.toFixed(4)} USD`)
    for (const p of revision.problemas) console.log(`   - ${p}`)
    if (revision.ok) {
      final = { borrador, texto: revision.texto, caracteres: revision.caracteres }
      break
    }
    problemas = revision.problemas
  }

  const slug = ficha.nombre.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const informe = {
    persona: ficha.nombre,
    usuarioId: ficha.usuario_id,
    semanaMala,
    secciones: SECCIONES,
    huecos,
    intentos,
    costeTotalUsd: Number(intentos.reduce((s, i) => s + i.coste, 0).toFixed(4)),
    entregada: Boolean(final),
    ...(final || {}),
  }
  await writeFile(join(salida, `${slug}.redaccion.json`), `${JSON.stringify(informe, null, 2)}\n`, 'utf8')

  if (!final) {
    console.log(`\nNO SE ENTREGA: ${INTENTOS} intentos sin pasar. Esta persona sale con la revisión corta.`)
    process.exit(1)
  }
  console.log(`\n${ficha.nombre} · ${final.caracteres} caracteres · ~${Math.round(final.caracteres / 14)} s · ${informe.costeTotalUsd} USD\n`)
  console.log(final.texto)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
