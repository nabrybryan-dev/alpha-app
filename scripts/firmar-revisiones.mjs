/**
 * Consulta historica de revisiones pendientes (solo --ensayo).
 * Las decisiones se toman en /coach/revisiones con la identidad del coach
 * y la comprobacion de version de la RPC. Este script ya no escribe firmas.
 */
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

import { lunesDeLaSemana } from '../src/domain/resumenSemanal/reparto.ts'
import { revisionesPorFirmar } from '../src/domain/video/publicacion.ts'

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

async function main() {
  const args = argumentos()
  if (!args.has('ensayo')) {
    console.error('La firma por terminal fue retirada. Usa /coach/revisiones en la app del coach.')
    console.error('La bandeja debe estar desplegada antes de activar este cambio. --ensayo solo consulta.')
    process.exitCode = 1
    return
  }
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_KEY
  if (!url || !clave) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.')
    process.exit(1)
  }
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
  console.log('\nENSAYO. Pendientes de revisar en /coach/revisiones:')
  for (const r of ofrecer) console.log(`  ? ${r.nombre ?? r.usuarioId} (${r.tipo})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
