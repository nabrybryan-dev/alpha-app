/**
 * EL PUENTE: de los números de cada persona a su audio publicado. Sin aprobar.
 *
 * SIN SHEBANG A PROPÓSITO, como `publicar-video.mjs`: esto se lanza con npm y pasa por
 * vite-node, que reescribe los imports arriba del todo y empujaría el `#!` a la sexta
 * línea, donde deja de ser un shebang y pasa a ser un error de sintaxis.
 *
 * =============================================================================
 * QUÉ ATABA ESTO
 * =============================================================================
 *
 * Estaban las cuatro piezas y ninguna se hablaba con la siguiente: la cuenta
 * (`domain/resumenSemanal/calcular.ts`), la plantilla del guion (`guion.ts`), la voz
 * (Python, fuera del repo) y el publicador (`publicar-video.mjs`). Era tener la báscula,
 * la libreta, el micrófono y el mensajero sin nadie que los pasara de mano en mano.
 *
 * =============================================================================
 * SON DOS PASOS Y SE CORREN POR SEPARADO, A PROPÓSITO
 * =============================================================================
 *
 *   1. `--paso guiones`   lee la base y escribe, por persona, su guion y el manifiesto.
 *   2. (fuera de aquí)    la voz lee ese manifiesto y deja un audio por persona.
 *   3. `--paso publicar`  sube cada audio y escribe su fila. NUNCA aprueba.
 *
 * Separados porque en medio hay una hora de máquina hablando, y porque lo que se le va a
 * decir a alguien con la voz del coach tiene que poder leerse ANTES de que suene. El paso
 * de la voz no vive aquí: vive donde vive el modelo, con su propio entorno de Python.
 *
 * =============================================================================
 * CÓMO SE CORRE
 * =============================================================================
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npm run revision-semanal -- --paso guiones --semana 2026-09-07
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npm run revision-semanal -- --paso publicar --semana 2026-09-07
 *
 * Opciones:
 *   --paso guiones|publicar   qué mitad se hace. Obligatorio.
 *   --semana <AAAA-MM-DD>     cualquier día de la semana; se guarda por su LUNES.
 *                             Sin ella, la semana en la que cae hoy.
 *   --carpeta <ruta>          dónde viven guiones y audios. Por defecto
 *                             `salidas/revision-<semana>`.
 *   --persona <uuid|correo>   hacer solo a esa persona. Para probar con uno antes de 23.
 *   --forzar                  en `publicar`, pisar una revisión ya aprobada. Con la mano.
 *   --ensayo                  en `publicar`, no toca nada: dice qué haría, y no pregunta
 *                             siquiera si ya había una revisión firmada.
 *
 * La clave de servicio viaja por el entorno y no se guarda en ningún archivo del repo.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

import {
  lunesDeLaSemana,
  personasDeLaTanda,
  repartoSemanal,
} from '../src/domain/resumenSemanal/reparto.ts'
import { archivoDeLaRevision, FORMATOS } from '../src/domain/video/publicacion.ts'
import { PORQUE, publicarUnaRevision } from './lib/publicar-una-revision.mjs'

const MANIFIESTO = 'manifiesto.json'

/** Cuántos caracteres dice por segundo un hablante normal en español. Solo para avisar. */
const CARACTERES_POR_SEGUNDO = 14

/** Por qué alguien se queda fuera de la tanda, dicho para leerlo. */
const POR_QUE_SALTO = {
  'nada-que-decir':
    'no hay ni sesiones, ni comida registrada, ni una sola noche: su revisión sería un ' +
    'hola y un adiós con la voz del coach',
  'sin-usuario': 'la fila venía sin id de persona',
}

/** Lee `--clave=valor` y `--clave valor`, igual que el publicador. */
function argumentos() {
  const args = new Map()
  const trozos = process.argv.slice(2)
  for (let i = 0; i < trozos.length; i++) {
    const trozo = trozos[i]
    if (trozo === '--' || !trozo.startsWith('--')) continue
    const [clave, ...resto] = trozo.slice(2).split('=')
    if (resto.length) {
      args.set(clave, resto.join('='))
      continue
    }
    const siguiente = trozos[i + 1]
    if (siguiente !== undefined && !siguiente.startsWith('--')) {
      args.set(clave, siguiente)
      i++
    } else {
      args.set(clave, true)
    }
  }
  return args
}

function texto(args, clave, porDefecto = '') {
  const valor = args.get(clave)
  if (valor === true) {
    console.error(`A --${clave} le falta el valor: se escribe «--${clave} algo».`)
    process.exit(1)
  }
  return valor === undefined ? porDefecto : String(valor)
}

function clienteDeServicio() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY. Los guiones salen de la base: sin clave ' +
        'no hay de dónde sacarlos.',
    )
    process.exit(1)
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

async function pedir(consulta, que) {
  const { data, error } = await consulta
  // Una tabla que falla NO puede leerse como «esa persona no tiene nada»: saldría una
  // revisión diciéndole cero sesiones a quien hizo cinco, con la voz del coach.
  if (error) throw new Error(`no pude leer ${que}: ${error.message}`)
  return data ?? []
}

/**
 * Trae de la base las cuatro cosas que hacen falta y las deja en manos del dominio.
 *
 * Este archivo NO decide nada: quién entra en la tanda y cómo se casan las filas con las
 * personas vive en `domain/resumenSemanal/reparto.ts`, que se prueba en frío. Aquí solo se
 * pide. La razón es la de siempre: lo que puede hacer daño es lo que se decide, y decidir
 * no necesita clave de servicio.
 */
async function traerLaTanda(sb, soloUno) {
  const [usuarios, microciclos, checkins, adherencias] = await Promise.all([
    pedir(sb.from('usuarios_app').select('id, nombre, rol').eq('rol', 'asesorado'), 'los usuarios'),
    pedir(
      sb.from('microciclos').select('usuario_id, datos').eq('estado', 'activo'),
      'los microciclos',
    ),
    // TODOS sus check-ins y TODAS sus adherencias, no los de la semana: son los mismos que
    // alimentan la tarjeta de Hoy, y la revisión se ve pegada encima de esa tarjeta. Ver la
    // cabecera de `domain/resumenSemanal/reparto.ts`.
    pedir(sb.from('checkins').select('usuario_id, datos'), 'los check-ins'),
    pedir(
      sb.from('adherencias').select('id, usuario_id, fecha, estado, comentario'),
      'las adherencias',
    ),
  ])

  return personasDeLaTanda({ usuarios, microciclos, checkins, adherencias }, soloUno)
}

/** Resuelve la persona por id o por correo. Nunca por nombre. */
async function idDeLaPersona(sb, persona) {
  if (!persona) return undefined
  if (/^[0-9a-f-]{36}$/i.test(persona)) return persona
  if (!persona.includes('@')) {
    throw new Error(`«${persona}» no es ni un id ni un correo. La persona NO se busca por nombre.`)
  }
  const { data, error } = await sb.auth.admin.listUsers()
  if (error) throw new Error(`no pude leer los usuarios: ${error.message}`)
  const encontrados = data.users.filter(
    (u) => (u.email ?? '').toLowerCase() === persona.toLowerCase(),
  )
  if (encontrados.length === 0) throw new Error(`no hay ningún usuario con el correo ${persona}`)
  if (encontrados.length > 1) throw new Error(`hay ${encontrados.length} usuarios con ese correo`)
  return encontrados[0].id
}

async function pasoGuiones(args, carpeta, semana) {
  const sb = clienteDeServicio()
  const soloUno = await idDeLaPersona(sb, texto(args, 'persona'))
  const personas = await traerLaTanda(sb, soloUno)
  const tanda = repartoSemanal(personas, semana)

  await mkdir(carpeta, { recursive: true })

  const encargos = []
  for (const encargo of tanda.encargos) {
    const archivoGuion = `${encargo.usuarioId}.txt`
    await writeFile(join(carpeta, archivoGuion), `${encargo.guion.texto}\n`, 'utf8')
    encargos.push({
      usuarioId: encargo.usuarioId,
      nombre: encargo.nombre,
      semana: encargo.semana,
      guion: encargo.guion.texto,
      archivoGuion,
      // El audio todavía no existe: este es el nombre que el paso de la voz tiene que
      // dejar, con cualquiera de las extensiones que el publicador admite.
      audioEsperado: `${encargo.usuarioId}.mp3`,
      frasesOmitidas: encargo.guion.omitidas,
      numeros: encargo.resumen,
    })
  }

  await writeFile(
    join(carpeta, MANIFIESTO),
    `${JSON.stringify(
      { semana, generado: new Date().toISOString(), encargos, saltos: tanda.saltos },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`Semana del ${semana} · ${encargos.length} guiones en ${carpeta}`)
  for (const e of encargos) {
    const segundos = Math.round(e.guion.length / CARACTERES_POR_SEGUNDO)
    const faltan = e.frasesOmitidas ? ` · ${e.frasesOmitidas} frase(s) sin dato` : ''
    console.log(`  ${e.nombre || '(sin nombre)'} · ${e.guion.length} caracteres · ~${segundos}s${faltan}`)
  }
  for (const s of tanda.saltos) {
    console.log(`  SALTADO ${s.nombre || s.usuarioId}: ${POR_QUE_SALTO[s.motivo] ?? s.motivo}`)
  }
  console.log(`\nManifiesto: ${join(carpeta, MANIFIESTO)}`)
  console.log('Siguiente: generar la voz y dejar cada audio en esa carpeta con el id por nombre.')
}

async function pasoPublicar(args, carpeta, semana) {
  const ensayo = args.has('ensayo')
  const sb = ensayo ? null : clienteDeServicio()
  const pedida = texto(args, 'persona')
  // En ensayo no se resuelve a nadie contra la base: lo que el ensayo prueba es el reparto,
  // no la identidad. Por eso un correo aquí solo vale con clave.
  const soloUno = ensayo ? (/^[0-9a-f-]{36}$/i.test(pedida) ? pedida : undefined) : await idDeLaPersona(sb, pedida)
  if (ensayo && pedida && !soloUno) {
    console.log(`En ensayo «${pedida}» no se puede resolver: se recorre la tanda entera.`)
  }

  let manifiesto
  try {
    manifiesto = JSON.parse(await readFile(join(carpeta, MANIFIESTO), 'utf8'))
  } catch {
    console.error(
      `No hay manifiesto en ${carpeta}. Este paso no vuelve a calcular los guiones: lo que se ` +
        'publica tiene que ser exactamente lo que se revisó.',
    )
    process.exit(1)
  }

  // La semana la manda el manifiesto, no la línea de órdenes: publicar bajo la fecha de una
  // semana unos audios hechos para otra es la forma de que alguien oiga números viejos.
  if (manifiesto.semana !== semana) {
    console.error(
      `El manifiesto es de la semana del ${manifiesto.semana} y se ha pedido publicar la del ` +
        `${semana}. Se para: cada audio dice los números de SU semana.`,
    )
    process.exit(1)
  }

  const enCarpeta = await readdir(carpeta)
  const extensiones = Object.keys(FORMATOS)

  let publicados = 0
  let sinAudio = 0
  let rechazados = 0
  let conCara = 0
  let conVoz = 0

  for (const encargo of manifiesto.encargos) {
    if (soloUno && encargo.usuarioId !== soloUno) continue
    const quien = encargo.nombre || encargo.usuarioId

    // La cara manda sobre la voz cuando están las dos: el mp4 es la revisión y el mp3 es
    // el material del que salió. Lo decide `archivoDeLaRevision`, no el orden en que el
    // sistema de archivos liste la carpeta ni el orden de las claves de `FORMATOS`.
    const elegido = archivoDeLaRevision(enCarpeta, encargo.usuarioId)

    if (!elegido) {
      // No se publica media tanda en silencio: a quien le falta el audio se le nombra.
      console.log(`  SIN AUDIO ${quien}: falta ${encargo.usuarioId}.<${extensiones.join('|')}>`)
      sinAudio += 1
      continue
    }
    if (elegido.tipo === 'video') conCara += 1
    else conVoz += 1

    const resultado = await publicarUnaRevision({
      supabase: sb,
      usuarioId: encargo.usuarioId,
      semana: manifiesto.semana,
      archivo: join(carpeta, elegido.archivo),
      // El guion que se publica es el del manifiesto, palabra por palabra: es lo que se
      // revisó, y es lo que permite auditar después qué se le dijo exactamente a alguien.
      guion: encargo.guion,
      forzar: args.has('forzar'),
      ensayo,
    })

    if (resultado.ensayo) {
      console.log(`  ENSAYO ${quien}: iría a ${resultado.path}`)
      continue
    }
    if (!resultado.publicado) {
      console.log(`  NO ${quien}: ${PORQUE[resultado.motivo] ?? resultado.motivo}`)
      rechazados += 1
      continue
    }
    console.log(
      `  ${quien} ${elegido.tipo === 'video' ? '(CARA)' : '(voz)'} → ${resultado.path}` +
        `${resultado.reemplaza ? ' (reemplaza)' : ''}`,
    )
    publicados += 1
  }

  // CON CARA Y SOLO VOZ, SIEMPRE. Este renglón es lo que queda escrito en el registro del
  // viernes, y es el único sitio donde se ve si el paso de la cara sirvió de algo: un
  // viernes sin cara y un viernes con las 22 se leían exactamente igual. El contador ya
  // se llevaba; no se decía.
  console.log(
    `\nSemana del ${semana} · ${publicados} publicadas · ${sinAudio} sin audio · ` +
      `${rechazados} rechazadas · con cara: ${conCara} · solo voz: ${conVoz}`,
  )
  if (ensayo) {
    console.log('ENSAYO: no se ha tocado nada, y no se ha preguntado si alguna estaba ya firmada.')
  } else if (publicados > 0) {
    console.log('SIN APROBAR: nadie las verá hasta que se firmen en la bandeja.')
  }
}

async function main() {
  const args = argumentos()
  const paso = texto(args, 'paso')
  if (paso !== 'guiones' && paso !== 'publicar') {
    console.error('Falta --paso guiones o --paso publicar. Ver la cabecera de este archivo.')
    process.exit(1)
  }

  const pedida = texto(args, 'semana')
  const hoy = new Date().toISOString().slice(0, 10)
  const semana = lunesDeLaSemana(pedida || hoy)
  if (pedida && pedida !== semana) {
    console.log(`La semana del ${pedida} se guarda por su lunes: ${semana}.`)
  }

  const carpeta = resolve(process.cwd(), texto(args, 'carpeta', join('salidas', `revision-${semana}`)))

  if (paso === 'guiones') await pasoGuiones(args, carpeta, semana)
  else await pasoPublicar(args, carpeta, semana)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
