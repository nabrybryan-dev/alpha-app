/**
 * La revisión LARGA de UNA persona, para probar: el modelo redacta con huecos y la plantilla
 * pone las cifras.
 *
 *     npm run redactar-revision -- --fichas <fichas.json> --persona "Dhanny Agudelo" \
 *        [--contexto <archivo.txt>] [--ejemplos <archivo.txt>] [--salida <carpeta>] [--modelo sonnet]
 *
 * `fichas.json` es la salida de `agentes/tasa_contra_el_plan.py` (cerebro-alpha-agentes).
 * El trabajo de verdad vive en `scripts/lib/redactar-una-revision.mjs`, que es lo mismo que
 * usa la tanda de la noche (`scripts/revision-larga.mjs`).
 *
 * NUNCA PUBLICA NI APRUEBA: escribe `<salida>/<slug>.redaccion.json` y el texto por pantalla.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { INTENTOS, redactarUna, slugDe } from './lib/redactar-una-revision.mjs'

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
  const salida = args.salida || '.'
  await mkdir(salida, { recursive: true })

  const informe = redactarUna(ficha, {
    contexto: args.contexto ? await readFile(args.contexto, 'utf8') : '',
    ejemplos: args.ejemplos ? await readFile(args.ejemplos, 'utf8') : '',
    modelo: args.modelo || 'sonnet',
    carpetaTemporal: salida,
  })
  await writeFile(join(salida, `${slugDe(ficha.nombre)}.redaccion.json`), `${JSON.stringify(informe, null, 2)}\n`, 'utf8')

  if (!informe.entregada) {
    console.log(`\nNO SE ENTREGA: ${INTENTOS} intentos sin pasar. Esta persona sale con la revisión corta.`)
    process.exit(1)
  }
  console.log(`\n${ficha.nombre} · ${informe.caracteres} caracteres · ~${Math.round(informe.caracteres / 14)} s · ${informe.costeTotalUsd} USD\n`)
  console.log(informe.texto)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
