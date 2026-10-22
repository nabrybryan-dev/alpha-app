/**
 * EL PASO 2 DE LA REVISIÓN SEMANAL: la voz clonada de Bryan, una persona por proceso.
 *
 *     npm run generar-voces -- --carpeta salidas/revision-2026-10-19
 *
 * Lee el `manifiesto.json` del paso 1 (y del 1.6) y deja `<usuarioId>.mp3` junto a él, que es el
 * nombre que el paso 3 busca. La voz es la de alpha-estudio (`estudio.voz`, molde
 * `config.MOLDE_OFICIAL`): ver `lib/voz-por-persona.mjs` para el porqué de cada decisión.
 *
 * Opciones:
 *   --carpeta <ruta>     la carpeta de la tanda. Obligatoria.
 *   --estudio <ruta>     alpha-estudio. Por defecto C:\Users\ASUS\dev\alpha-estudio (o ALPHA_ESTUDIO).
 *   --molde <ruta>       el .wav de referencia. Por defecto, el `MOLDE_OFICIAL` de alpha-estudio.
 *   --persona <uuid>     hacer solo a esa persona.
 *
 * Sale con 0 si todas las que tocaban tienen audio y con 1 si alguna no (o si falta algo para
 * empezar). NO publica ni toca la base.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { codigoDeSalidaDeLasVoces, generarVocesDeLaTanda } from './lib/voz-por-persona.mjs'

const ESTUDIO_POR_DEFECTO = 'C:\\Users\\ASUS\\dev\\alpha-estudio'
/** Una persona tardó 8,7 min con el PC apretado de memoria; 40 min es «se colgó», no «va lento». */
const TOPE_POR_PROCESO_MS = 40 * 60 * 1000

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

function pythonDelEstudio(estudio) {
  return join(estudio, '.venv', 'Scripts', 'python.exe')
}

/** `python -B -c ...` en alpha-estudio; texto de salida o `null` si falla. */
function pythonEnElEstudio(estudio, codigo) {
  const r = spawnSync(pythonDelEstudio(estudio), ['-B', '-c', codigo], {
    cwd: estudio,
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  return r.status === 0 ? r.stdout.trim() : null
}

function ioReal(estudio) {
  return {
    // Un proceso por persona. `-B`: no deja `__pycache__` en alpha-estudio (solo se invoca, no se toca).
    correrVoz(rutaEncargo, cwd) {
      return new Promise((resolver) => {
        const hijo = spawn(pythonDelEstudio(estudio), ['-B', '-m', 'estudio.voz', rutaEncargo], {
          cwd,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          stdio: ['ignore', 'inherit', 'inherit'],
        })
        const reloj = setTimeout(() => hijo.kill(), TOPE_POR_PROCESO_MS)
        hijo.on('error', (e) => {
          clearTimeout(reloj)
          resolver({ codigo: null, error: e.message })
        })
        hijo.on('close', (codigo, senal) => {
          clearTimeout(reloj)
          resolver({ codigo, error: senal ? `terminó por la señal ${senal}` : undefined })
        })
      })
    },
    // 120 ms de silencio ANTES de la primera palabra. Se reescribe el mp3 a calidad alta (q2) para
    // que la segunda generación con pérdida no se note.
    anteponerSilencio(entrada, salida, ms) {
      const r = spawnSync(
        'ffmpeg',
        ['-hide_banner', '-loglevel', 'error', '-y', '-i', entrada, '-af', `adelay=${ms}:all=1`, '-codec:a', 'libmp3lame', '-qscale:a', '2', salida],
        { encoding: 'utf8' },
      )
      if (r.status !== 0) throw new Error(`ffmpeg no pudo anteponer el silencio: ${(r.stderr || r.error?.message || '').slice(0, 300)}`)
      return Promise.resolve()
    },
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  }
}

async function main() {
  const args = argumentos()
  if (!args.carpeta || args.carpeta === true) {
    console.error('Falta --carpeta <ruta de la tanda>. Ver la cabecera de este archivo.')
    process.exit(1)
  }
  const carpeta = resolve(process.cwd(), String(args.carpeta))
  const estudio = resolve(String(args.estudio || process.env.ALPHA_ESTUDIO || ESTUDIO_POR_DEFECTO))

  let manifiesto
  try {
    manifiesto = JSON.parse(await readFile(join(carpeta, 'manifiesto.json'), 'utf8'))
  } catch {
    console.error(`No hay manifiesto en ${carpeta}. Lo escribe el paso 1 (revision-semanal --paso guiones).`)
    process.exit(1)
  }

  if (!existsSync(pythonDelEstudio(estudio))) {
    console.error(`PARO: no está el Python de la voz en ${pythonDelEstudio(estudio)}.`)
    process.exit(1)
  }
  // La marca de agua (`perth`) se carga en silencio si falta `pkg_resources`: saldría audio sin
  // marca y nadie se enteraría. Se comprueba antes de gastar una hora de máquina. Se arregla con:
  //   pip install "setuptools<82"
  if (pythonEnElEstudio(estudio, 'import pkg_resources') === null) {
    console.error('PARO: falta `pkg_resources` en el Python de la voz: el audio saldría SIN marca de agua.')
    console.error('Se arregla con:  pip install "setuptools<82"')
    process.exit(1)
  }
  const molde = String(args.molde || pythonEnElEstudio(estudio, 'from estudio.config import MOLDE_OFICIAL; print(MOLDE_OFICIAL)') || '')
  if (!molde || !existsSync(molde)) {
    console.error(`PARO: no encuentro el molde de voz (${molde || 'alpha-estudio no dijo cuál'}).`)
    process.exit(1)
  }

  const resumen = await generarVocesDeLaTanda({
    carpeta,
    manifiesto,
    molde,
    estudio,
    io: ioReal(estudio),
    soloUno: typeof args.persona === 'string' ? args.persona : undefined,
  })
  process.exit(codigoDeSalidaDeLasVoces(resumen))
}

main().catch((e) => {
  console.error(e.stack || e.message || e)
  process.exit(1)
})
