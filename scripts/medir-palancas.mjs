/**
 * De un vídeo ya rastreado a la medida que enseña la pantalla, en un comando.
 *
 *     npx vite-node scripts/medir-palancas.mjs -- pista.json 175 \
 *       --categoria "BISAGRA DE CADERA" --nombre "PESO MUERTO RUMANO CON BARRA" \
 *       --salida medida.json
 *
 * ## Qué enchufa esto, exactamente
 *
 * La tubería ya existía entera y le faltaba una pieza en medio. El encoder
 * (`brazo-por-fotograma.mjs`, en el repo de las herramientas) no decide qué eje
 * mirar: lo lee de un `plan.json` que hasta hoy había que **fabricar a mano** o
 * sacar aparte con `exportar-plan.mjs` y acordarse de pasarlo. Es la clase de
 * paso manual que no falla ruidosamente: un plan escrito a ojo para el vídeo
 * equivocado mide el eje equivocado y devuelve un número con la misma cara que
 * uno bueno.
 *
 * Aquí el plan lo pone la tabla. Se le dice qué ejercicio es —la categoría y el
 * nombre, los dos campos que el ejercicio ya lleva en la app
 * (`EjercicioPrescrito`)— y `planExportable` decide el eje que manda, la línea
 * de fuerza, la vista que exige y **qué no se puede prometer**.
 *
 * ## Por qué cruza al otro repo en vez de traerse el cálculo
 *
 * La detección de pose necesita ONNX y ~1 minuto de CPU por vídeo, y el núcleo
 * del encoder vive validado por 56 casos de prueba que aquí no existen. Copiarlo
 * es exactamente lo que ya salió caro dos veces (ver `nucleo/ORIGEN.md`). Así
 * que se pasan datos, no código: aquí sale el plan en JSON, allí se consume, y
 * lo que vuelve es la medida.
 *
 * Lo que este archivo NO hace: no recorta, no redondea y no interpreta. La
 * medida sale tal cual la devuelve el encoder — si dice que la escala es
 * dudosa, sale dudosa.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMO_GRABAR, esPostura, fiabilidadDeEscala, POSTURAS } from '../src/domain/biomecanica/escala.ts'
import { planExportable } from '../src/domain/biomecanica/planExportable.ts'
import { buscarHerramientas, COMO_ENCONTRARLAS } from './herramientasEncoder.mjs'

const USO =
  'Uso: npx vite-node scripts/medir-palancas.mjs -- <pista.json> <altura_cm> ' +
  '--categoria "<CATEGORÍA>" [--nombre "<nombre del ejercicio>"] [--salida <medida.json>] ' +
  '[--postura de-pie-de-lado|de-pie-escorzo|apoyado-a-media-altura|tumbado]'

/** Una opción con valor: `--nombre X`. Devuelve `undefined` si no está. */
function opcion(args, nombre) {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? args[i + 1] : undefined
}

const args = process.argv.slice(2)
const sueltos = []
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) i++ // se salta el valor de la opción
  else sueltos.push(args[i])
}
const [rutaPista, alturaCm] = sueltos

const categoria = opcion(args, 'categoria')
const nombre = opcion(args, 'nombre') ?? ''
const salida = opcion(args, 'salida')
const postura = opcion(args, 'postura')

if (!rutaPista || !alturaCm || !categoria) {
  console.error(USO)
  process.exit(2)
}

/* La postura, ANTES de tocar el vídeo. Es lo único que decide si el ancla de la
 * escala existe, la tabla no puede adivinarla —el mismo empuje se hace tumbado
 * en un banco y de pie en una polea— y un press de banca no da una medida peor:
 * no da ninguna. Decirlo aquí ahorra el minuto de CPU y, sobre todo, evita
 * devolver milímetros que ningún guardián posterior distingue de los buenos. */
if (postura) {
  if (!esPostura(postura)) {
    console.error(`Postura desconocida: «${postura}». Las medidas son: ${POSTURAS.join(', ')}.`)
    process.exit(2)
  }
  const veredicto = fiabilidadDeEscala(postura)
  if (veredicto.nivel === 'imposible') {
    console.error(veredicto.porQue)
    process.exit(1)
  }
  if (veredicto.nivel === 'orientativa') console.error(`⚠ ${veredicto.porQue}
`)
} else {
  /* No se supone `de-pie-de-lado` por defecto: suponer la postura buena es
   * exactamente cómo saldría una medida imposible con cara de medida. */
  console.error(`(sin --postura: nadie ha dicho cómo se grabó. La que se sostiene es ${COMO_GRABAR})
`)
}

/* El plan primero, y antes de tocar el vídeo: si este ejercicio no tiene
 * palanca que medir, no hay nada que rastrear y decirlo cuesta un segundo en
 * vez de un minuto de CPU. */
const plan = planExportable(categoria, nombre, postura)
if (!plan) {
  console.error(
    `«${categoria}» no tiene modelo de palanca, así que no hay nada que medir en este vídeo.\n` +
      'No es un fallo: hay patrones sin palanca a propósito (PREV/REHAB, acondicionamiento, ' +
      'movilidad). Medirlo con el modelo de otro daría un número que no es de este ejercicio.',
  )
  process.exit(1)
}

const herramientas = buscarHerramientas()
if (!herramientas) {
  console.error(`No encuentro el repo de las herramientas del encoder. ${COMO_ENCONTRARLAS}`)
  process.exit(2)
}

/* El plan viaja por archivo y no por argumento porque es lo que el encoder ya
 * sabe leer: `exportar-medida.mjs pista.json plan.json altura`. Cambiar su
 * interfaz para ahorrarse un temporal sería tocar el repo validado para
 * comodidad de éste. */
const carpeta = mkdtempSync(join(tmpdir(), 'alpha-plan-'))
const rutaPlan = join(carpeta, 'plan.json')

try {
  writeFileSync(rutaPlan, JSON.stringify(plan, null, 2), 'utf8')

  const video = opcion(args, 'video') ?? nombre
  const corrida = spawnSync(
    process.execPath,
    [
      join(herramientas, 'exportar-medida.mjs'),
      rutaPista,
      rutaPlan,
      String(alturaCm),
      ...(video ? ['--video', video] : []),
    ],
    { cwd: herramientas, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )

  if (corrida.status !== 0) {
    console.error(corrida.stderr || `El encoder terminó con código ${corrida.status}.`)
    process.exit(corrida.status ?? 1)
  }

  if (!salida) {
    process.stdout.write(corrida.stdout)
  } else {
    writeFileSync(salida, corrida.stdout, 'utf8')
    const medida = JSON.parse(corrida.stdout)

    /* El resumen es para quien está delante, no para la app: dice de qué eje es
     * la medida y con qué reservas, que es lo que hay que mirar antes de
     * enseñarle un número a nadie. */
    console.log(`\n${nombre || categoria}  ·  ${medida.medidos}/${medida.total} fotogramas`)
    console.log(`  eje              ${medida.ejeObjetivo ?? '—'}`)
    /* La escala se dice con su dispersión y no con un adjetivo: «fiable» a secas
     * esconde que el umbral es del 15 % y que la mediana del corpus es del 37. */
    const escala = medida.escala
    console.log(
      `  escala           ${
        escala?.ok
          ? `${escala.fiable ? 'fiable' : 'DUDOSA'} · dispersión ${(escala.dispersion * 100).toFixed(1)} %`
          : (escala?.motivo ?? 'sin escala')
      }`,
    )
    if (medida.maximoEje) {
      console.log(
        `  brazo máximo     ${medida.maximoEje.mm.toFixed(0)} mm ± ${(medida.sigmaBrazoMm ?? 0).toFixed(0)}` +
          ` al ${(medida.maximoEje.fraccion * 100).toFixed(0)} % de la repetición`,
      )
    }
    for (const t of medida.negativas ?? []) console.log(`  ⚠ ${t}`)
    console.log(`\n  ${salida}`)
  }
} finally {
  rmSync(carpeta, { recursive: true, force: true })
}
