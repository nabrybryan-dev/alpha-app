import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mutantes de la migración de la firma automática: cada uno siembra UN defecto y la prueba
// `aprobacion-automatica.mjs` TIENE que ponerse roja. Un mutante que sobrevive quiere decir que
// la prueba no vigila esa puerta («ningún check cuenta verde hasta haberlo visto fallar»).
//
//   node mutar-aprobacion-automatica.mjs
const original = await readFile(
  new URL('../supabase/migrations/XXXX_aprobacion_automatica_revisiones.sql', import.meta.url),
  'utf8',
)
const prueba = fileURLToPath(new URL('./aprobacion-automatica.mjs', import.meta.url))

const mutantes = [
  ['sin comprobar el rol de servicio', "if rol <> 'service_role' then", 'if false then'],
  ['pisa firmas ya hechas', 'and v.aprobado_en is null                      -- nunca pisa una firma', ''],
  ['ignora la corrección pedida', 'and v.correccion_solicitada is null', ''],
  ['firma sin guion', "and nullif(trim(v.guion), '') is not null", ''],
  ['firma rutas históricas', "and v.path ~ '^personas/[^/]+/[0-9-]+/[0-9a-f-]{36}\\.[a-z0-9]+$'", ''],
  ['firma sin archivo en el almacén', "and exists (select 1 from storage.objects o\n                    where o.bucket_id = 'medios-app' and o.name = v.path)", ''],
  ['firma a todos, no solo a los marcados', 'and v.usuario_id = any (p_usuarios)            -- solo los que el agente marcó «publicar»', ''],
  ['ignora el interruptor detener', "where ultima.tipo = 'detener')", "where false)"],
  ['detener solo mira la semana de la revisión', "in (v.semana::text, (v.semana + 7)::text)", "in (v.semana::text)"],
  ['detener ignora la reanudación posterior', "r.tipo in ('detener', 'reanudar')", "r.tipo in ('detener')"],
  ['firma sin marcarla como automática', "set aprobado_en = now(), aprobacion = 'automatica'", 'set aprobado_en = now()'],
  ['las firmas antiguas no se marcan coach', "set aprobacion = 'coach'\n where aprobado_en is not null and aprobacion is null;", "set aprobacion = null\n where false;"],
  ['retirar la firma deja la marca', 'new.aprobado_por := null;\n    new.aprobacion := null;\n    new.correccion_solicitada := null;', 'new.aprobado_por := null;\n    new.correccion_solicitada := null;'],
  ['la función queda abierta a la persona autenticada', 'from public, anon, authenticated;\ngrant execute on function public.firmar', 'from public, anon;\ngrant execute on function public.firmar'],
]

const carpeta = await mkdtemp(join(tmpdir(), 'mutar-firma-'))
let vivos = 0
try {
  for (const [nombre, buscar, poner] of mutantes) {
    if (!original.includes(buscar)) {
      console.log(`  ?? NO SE PUDO SEMBRAR: «${nombre}» (el texto a mutar ya no está en la migración)`)
      vivos += 1
      continue
    }
    const ruta = join(carpeta, 'mutante.sql')
    await writeFile(ruta, original.replace(buscar, poner), 'utf8')
    const r = spawnSync(process.execPath, [prueba], {
      env: { ...process.env, MIGRACION_ALTERNA: ruta },
      encoding: 'utf8',
    })
    const cazado = r.status !== 0
    if (!cazado) vivos += 1
    console.log(`  ${cazado ? 'CAZADO ' : 'VIVO   '} ${nombre}`)
  }
} finally {
  await rm(carpeta, { recursive: true, force: true })
}
console.log(vivos === 0 ? `\n${mutantes.length} de ${mutantes.length} mutantes cazados.` : `\n${vivos} mutante(s) sin cazar.`)
process.exitCode = vivos === 0 ? 0 : 1
