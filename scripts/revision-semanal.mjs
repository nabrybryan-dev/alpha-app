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
 * CÓDIGOS DE SALIDA (desde el 22-oct; antes `publicar` terminaba SIEMPRE con 0, y el 16-oct el
 * registro dijo «LISTO» con 0 de 13 publicadas):
 *   0  todo lo que tocaba quedó publicado (o ya estaba publicado y firmado)
 *   1  reventó algo (sin clave, sin manifiesto, la base no contestó…)
 *   3  TANDA INCOMPLETA: hay gente sin audio o rechazada. Lo decide `lib/balance-de-la-tanda.mjs`.
 *
 *   `--paso firmar` es la firma AUTOMÁTICA (decisión de Bryan, 21-oct: «Solos, sin freno»). No mira
 *   ninguna bandera: la mira quien lo lanza (`revision-semanal-viernes.ps1`, que la deja APAGADA
 *   por defecto). Firma solo lo que el agente de mensajes marcó «publicar»; la base pone el resto
 *   de las guardas. Con `--ensayo` dice a quién firmaría y no toca nada.
 *
 * Opciones:
 *   --paso guiones|publicar|firmar   qué mitad se hace. Obligatorio.
 *   --semana <AAAA-MM-DD>     cualquier día de la semana; se guarda por su LUNES.
 *                             Sin ella, la semana en la que cae hoy.
 *   --carpeta <ruta>          dónde viven guiones y audios. Por defecto
 *                             `salidas/revision-<semana>`.
 *   --persona <uuid|correo>   hacer solo a esa persona. Para probar con uno antes de 23.
 *   --forzar                  en `publicar`, pisar una revisión ya aprobada. Con la mano.
 *                             La firma SE QUEDA.
 *   --cara-sobre-voz-firmada  en `publicar`, dejar que la CARA reemplace a una VOZ ya
 *                             firmada: la firma se quita y vuelve a la bandeja. Un vídeo
 *                             firmado no se pisa nunca con esto.
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
import { balanceDeLaPublicacion } from './lib/balance-de-la-tanda.mjs'
import { elegirParaFirmar, firmarRevisionesAutomaticas } from './lib/firma-automatica.mjs'
import { PORQUE, publicarUnaRevision } from './lib/publicar-una-revision.mjs'

const MANIFIESTO = 'manifiesto.json'

/** Cuántos caracteres dice por segundo un hablante normal en español. Solo para avisar. */
// Medido el 12-sep con la voz clonada: 16,4 caracteres por segundo (antes se estimaban 14).
const CARACTERES_POR_SEGUNDO = 16

/** Por qué alguien se queda fuera de la tanda, dicho para leerlo. */
const POR_QUE_SALTO = {
  'nada-que-decir':
    'no hay ni sesiones, ni comida registrada, ni una sola noche: su revisión sería un ' +
    'hola y un adiós con la voz del coach',
  'sin-usuario': 'la fila venía sin id de persona',
  'fuera-por-el-coach': 'el coach lo dejó fuera (está en la lista de --fuera-archivo)',
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
    // El rol decide los PERMISOS, no quién entrena: hay staff (nutricionista) con microciclo
    // activo de verdad, y con `eq('rol', 'asesorado')` se quedaba sin revisión sin que nadie
    // lo viera. La cuenta del coach sigue fuera: sus microciclos son de prueba.
    pedir(sb.from('usuarios_app').select('id, nombre, rol').in('rol', ['asesorado', 'nutricionista']), 'los usuarios'),
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

/**
 * Quién se queda sin vídeo por decisión del coach: un nombre (o id) por línea, `#` comenta.
 * Si se pidió un archivo y no está, se AVISA y se sigue con la tanda entera: una lista que
 * falta no puede dejar a toda la cartera sin revisión.
 */
async function listaDeFuera(ruta) {
  if (!ruta) return []
  try {
    const texto = await readFile(ruta, 'utf8')
    return [...new Set(texto.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean))]
  } catch (e) {
    console.log(`AVISO: no pude leer la lista de fuera (${ruta}): ${e.message}. Sigo sin dejar a nadie fuera.`)
    return []
  }
}

async function pasoGuiones(args, carpeta, semana) {
  const sb = clienteDeServicio()
  const soloUno = await idDeLaPersona(sb, texto(args, 'persona'))
  const personas = await traerLaTanda(sb, soloUno)
  const fuera = await listaDeFuera(texto(args, 'fuera-archivo'))
  const tanda = repartoSemanal(personas, semana, fuera)

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
  let yaAprobados = 0
  let conCara = 0
  let conVoz = 0
  let vuelvenALaBandeja = 0

  // Quien el agente de mensajes OMITIÓ (orden de detener vigente) no tiene audio a propósito y no
  // cuenta como esperado: sin esto una persona detenida volvería "incompleta" cada tanda.
  const aPublicar = manifiesto.encargos.filter((e) => !e.omitido && (!soloUno || e.usuarioId === soloUno))
  const omitidos = manifiesto.encargos.filter((e) => e.omitido && (!soloUno || e.usuarioId === soloUno)).length
  if (omitidos) console.log(`  ${omitidos} persona(s) omitida(s) por el agente de mensajes: no se esperan.`)

  for (const encargo of aPublicar) {
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
      caraSobreVozFirmada: args.has('cara-sobre-voz-firmada'),
      ensayo,
    })

    if (resultado.ensayo) {
      console.log(`  ENSAYO ${quien}: iría a ${resultado.path}`)
      continue
    }
    if (!resultado.publicado) {
      console.log(`  NO ${quien}: ${PORQUE[resultado.motivo] ?? resultado.motivo}`)
      // Repetir la corrida sobre algo ya firmado no es un fallo: es lo que debe pasar.
      if (resultado.motivo === 'ya-aprobado') yaAprobados += 1
      else rechazados += 1
      continue
    }
    if (resultado.quitaFirma) vuelvenALaBandeja += 1
    console.log(
      `  ${quien} ${elegido.tipo === 'video' ? '(CARA)' : '(voz)'} → ${resultado.path}` +
        `${resultado.reemplaza ? ' (reemplaza)' : ''}` +
        `${resultado.quitaFirma ? ' · la voz estaba FIRMADA: se quita la firma y vuelve a la bandeja' : ''}`,
    )
    publicados += 1
  }

  // CON CARA Y SOLO VOZ, SIEMPRE. Este renglón es lo que queda escrito en el registro del
  // viernes, y es el único sitio donde se ve si el paso de la cara sirvió de algo: un
  // viernes sin cara y un viernes con las 22 se leían exactamente igual. El contador ya
  // se llevaba; no se decía.
  console.log(
    `\nSemana del ${semana} · ${publicados} publicadas · ${sinAudio} sin audio · ` +
      `${rechazados} rechazadas · con cara: ${conCara} · solo voz: ${conVoz}` +
      `${vuelvenALaBandeja ? ` · vuelven a la bandeja: ${vuelvenALaBandeja}` : ''}`,
  )
  if (ensayo) {
    console.log('ENSAYO: no se ha tocado nada, y no se ha preguntado si alguna estaba ya firmada.')
  } else if (publicados > 0) {
    console.log(
      'SIN FIRMAR: nadie las verá hasta que se firmen (la bandeja del coach o, si está encendida, ' +
        'la firma automática: --paso firmar).',
    )
  }

  // EL BALANCE. Hasta el 22-oct esto terminaba SIEMPRE con 0 (16-oct: 0 de 13 y «LISTO»). Ahora una
  // tanda que no publicó lo que tocaba sale con un código distinto de 0 y lo dice con todas sus letras.
  const balance = balanceDeLaPublicacion({
    esperados: aPublicar.length,
    publicados,
    yaAprobados,
    rechazados,
    sinAudio,
    ensayo,
  })
  console.log(balance.linea)
  return balance.codigoDeSalida
}

/**
 * LA FIRMA AUTOMÁTICA (decisión de Bryan, 21-oct: «Solos, sin freno»). DETRÁS DE UNA BANDERA que
 * el `.ps1` solo enciende si Bryan la dejó encendida; este paso no mira la bandera, la mira quien
 * lo lanza. Firma solo lo que el agente marcó «publicar» y que la base muestra tal cual el
 * manifiesto; la base pone el resto de las guardas (`firmar_revisiones_automaticas`).
 */
async function pasoFirmar(args, carpeta, semana) {
  const ensayo = args.has('ensayo')
  let manifiesto
  try {
    manifiesto = JSON.parse(await readFile(join(carpeta, MANIFIESTO), 'utf8'))
  } catch {
    console.error(`No hay manifiesto en ${carpeta}.`)
    process.exit(1)
  }
  if (manifiesto.semana !== semana) {
    console.error(`El manifiesto es de la semana del ${manifiesto.semana} y se pidió firmar la del ${semana}.`)
    process.exit(1)
  }
  const sb = clienteDeServicio()
  const { data: filas, error } = await sb
    .from('videos_semanales')
    .select('usuario_id, guion, version, aprobado_en, tipo')
    .eq('semana', semana)
  if (error) throw new Error(`no pude leer lo publicado: ${error.message}`)

  const { usuarios, revisiones, noFirmadas } = elegirParaFirmar({ manifiesto, filas: filas ?? [] })
  const nombres = new Map(manifiesto.encargos.map((e) => [e.usuarioId, e.nombre || e.usuarioId]))
  for (const n of noFirmadas) console.log(`  SIN FIRMA ${nombres.get(n.usuarioId)}: ${n.motivo}`)
  if (ensayo) {
    console.log(`\nENSAYO: la firma automática firmaría a ${usuarios.length} y dejaría ${noFirmadas.length} para el coach.`)
    return 0
  }
  // Se firma la VERSIÓN y la HUELLA del guion que se acaba de comprobar (revisión 06, H4), no lo que haya luego.
  const { firmadas, pedidas } = await firmarRevisionesAutomaticas(sb, { semana, revisiones })
  console.log(`\nFirma automática · semana del ${semana} · firmadas ${firmadas} de ${pedidas} pedidas · para el coach: ${noFirmadas.length}`)
  if (firmadas < pedidas) {
    console.log(
      `  ${pedidas - firmadas} quedaron sin firmar: la base las frenó (orden «detener» o riesgo reportado vigente, corrección pedida, o la fila cambió entre la lectura y la firma). ` +
        'Es el interruptor funcionando; están en la bandeja del coach.',
    )
  }
  return 0
}

async function main() {
  const args = argumentos()
  const paso = texto(args, 'paso')
  if (paso !== 'guiones' && paso !== 'publicar' && paso !== 'firmar') {
    console.error('Falta --paso guiones, --paso publicar o --paso firmar. Ver la cabecera de este archivo.')
    process.exit(1)
  }

  const pedida = texto(args, 'semana')
  const hoy = new Date().toISOString().slice(0, 10)
  const semana = lunesDeLaSemana(pedida || hoy)
  if (pedida && pedida !== semana) {
    console.log(`La semana del ${pedida} se guarda por su lunes: ${semana}.`)
  }

  const carpeta = resolve(process.cwd(), texto(args, 'carpeta', join('salidas', `revision-${semana}`)))

  if (paso === 'guiones') {
    await pasoGuiones(args, carpeta, semana)
  } else if (paso === 'firmar') {
    process.exitCode = await pasoFirmar(args, carpeta, semana)
  } else {
    process.exitCode = await pasoPublicar(args, carpeta, semana)
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
