/**
 * FIRMAR LAS REVISIONES, UNA POR UNA, HABIÉNDOLAS OÍDO.
 *
 * SIN SHEBANG A PROPÓSITO: esto se lanza con npm y pasa por vite-node, que reescribe los
 * imports arriba del todo y empujaría el `#!` a la sexta línea, donde deja de ser shebang y
 * pasa a ser un error de sintaxis.
 *
 * =============================================================================
 * POR QUÉ EXISTE
 * =============================================================================
 *
 * El 11-sep se publicaron 22 revisiones y Bryan fue a firmarlas. No pudo: **no había
 * dónde**. La cadena entera estaba —calcular, escribir el guion, generar la voz, subir,
 * esconder lo no firmado— y faltaba el último gesto, que es justo el único que no se
 * automatiza. La app las escondía correctamente y nadie las veía; se descubrió al usarlo.
 *
 * Esto es el remedio de esta semana, no la casa definitiva: lo suyo es una pantalla en la
 * app con la lista y el reproductor. Mientras tanto, esto hace lo mismo desde la terminal.
 *
 * =============================================================================
 * CÓMO SE USA
 * =============================================================================
 *
 *   npm run firmar-revisiones -- --semana 2026-09-07
 *   npm run firmar-revisiones -- --semana 2026-09-07 --persona <uuid>   (solo esa)
 *
 * Va una por una: dice de quién es, imprime LO QUE VA A OÍR esa persona, abre el audio en
 * el reproductor del sistema y espera. Entonces:
 *
 *   s  firmo esta          n  paso de esta (queda sin firmar)
 *   r  repetir el audio    q  salir (lo firmado hasta aquí, firmado queda)
 *
 * Con `--ensayo` no escribe nada: sirve para ver qué hay pendiente sin comprometerse.
 *
 * =============================================================================
 * LO QUE ESTE ARCHIVO NO HACE, Y ES EL PUNTO ENTERO
 * =============================================================================
 *
 * No firma solo. No tiene modo «firma todas» sin oírlas: la firma es lo que separa «la
 * máquina dijo algo con mi voz» de «yo se lo dije», y un botón de firmar-todo convierte eso
 * en un trámite. Si algún día hace falta, que lo añada alguien que pueda defenderlo.
 *
 * Tampoco despublica: para quitar una firma hay que ir a la base a mano, a propósito.
 */
import { createInterface } from 'node:readline/promises'
import { spawn } from 'node:child_process'
import { stdin, stdout } from 'node:process'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

import { lunesDeLaSemana } from '../src/domain/resumenSemanal/reparto.ts'
import { revisionesPorFirmar } from '../src/domain/video/publicacion.ts'

const CAJON = 'medios-app'

function argumentos() {
  const args = new Map()
  const crudos = process.argv.slice(2)
  for (let i = 0; i < crudos.length; i += 1) {
    const a = crudos[i]
    if (!a.startsWith('--')) continue
    const clave = a.slice(2)
    const siguiente = crudos[i + 1]
    if (siguiente && !siguiente.startsWith('--')) {
      args.set(clave, siguiente)
      i += 1
    } else {
      args.set(clave, true)
    }
  }
  return args
}

/** Abre el archivo con el reproductor de siempre del sistema. Si no se puede, se dice. */
function reproducir(url) {
  try {
    const orden = process.platform === 'win32' ? 'cmd' : 'open'
    const partes = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
    spawn(orden, partes, { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = argumentos()
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_KEY
  if (!url || !clave) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.')
    process.exit(1)
  }
  const ensayo = args.has('ensayo')
  const semana = lunesDeLaSemana(args.get('semana') ?? new Date().toISOString().slice(0, 10))
  const sb = createClient(url, clave, { auth: { persistSession: false } })

  const { data: filas, error } = await sb
    .from('videos_semanales')
    .select('usuario_id, semana, path, tipo, guion, aprobado_en')
    .eq('semana', semana)
  if (error) {
    console.error(`No pude leer las revisiones: ${error.message}`)
    process.exit(1)
  }

  // Los nombres viven en otra tabla: aquí solo para poder decir de quién es cada una.
  const { data: personas } = await sb
    .from('usuarios_app')
    .select('id, nombre')
    .in('id', (filas ?? []).map((f) => f.usuario_id))
  const nombres = new Map((personas ?? []).map((p) => [p.id, (p.nombre ?? '').trim()]))

  const soloUno = typeof args.get('persona') === 'string' ? args.get('persona') : ''
  const { ofrecer, yaFirmadas, sinGuion } = revisionesPorFirmar(
    (filas ?? []).filter((f) => !soloUno || f.usuario_id === soloUno).map((f) => ({
      usuarioId: f.usuario_id,
      nombre: nombres.get(f.usuario_id) || undefined,
      semana: f.semana,
      path: f.path,
      tipo: f.tipo,
      guion: f.guion,
      aprobadoEn: f.aprobado_en,
    })),
  )

  console.log(`\nSemana del ${semana} · ${filas?.length ?? 0} revisiones · ` +
    `${yaFirmadas} ya firmadas · ${ofrecer.length} por firmar`)
  if (sinGuion.length > 0) {
    console.log(`\n  ${sinGuion.length} NO se ofrecen porque no traen guion, y sin saber qué`)
    console.log('  dicen no se pueden firmar:')
    for (const s of sinGuion) console.log(`    · ${s.nombre ?? s.usuarioId}`)
  }
  if (ofrecer.length === 0) {
    console.log('\nNo hay nada que firmar.')
    return
  }
  if (ensayo) {
    console.log('\nENSAYO. Se ofrecerían, por orden:')
    for (const r of ofrecer) console.log(`  · ${r.nombre ?? r.usuarioId} (${r.tipo})`)
    return
  }

  // Firmar pide una persona delante. Si esto corre sin terminal —una tarea programada, una
  // tubería, un `printf ... | npm run`— se niega en vez de reventar a medias con un
  // `ERR_USE_AFTER_CLOSE`. Y sobre todo: que NADIE pueda automatizar la firma sin querer.
  if (!stdin.isTTY) {
    console.error('\nEsto hay que responderlo a mano: no hay terminal donde preguntar.')
    console.error('La firma es el único paso que no se automatiza. Usa --ensayo para mirar.')
    process.exit(1)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  let firmadas = 0
  let saltadas = 0

  for (const [i, r] of ofrecer.entries()) {
    const quien = r.nombre ?? r.usuarioId
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`[${i + 1}/${ofrecer.length}] ${quien} · ${r.tipo}`)
    console.log(`${'─'.repeat(70)}`)
    console.log(r.guion)
    console.log('')

    // Enlace firmado y de vida corta: el audio dice datos de esa persona, así que no se
    // deja una URL por ahí más de lo necesario.
    const { data: enlace } = await sb.storage.from(CAJON).createSignedUrl(r.path, 600)
    if (enlace?.signedUrl) {
      reproducir(enlace.signedUrl)
    } else {
      console.log('  (no pude abrir el audio; puedes firmar igual solo si lo has oído ya)')
    }

    let decidido = false
    while (!decidido) {
      let respuesta
      try {
        respuesta = (await rl.question('  ¿firmas?  s = sí · n = no · r = repetir · q = salir  > '))
          .trim()
          .toLowerCase()
      } catch {
        // Se cerró la entrada (Ctrl+C, la terminal, una tubería que se acabó). Lo firmado
        // firmado queda; lo demás sigue escondido, que es el lado seguro del error.
        console.log(`\n\nSe cortó la entrada. Firmadas ${firmadas}; el resto sigue escondido.`)
        rl.close()
        return
      }
      if (respuesta === 'r') {
        const { data: otra } = await sb.storage.from(CAJON).createSignedUrl(r.path, 600)
        if (otra?.signedUrl) reproducir(otra.signedUrl)
        continue
      }
      if (respuesta === 'q') {
        console.log(`\nSalgo. Firmadas ${firmadas}; el resto sigue escondido.`)
        rl.close()
        return
      }
      if (respuesta === 'n') {
        saltadas += 1
        decidido = true
        continue
      }
      if (respuesta === 's') {
        const { error: fallo } = await sb
          .from('videos_semanales')
          .update({ aprobado_en: new Date().toISOString() })
          .eq('usuario_id', r.usuarioId)
          .eq('semana', r.semana)
        if (fallo) {
          console.log(`  NO se pudo firmar: ${fallo.message}`)
        } else {
          firmadas += 1
          console.log(`  firmada. ${quien} ya la ve en su app.`)
        }
        decidido = true
        continue
      }
      console.log('  (responde s, n, r o q)')
    }
  }

  rl.close()
  console.log(`\nListo. ${firmadas} firmadas · ${saltadas} sin firmar.`)
  if (saltadas > 0) {
    console.log('Las que no firmaste siguen escondidas: nadie las ve, y puedes volver luego.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
