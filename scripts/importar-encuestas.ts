/**
 * Convierte los JSON del panel en SQL para cargar en Supabase.
 *
 * POR QUE UN SCRIPT Y NO UNA PANTALLA. Estos archivos traen datos de salud
 * reales -nombre, correo, medidas, antecedentes-. Un script que lee de donde tu
 * los dejaste y escribe un `.local.sql` que git ignora mantiene todo eso fuera
 * del repositorio. Una pantalla de importacion habria significado subirlos a
 * algun sitio antes de tenerlos donde deben estar.
 *
 * POR QUE SUCRASE Y NO TSX. Este equipo bloquea los binarios nativos, asi que
 * `tsx` -que usa esbuild- no corre. `sucrase-node` transpila TypeScript en
 * JavaScript puro y ya viene con las dependencias del proyecto. Importar el
 * modulo de dominio en vez de reescribir su logica aqui es lo que garantiza que
 * el importador y la app traduzcan igual: una sola fuente, con sus tests.
 *
 * Uso:
 *   npx sucrase-node scripts/importar-encuestas.ts <carpeta-o-archivos...>
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importarIntake, type IntakeCrudo } from '../src/domain/nutricion/importarIntake.ts'

const aqui = dirname(fileURLToPath(import.meta.url))
const DESTINO = resolve(aqui, '../supabase/carga-encuestas.local.sql')

function archivosDe(rutas: string[]): string[] {
  const encontrados: string[] = []
  for (const ruta of rutas) {
    const absoluta = resolve(ruta)
    if (statSync(absoluta).isDirectory()) {
      for (const nombre of readdirSync(absoluta)) {
        if (nombre.endsWith('.json')) encontrados.push(join(absoluta, nombre))
      }
    } else if (absoluta.endsWith('.json')) {
      encontrados.push(absoluta)
    }
  }
  return encontrados
}

/** Comillas de SQL. Un apostrofo en un nombre no puede romper la sentencia. */
const sql = (valor: unknown): string =>
  valor === null || valor === undefined ? 'null' : `'${String(valor).replace(/'/g, "''")}'`

const arreglo = (valores: unknown): string =>
  !Array.isArray(valores) || valores.length === 0
    ? 'null'
    : `array[${valores.map((v) => sql(v)).join(', ')}]::text[]`

interface Fila {
  archivo: string
  nombre?: string
  error?: string
  faltan?: string[]
  senales?: string[]
  alergiasPorTraducir?: boolean
}

function main(): void {
  const rutas = process.argv.slice(2)
  if (rutas.length === 0) {
    console.error('Uso: npx sucrase-node scripts/importar-encuestas.ts <carpeta-o-archivos...>')
    process.exit(1)
  }

  const archivos = archivosDe(rutas)
  if (archivos.length === 0) {
    console.error('No encontre ningun .json en lo que me pasaste.')
    process.exit(1)
  }

  const lineas: string[] = [
    '-- Carga de encuestas de captacion.',
    '--',
    '-- Generado por scripts/importar-encuestas.ts. NO se commitea: trae datos',
    '-- de salud reales. Pegar en el SQL Editor de Supabase y borrar despues.',
    '--',
    '-- El `on conflict` actualiza, asi que se puede volver a pasar el mismo',
    '-- archivo sin duplicar nada. `completada_en` se conserva con coalesce: si',
    '-- la persona ya termino la encuesta en la app, reimportar no la reabre.',
    '',
    'begin;',
    '',
  ]

  const resumen: Fila[] = []

  for (const archivo of archivos) {
    let crudo: IntakeCrudo
    try {
      crudo = JSON.parse(readFileSync(archivo, 'utf8')) as IntakeCrudo
    } catch (error) {
      resumen.push({ archivo, error: `no es un JSON valido (${(error as Error).message})` })
      continue
    }

    const r = importarIntake(crudo)
    const correo = crudo?.person?.email
    if (!correo) {
      resumen.push({ archivo, error: 'sin correo: no hay forma de saber de quien es' })
      continue
    }

    lineas.push(
      `-- ${crudo?.person?.name ?? '(sin nombre)'}`,
      'insert into public.perfil_alimentario (',
      '  asesorado_id, respuestas, completada_en, alergias, alergias_otras,',
      '  frecuencia_cocina, ciclo_menstrual, actualizado_en',
      ')',
      'select u.id,',
      `       ${sql(JSON.stringify(r.respuestas))}::jsonb,`,
      '       now(),',
      `       ${arreglo(r.respuestas.alergias)},`,
      `       ${sql(r.alergiasEnTexto)},`,
      `       ${sql(r.respuestas.frecuenciaCocina ?? null)},`,
      `       ${sql(r.respuestas.cicloMenstrual ?? null)},`,
      '       now()',
      // El correo vive en `auth.users`, no en `usuarios_app`: hay que pasar por
      // ahi. Se ata por correo y no por el id del panel porque son dos bases
      // distintas y ese id no significa nada aqui. Si el correo no existe, el
      // select no devuelve filas y no se inserta nada -mejor que crear una fila
      // huerfana que nadie va a encontrar despues-.
      '  from auth.users au',
      '  join public.usuarios_app u on u.id = au.id',
      ` where lower(au.email) = lower(${sql(correo)})`,
      'on conflict (asesorado_id) do update set',
      '  respuestas     = excluded.respuestas,',
      '  completada_en  = coalesce(public.perfil_alimentario.completada_en, excluded.completada_en),',
      '  alergias       = excluded.alergias,',
      '  alergias_otras = excluded.alergias_otras,',
      '  actualizado_en = now();',
      '',
    )

    resumen.push({
      archivo,
      nombre: crudo?.person?.name,
      faltan: r.faltan,
      senales: r.senales,
      alergiasPorTraducir: Boolean(r.alergiasEnTexto),
    })
  }

  /**
   * Comprobacion al final: cuantas filas entraron de verdad.
   *
   * El insert no falla si el correo no esta en la base -simplemente no inserta-,
   * asi que sin esto el SQL diria "Success" habiendo cargado cero personas.
   */
  lineas.push(
    "select count(*) as perfiles_cargados, 'esperados: " + resumen.filter((f) => !f.error).length + "' as referencia",
    '  from public.perfil_alimentario where respuestas is not null;',
    '',
    'commit;',
    '',
  )
  writeFileSync(DESTINO, lineas.join('\n'), 'utf8')

  console.log(`\n  ${archivos.length} archivo(s) leidos -> ${DESTINO}\n`)
  for (const fila of resumen) {
    if (fila.error) {
      console.log(`  X ${fila.archivo}\n      ${fila.error}`)
      continue
    }
    const otros = (fila.faltan ?? []).filter((f) => f !== 'pasosDiarios' && f !== 'tieneBascula')
    console.log(`  . ${fila.nombre}`)
    console.log(
      '      la app le preguntara: pasos y bascula' +
        (otros.length > 0 ? `, y ademas ${otros.join(', ')}` : ''),
    )
    if (fila.alergiasPorTraducir) {
      console.log('      ! alergias en texto libre: las codifica la nutricionista')
    }
    for (const senal of fila.senales ?? []) console.log(`      ! ${senal}`)
  }
  console.log('')
}

main()
