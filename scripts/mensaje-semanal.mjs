/**
 * EL PASO 1.6 DE LA REVISIÓN SEMANAL: el agente LOCAL escribe el mensaje de cada persona.
 *
 *     npm run mensaje-semanal -- --semana 2026-10-19
 *
 * Va DESPUÉS de `revision-semanal --paso guiones` (que deja el manifiesto con la plantilla de
 * todos) y ANTES de la voz. Sustituye al antiguo paso 1.5 «revisión larga», que mandaba la ficha de
 * la tasa de cada persona a un modelo externo. DECISIÓN DE BRYAN, 22-oct: «Todo en el PC». El
 * agente es `cerebro-alpha-agentes/agentes/mensaje_semanal.py`: Python local, sin modelo y sin red.
 *
 *   1. (opcional, con clave de servicio) trae las órdenes `detener` y la tasa contra el plan. La
 *      tasa se calcula con `agentes/tasa_contra_el_plan.py`, también local;
 *   2. escribe `mensaje-semanal/entrada.json` (contrato del agente, ver `lib/mensaje-semanal.mjs`);
 *   3. corre el agente y lee `mensaje-semanal/salida.json`;
 *   4. reescribe el guion de cada persona en el manifiesto y en su `.txt`. El que el agente marca
 *      `publicar` es el único que luego puede firmarse solo.
 *
 * UN FALLO AQUÍ NUNCA DEJA A NADIE SIN REVISIÓN: si el agente no está o no responde, se queda la
 * plantilla de `guion.ts` en todos, no se firma nada y se avisa a Bryan. Por eso sale con 0 aunque
 * el agente falle, y solo sale con 1 si no puede ni leer el manifiesto.
 *
 * Opciones:
 *   --semana <AAAA-MM-DD>  la semana (se guarda por su lunes). Obligatoria.
 *   --carpeta <ruta>       la carpeta de la tanda. Por defecto `salidas/revision-<semana>`.
 *   --cerebro <ruta>       cerebro-alpha-agentes. Por defecto C:\Users\ASUS\dev\cerebro-alpha-agentes.
 *   --python <orden>       el intérprete (`py` en Windows).
 *   --roster <archivo>     usuario_id -> slug. Por defecto %USERPROFILE%\.alpha\roster.json si existe.
 *   --sin-base             no consulta la base (ni órdenes ni tasa).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { lunesDeLaSemana } from '../src/domain/resumenSemanal/reparto.ts'
import { avisarABryan } from './lib/aviso-a-bryan.mjs'
import { aplicarSalidaDelAgente, armarEntradaDelAgente, marcarSinAgente, personasConRiesgo } from './lib/mensaje-semanal.mjs'

const MANIFIESTO = 'manifiesto.json'
const CEREBRO_POR_DEFECTO = 'C:\\Users\\ASUS\\dev\\cerebro-alpha-agentes'

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

async function leerJson(ruta) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'))
  } catch {
    return null
  }
}

function correrPython(python, argumentosDelScript) {
  return spawnSync(python, argumentosDelScript, {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 50 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  })
}

/** Órdenes `detener`/`reanudar`/`reportar_riesgo` de la consola. Sin clave o con error: lista vacía (la base de datos vuelve a mirarlas al firmar). */
async function traerOrdenes(sb) {
  if (!sb) return []
  const { data, error } = await sb.from('ordenes').select('tipo, objetivo, creada_en').in('tipo', ['detener', 'reanudar', 'reportar_riesgo'])
  if (error) {
    console.log(`AVISO: no pude leer las órdenes de la consola (${error.message}). Sigo sin ellas: la base las vuelve a mirar al firmar.`)
    return []
  }
  return data ?? []
}

/** Las fichas de la tasa contra el plan, calculadas aquí mismo. Cualquier fallo = sin tasa. */
async function traerFichas({ sb, args, cerebro, python, trabajo }) {
  try {
    let exportTasa
    if (args.export) {
      exportTasa = JSON.parse(await readFile(String(args.export), 'utf8'))
    } else if (sb) {
      const { data, error } = await sb.rpc('tasa_contra_el_plan_export')
      if (error || !data?.personas?.length) {
        console.log(`No llegó el export de la tasa (${error?.message || 'vacío'}): los mensajes salen sin la frase de tasa.`)
        return []
      }
      exportTasa = data
    } else {
      return []
    }
    const rutaExport = join(trabajo, 'export-tasa.json')
    const rutaFichas = join(trabajo, 'fichas.json')
    await writeFile(rutaExport, JSON.stringify(exportTasa), 'utf8')
    const pieza = join(cerebro, 'agentes', 'tasa_contra_el_plan.py')
    const r = correrPython(python, [pieza, rutaExport, rutaFichas])
    if (r.status !== 0) {
      console.log(`La pieza de la tasa falló (código ${r.status}): los mensajes salen sin la frase de tasa.`)
      return []
    }
    return (await readFile(rutaFichas, 'utf8').then(JSON.parse)).fichas ?? []
  } catch (e) {
    console.log(`No pude preparar la tasa (${e.message}): los mensajes salen sin la frase de tasa.`)
    return []
  }
}

async function sinAgente({ semana, carpeta, manifiesto, motivo }) {
  console.log(`EL AGENTE NO RESPONDIÓ: ${motivo}`)
  console.log('Todos salen con la plantilla de siempre y NO se firma nada automáticamente.')
  const nuevo = marcarSinAgente(manifiesto, motivo)
  await writeFile(join(carpeta, MANIFIESTO), `${JSON.stringify(nuevo, null, 2)}\n`, 'utf8')
  await avisarABryan({
    id: `mensaje-semanal-${semana}-agente-ausente`,
    tipo: 'mensaje_semanal_agente_ausente',
    mensaje: `Semana del ${semana}: el agente de mensajes no respondió (${motivo}). Salió la plantilla y NADA se firma solo.`,
  })
}

async function main() {
  const args = argumentos()
  if (!args.semana || args.semana === true) {
    console.error('Falta --semana <AAAA-MM-DD>.')
    process.exit(2)
  }
  const semana = lunesDeLaSemana(String(args.semana))
  const carpeta = resolve(process.cwd(), String(args.carpeta || join('salidas', `revision-${semana}`)))
  const cerebro = resolve(String(args.cerebro || process.env.CEREBRO_ALPHA || CEREBRO_POR_DEFECTO))
  const python = String(args.python || (process.platform === 'win32' ? 'py' : 'python3'))

  const manifiesto = await leerJson(join(carpeta, MANIFIESTO))
  if (!manifiesto) {
    console.error(`No hay manifiesto en ${carpeta}. Este paso va DESPUÉS de «revision-semanal --paso guiones».`)
    process.exit(1)
  }
  if (manifiesto.semana !== semana) {
    console.error(`El manifiesto es de la semana del ${manifiesto.semana} y se pidió la del ${semana}.`)
    process.exit(1)
  }

  const trabajo = join(carpeta, 'mensaje-semanal')
  await mkdir(trabajo, { recursive: true })

  const agente = join(cerebro, 'agentes', 'mensaje_semanal.py')
  if (!existsSync(agente)) {
    await sinAgente({ semana, carpeta, manifiesto, motivo: `no existe ${agente}` })
    return
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  const sb = !args['sin-base'] && SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    : null
  if (!sb) console.log('Sin base (o --sin-base): sin órdenes de detener y sin tasa. Los mensajes salen con lo que trae el manifiesto.')

  const rutaRoster = String(args.roster || join(homedir(), '.alpha', 'roster.json'))
  const rosterCrudo = existsSync(rutaRoster) ? await leerJson(rutaRoster) : null
  const roster = Array.isArray(rosterCrudo) ? rosterCrudo : (rosterCrudo?.personas ?? [])
  if (!roster.length) console.log(`Sin roster (${rutaRoster}): ningún mensaje lleva objetivo del plan hasta que exista.`)

  const ordenes = await traerOrdenes(sb)
  const fichas = await traerFichas({ sb, args, cerebro, python, trabajo })

  const entrada = armarEntradaDelAgente({ manifiesto, fichas, roster, ordenes })
  const rutaEntrada = join(trabajo, 'entrada.json')
  const rutaSalida = join(trabajo, 'salida.json')
  await writeFile(rutaEntrada, `${JSON.stringify(entrada, null, 2)}\n`, 'utf8')

  const r = correrPython(python, [agente, rutaEntrada, '--salida', rutaSalida])
  if (r.status !== 0) {
    await sinAgente({ semana, carpeta, manifiesto, motivo: `el agente salió con código ${r.status}: ${(r.stderr || r.error?.message || '').slice(0, 300)}` })
    return
  }
  const salida = await leerJson(rutaSalida)
  if (!salida || !Array.isArray(salida.mensajes)) {
    await sinAgente({ semana, carpeta, manifiesto, motivo: 'la salida del agente no es un JSON con «mensajes»' })
    return
  }

  // Un riesgo reportado en la consola frena el audio AUTOMÁTICO de esa persona (y solo de ella).
  const riesgos = personasConRiesgo(ordenes, semana)
  if (riesgos.size) console.log(`Riesgo reportado en la consola: ${riesgos.size} persona(s) no se firman solas (quedan en la bandeja del coach).`)
  const aplicado = aplicarSalidaDelAgente({ manifiesto, salida, riesgos })
  for (const t of aplicado.textos) await writeFile(join(carpeta, t.archivoGuion), `${t.texto}\n`, 'utf8')
  await writeFile(join(carpeta, MANIFIESTO), `${JSON.stringify(aplicado.manifiesto, null, 2)}\n`, 'utf8')
  for (const a of aplicado.avisos) await avisarABryan(a)

  const { resumen } = aplicado
  console.log(
    `Mensaje semanal · semana del ${semana} · publicar: ${resumen.publicar} · bandeja del coach: ${resumen.bandeja_humana} · ` +
      `omitidos: ${resumen.omitir} · sin respuesta (plantilla): ${resumen.sin_respuesta}`,
  )
  for (const e of aplicado.manifiesto.encargos) {
    if (e.mensaje?.estado && e.mensaje.estado !== 'publicar') {
      console.log(`  ${e.nombre || e.usuarioId}: ${e.mensaje.estado}${e.mensaje.motivo ? ` (${e.mensaje.motivo})` : ''}`)
    }
  }
  if (aplicado.ignorados.length) console.log(`  AVISO: el agente devolvió ${aplicado.ignorados.length} persona(s) que no están en la tanda: se ignoran.`)
}

main().catch((e) => {
  console.error(e.stack || e.message || e)
  process.exit(1)
})
