#!/usr/bin/env node
/**
 * PUBLICA EL VÍDEO SEMANAL DE UNA PERSONA — y no lo aprueba.
 *
 * Entre el archivo renderizado y la app no había nada: medido el 2026-09-11 sobre todas las
 * ramas, **nadie escribía en `videos_semanales`**. La tabla existía, la política existía y
 * la pantalla sabía leerla; faltaba quien pusiera el vídeo dentro. Esto es esa pieza.
 *
 * ## Lo que hace, en orden
 *
 *   1. resuelve la persona por su id o su correo —NUNCA por su nombre—;
 *   2. decide si se puede publicar (`domain/video/publicacion.ts`, que es puro y probado);
 *   3. sube el archivo al cajón, en `personas/<uuid>/<lunes>.<ext>`;
 *   4. escribe la fila con su guion, **sin aprobación ninguna**;
 *   5. cuenta lo que hizo.
 *
 * ## Lo que NO hace, y es lo importante
 *
 * **No aprueba.** Ni con una bandera, ni con un parámetro escondido. Lo que hace que un
 * vídeo pueda salir es la firma en la bandeja —o la puerta, cuando lleve cuatro domingos
 * limpios—, y ese es el único camino. Un publicador que además aprobara convertiría la
 * firma en un trámite que se salta con volver a subir el archivo.
 *
 * Y no es solo una promesa de este archivo: medido contra la base el 2026-09-10, la regla
 * de lectura de `videos_semanales` dice `usuario_id = auth.uid() and aprobado_en is not
 * null`. O sea que **lo que este script publica es invisible para la persona** hasta que
 * alguien lo firme. Si algún día esa regla se relajara, esto pasaría de ser un cinturón de
 * dos hebillas a una sola: conviene saberlo antes de tocarla.
 *
 * Y **no pisa un vídeo ya firmado**: eso cambiaría el archivo por debajo de una aprobación
 * que ya se dio. Para forzarlo hay que escribir `--forzar` con la mano.
 *
 * =============================================================================
 * CÓMO SE CORRE
 * =============================================================================
 *
 * Se corre con **vite-node**, no con `node` a secas: este archivo importa el modulo de
 * decision, que es TypeScript. Lanzarlo con `node` falla en el import, y el error no habla
 * de compiladores —dice que no reconoce la sintaxis—, asi que conviene saberlo de antemano.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     npm run publicar-video -- \
 *       --persona alpha+bryan@gmail.com \
 *       --semana 2026-09-14 \
 *       --archivo ./salidas/bryan.mp4 \
 *       --guion ./salidas/bryan.txt
 *
 * Opciones:
 *   --persona <uuid|correo>   a quién va. Por correo se resuelve contra `auth.users`.
 *   --semana <AAAA-MM-DD>     el LUNES de la semana. Otro día se rechaza.
 *   --archivo <ruta>          el vídeo ya renderizado.
 *   --guion <ruta>            lo que dice, palabra por palabra. Obligatorio.
 *   --forzar                  sobrescribir aunque ya esté aprobado. Con la mano.
 *   --ensayo                  NO toca nada: dice lo que haría y sale. Sirve para
 *                             probar el reparto entero sin clave de servicio.
 *
 * La clave de servicio **no se guarda en ningún archivo del repo**: viaja por el entorno,
 * como en `publicar-fichas.mjs`.
 */

import { readFile, stat } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

import {
  contentTypeDelMedio,
  decidirPublicacion,
  filaDelVideo,
} from '../src/domain/video/publicacion.ts'

const BUCKET = 'medios-app'

// El script YA NO tiene su propia lista de formatos: la unica esta en
// `domain/video/publicacion.ts`. Tenerla dos veces permitia que discreparan
// -admitir aqui algo que alla se rechaza, o subirlo con otro Content-Type- y
// esa clase de desacuerdo no da error, da un archivo que el movil no abre.

const PORQUE = {
  'sin-usuario': 'no se ha dicho de quién es el vídeo',
  'semana-no-es-lunes': 'la semana tiene que ser un LUNES en formato AAAA-MM-DD',
  'archivo-vacio': 'el archivo está vacío',
  'archivo-enorme': 'el archivo pasa del tope: algo salió mal al renderizar',
  'extension-no-admitida': 'eso no es un audio ni un vídeo que el móvil vaya a reproducir',
  'sin-guion': 'falta el guion, y sin él el vídeo no se puede auditar después',
  'ya-aprobado':
    'ese vídeo YA ESTÁ APROBADO. Sobrescribirlo emitiría otro distinto bajo una firma que ' +
    'ya se dio. Si de verdad hay que cambiarlo, vuelve a pedir la firma o usa --forzar.',
}

/**
 * Lee los argumentos en las DOS formas: `--clave=valor` y `--clave valor`.
 *
 * Las dos, y no una, porque la primera version solo entendia el `=` mientras la cabecera
 * documentaba el espacio. Escribir `--archivo ./falso.mp4` guardaba `true` como valor y el
 * programa se iba a buscar un archivo llamado «true». El error existia, pero hablaba de un
 * fichero que nadie habia nombrado: el peor sitio donde empezar a buscar.
 */
function argumentos() {
  const args = new Map()
  const trozos = process.argv.slice(2)
  for (let i = 0; i < trozos.length; i++) {
    const trozo = trozos[i]
    if (trozo === '--') continue // el separador que deja pasar npm/npx
    if (!trozo.startsWith('--')) continue
    const [clave, ...resto] = trozo.slice(2).split('=')
    if (resto.length) {
      args.set(clave, resto.join('='))
      continue
    }
    // Sin `=`: el valor es lo siguiente, salvo que lo siguiente sea otra opcion. Asi
    // `--ensayo --persona X` deja `ensayo` en bandera y no se come el `--persona`.
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

/** Un valor que se esperaba texto y llego como bandera se dice aqui, no tres pasos despues. */
function texto(args, clave) {
  const valor = args.get(clave)
  if (valor === true) {
    console.error(`A --${clave} le falta el valor: se escribe «--${clave} algo» o «--${clave}=algo».`)
    process.exit(1)
  }
  return String(valor ?? '')
}

/** Resuelve la persona. Por id si ya lo es; por correo si no. Nunca por nombre. */
async function idDeLaPersona(supabase, persona) {
  if (/^[0-9a-f-]{36}$/i.test(persona)) return persona
  if (!persona.includes('@')) {
    throw new Error(
      `«${persona}» no es ni un id ni un correo. La persona NO se busca por nombre: ya costó ` +
        'una carga que dos personas compartieran el suyo.',
    )
  }
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`no pude leer los usuarios: ${error.message}`)
  const encontrados = data.users.filter((u) => (u.email ?? '').toLowerCase() === persona.toLowerCase())
  if (encontrados.length === 0) throw new Error(`no hay ningún usuario con el correo ${persona}`)
  if (encontrados.length > 1) throw new Error(`hay ${encontrados.length} usuarios con ese correo`)
  return encontrados[0].id
}

async function main() {
  const args = argumentos()
  const ensayo = args.has('ensayo')
  const persona = texto(args, 'persona')
  const semana = texto(args, 'semana')
  const rutaArchivo = texto(args, 'archivo')
  const rutaGuion = texto(args, 'guion')

  if (!persona || !semana || !rutaArchivo || !rutaGuion) {
    console.error('Faltan argumentos. Ver la cabecera de este archivo.')
    process.exit(1)
  }

  const archivo = resolve(process.cwd(), rutaArchivo)
  const { size } = await stat(archivo)
  const extension = extname(archivo).replace('.', '').toLowerCase()
  const guion = (await readFile(resolve(process.cwd(), rutaGuion), 'utf8')).trim()

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!ensayo && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY. Con --ensayo no hacen falta.')
    process.exit(1)
  }

  const supabase = ensayo
    ? null
    : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  // En ensayo no se busca a nadie: si lo que se ha dado es un correo, se dice y se sigue con
  // un id de mentira, porque lo que el ensayo prueba es el reparto, no la identidad.
  const usuarioId = ensayo
    ? /^[0-9a-f-]{36}$/i.test(persona)
      ? persona
      : '00000000-0000-0000-0000-000000000000'
    : await idDeLaPersona(supabase, persona)

  // Qué hay ya de esa persona y esa semana. En ensayo no se pregunta: se supone que no hay,
  // y se dice, para que nadie lea «publicaría» como «no había nada aprobado».
  let yaHay
  if (!ensayo) {
    const { data, error } = await supabase
      .from('videos_semanales')
      .select('path, aprobado_en')
      .eq('usuario_id', usuarioId)
      .eq('semana', semana)
      .maybeSingle()
    // Un error aquí NO puede leerse como «no hay nada»: si la consulta falla y seguimos,
    // podríamos pisar un vídeo aprobado creyendo que la semana estaba libre.
    if (error && error.code !== 'PGRST116') {
      throw new Error(`no pude comprobar si ya había vídeo esa semana: ${error.message}`)
    }
    if (data) yaHay = { path: data.path, aprobadoEn: data.aprobado_en ?? null }
  }

  const decision = decidirPublicacion(
    { usuarioId, semana, tamanoBytes: size, extension, guion },
    yaHay,
    args.has('forzar'),
  )

  if (!decision.publica) {
    console.error(`NO se publica: ${PORQUE[decision.motivo] ?? decision.motivo}`)
    process.exit(1)
  }

  if (ensayo) {
    console.log('ENSAYO — no se ha tocado nada.')
    console.log(`  archivo   ${basename(archivo)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
    console.log(`  iría a    ${BUCKET}/${decision.path}`)
    console.log(`  guion     ${guion.length} caracteres`)
    console.log('  firma     NINGUNA: lo publicado nace sin aprobar, siempre.')
    console.log('  ojo       en ensayo no se ha preguntado si ya había un vídeo aprobado.')
    return
  }

  const cuerpo = await readFile(archivo)
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(decision.path, cuerpo, { contentType: contentTypeDelMedio(extension), upsert: true })
  if (errorSubida) throw new Error(`no pude subir el archivo: ${errorSubida.message}`)

  const { error: errorFila } = await supabase
    .from('videos_semanales')
    .upsert(
      {
        ...filaDelVideo({ usuarioId, semana, tamanoBytes: size, extension, guion }, decision.path),
        // La hora la pone AQUI y no el modulo de decision, que es puro y no mira el reloj.
        // Hace falta ponerla a mano porque el `default now()` de la tabla solo corre al
        // INSERTAR: en un reemplazo, sin esto, `publicado_en` seguiria diciendo cuando se
        // publico el primero mientras el archivo ya es otro.
        publicado_en: new Date().toISOString(),
      },
      { onConflict: 'usuario_id,semana' },
    )
  if (errorFila) throw new Error(`subí el archivo pero no pude escribir la fila: ${errorFila.message}`)

  console.log(`Publicado en ${BUCKET}/${decision.path}${decision.reemplaza ? ' (reemplaza)' : ''}`)
  console.log('SIN APROBAR: no se verá hasta que alguien lo firme en la bandeja.')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
