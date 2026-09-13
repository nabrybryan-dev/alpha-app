/**
 * EL PASO 1.5 DE LA REVISIÓN SEMANAL: la versión LARGA para las personas elegidas.
 *
 *     npm run revision-larga -- --semana 2026-09-14 --personas-archivo %USERPROFILE%\.alpha\revision-larga.txt
 *     npm run revision-larga -- --semana 2026-09-14 --personas "Valentina Cruz;Otra Persona"
 *
 * Lo ya redactado esa semana (`larga/<persona>.redaccion.json` entregado) se REUTILIZA sin
 * volver a llamar al modelo; `--rehacer` lo redacta otra vez.
 *
 * Va DESPUÉS de `revision-semanal --paso guiones` (que deja el manifiesto con la revisión corta
 * de todos) y ANTES de la voz. Por cada persona elegida:
 *
 *   1. pide a la base el export de la tasa (`rpc tasa_contra_el_plan_export`, migración 0073);
 *   2. calcula las fichas con `agentes/tasa_contra_el_plan.py` (cerebro-alpha-agentes), que
 *      lee el plan estratégico de cada uno del wiki;
 *   3. redacta la larga (`lib/redactar-una-revision.mjs`: huecos, modelo, revisión, reintentos);
 *   4. si PASA, cambia su guion en el manifiesto y en su `.txt`, y lo marca `redaccion: 'larga'`;
 *      si NO pasa, la deja con la corta y lo marca `redaccion: 'corta'` con el motivo.
 *
 * UN FALLO AQUÍ NUNCA DEJA A NADIE SIN REVISIÓN: la corta ya estaba escrita. Por eso este
 * paso sale con código 0 aunque no se entregue ninguna larga, y solo sale con 1 si no pudo
 * ni leer el manifiesto (entonces la tubería tampoco tendría qué narrar).
 *
 * La voz (paso 2) ya rehace el audio cuando el guion cambia: guarda junto a cada mp3 el
 * texto con el que se hizo y lo compara.
 */

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { CARACTERES_POR_SEGUNDO } from '../src/domain/redaccion/huecos.ts'
import { redactarUna, slugDe } from './lib/redactar-una-revision.mjs'

const MANIFIESTO = 'manifiesto.json'
const CEREBRO_POR_DEFECTO = 'C:\\Users\\ASUS\\dev\\cerebro-alpha-tasa'

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

async function leerJsonSiExiste(ruta) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'))
  } catch {
    return null
  }
}

/** El lunes de la semana de cualquier fecha, como hace `revision-semanal`. */
function lunesDe(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  const atras = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - atras)
  return d.toISOString().slice(0, 10)
}

async function personasElegidas(args) {
  let texto = ''
  if (args.personas) texto = String(args.personas).replace(/;/g, '\n')
  else if (args['personas-archivo']) texto = await readFile(args['personas-archivo'], 'utf8')
  return [...new Set(texto.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean))]
}

async function main() {
  const args = argumentos()
  if (!args.semana) {
    console.error('Falta --semana <AAAA-MM-DD>.')
    process.exit(2)
  }
  const semana = lunesDe(String(args.semana))
  const carpeta = resolve(args.carpeta || join('salidas', `revision-${semana}`))
  const cerebro = resolve(args.cerebro || process.env.CEREBRO_TASA || CEREBRO_POR_DEFECTO)
  const python = args.python || (process.platform === 'win32' ? 'py' : 'python3')

  let manifiesto
  try {
    manifiesto = JSON.parse(await readFile(join(carpeta, MANIFIESTO), 'utf8'))
  } catch {
    console.error(`No hay manifiesto en ${carpeta}. Este paso va DESPUÉS de «revision-semanal --paso guiones».`)
    process.exit(1)
  }

  const elegidas = await personasElegidas(args)
  if (!elegidas.length) {
    console.log('Nadie elegido para la revisión larga esta semana: todos salen con la corta.')
    return
  }

  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_KEY
  if (!args.export && (!url || !clave)) {
    console.log('Sin SUPABASE_URL o SUPABASE_SERVICE_KEY no hay tasa: todos salen con la corta.')
    return
  }

  const trabajo = join(carpeta, 'larga')
  await mkdir(trabajo, { recursive: true })

  // 1. el export. `--export <archivo>` usa uno ya guardado: sirve para ENSAYAR la tanda sin
  //    tocar la base, y para repetir una noche con los mismos números con los que se hizo.
  let exportTasa
  if (args.export) {
    exportTasa = JSON.parse(await readFile(String(args.export), 'utf8'))
    console.log(`Export de la tasa leído de ${args.export} (no se consulta la base).`)
  } else {
    const sb = createClient(url, clave, { auth: { persistSession: false } })
    const { data, error } = await sb.rpc('tasa_contra_el_plan_export')
    if (error || !data?.personas?.length) {
      console.log(`No llegó el export de la tasa (${error?.message || 'vacío'}): todos salen con la corta.`)
      return
    }
    exportTasa = data
  }
  const rutaExport = join(trabajo, 'export-tasa.json')
  await writeFile(rutaExport, JSON.stringify(exportTasa), 'utf8')

  // 2. las fichas
  const rutaFichas = join(trabajo, 'fichas.json')
  const pieza = join(cerebro, 'agentes', 'tasa_contra_el_plan.py')
  const r = spawnSync(python, [pieza, rutaExport, rutaFichas], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.status !== 0) {
    console.log(`La pieza de la tasa falló (${pieza}, código ${r.status}): todos salen con la corta.`)
    console.log((r.stderr || '').slice(0, 800))
    return
  }
  const { fichas } = JSON.parse(await readFile(rutaFichas, 'utf8'))

  // 3 y 4. redactar y cambiar el guion
  const resumen = { larga: [], corta: [] }
  let coste = 0
  for (const nombre of elegidas) {
    const encargo = manifiesto.encargos.find((e) => e.nombre === nombre)
    const ficha = fichas.find((f) => f.nombre === nombre)
    if (!encargo || !ficha) {
      const motivo = !encargo ? 'no está en la tanda de esta semana' : 'no tiene ficha de tasa'
      console.log(`${nombre}: ${motivo} → corta`)
      resumen.corta.push(`${nombre} (${motivo})`)
      if (encargo) Object.assign(encargo, { redaccion: 'corta', motivoCorta: motivo })
      continue
    }
    console.log(`${nombre}:`)
    // REUTILIZAR LO YA REDACTADO (decisión de Bryan del 12-sep: adelantar las largas antes del
    // jueves). Si esta semana ya tiene su redacción entregada, no se le vuelve a pedir al modelo:
    // un texto nuevo cambiaría el guion, y la voz se grabaría otra vez desde cero, que es justo
    // lo que se adelantó. `--rehacer` fuerza a redactar de nuevo.
    const rutaInforme = join(trabajo, `${slugDe(nombre)}.redaccion.json`)
    const previo = args.rehacer ? null : await leerJsonSiExiste(rutaInforme)
    let informe
    if (previo?.entregada && previo.texto) {
      informe = { ...previo, costeTotalUsd: 0 }
      console.log(`  reutilizada: ya estaba redactada (${previo.caracteres} caracteres)`)
    } else {
      try {
        informe = redactarUna(ficha, { carpetaTemporal: trabajo })
      } catch (e) {
        informe = { entregada: false, intentos: [], costeTotalUsd: 0, error: String(e.message || e) }
        console.log(`  el modelo no respondió: ${informe.error}`)
      }
      await writeFile(rutaInforme, `${JSON.stringify(informe, null, 2)}\n`, 'utf8')
    }
    coste += informe.costeTotalUsd || 0
    if (informe.entregada) {
      // Solo la primera vez: si esta tanda ya pasó por aquí, `guion` YA es la larga y copiarla
      // dejaría la corta perdida.
      if (encargo.redaccion !== 'larga') encargo.guionCorto = encargo.guion
      encargo.guion = informe.texto
      encargo.redaccion = 'larga'
      await writeFile(join(carpeta, encargo.archivoGuion), `${informe.texto}\n`, 'utf8')
      resumen.larga.push(nombre)
      console.log(`  → LARGA · ${informe.caracteres} caracteres · ~${Math.round(informe.caracteres / CARACTERES_POR_SEGUNDO)} s`)
    } else {
      Object.assign(encargo, { redaccion: 'corta', motivoCorta: 'la redacción no pasó la revisión' })
      resumen.corta.push(`${nombre} (no pasó la revisión)`)
      console.log('  → corta (no pasó la revisión)')
    }
  }

  manifiesto.revisionLarga = { generada: new Date().toISOString(), costeUsd: Number(coste.toFixed(4)), ...resumen }
  await writeFile(join(carpeta, MANIFIESTO), `${JSON.stringify(manifiesto, null, 2)}\n`, 'utf8')

  // Lo que se lee en el registro del viernes: una tanda sin ninguna larga y una con todas
  // tienen que leerse distinto (la lección del #281 con las caras).
  console.log(
    `\nRevisión larga · semana del ${semana} · larga: ${resumen.larga.length} · corta: ${resumen.corta.length} · ${coste.toFixed(2)} USD`,
  )
  for (const c of resumen.corta) console.log(`  corta: ${c}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
