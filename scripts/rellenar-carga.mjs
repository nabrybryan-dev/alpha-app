import process from 'node:process'
import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import {
  componerPrescripcion,
  parsearOndulada,
  parsearPrescripcion,
} from '../src/domain/prescripcion.ts'

/**
 * Rellena `cargaKg`, `unidadCarga` y `notaCoach` en los ejercicios que ya están
 * cargados, leyendo la frase que escribió el coach.
 *
 * **Este script no reescribe `prescripcion` jamás.** Solo añade campos al lado.
 * Es lo que lo hace seguro de correr sobre una semana ya repartida: si el
 * relleno se equivocara, el asesorado sigue leyendo exactamente lo mismo que
 * antes. Reescribir la frase es cosa de la progresión (fase 3), y esa se decide
 * mirando el informe que deja esto.
 *
 *   npm run rellenar-carga                 # ensayo en seco, no toca nada
 *   npm run rellenar-carga -- --aplicar    # escribe
 *   npm run rellenar-carga -- --fecha 2026-08-11 --informe ../informe.json
 */

const args = process.argv.slice(2)
const aplicar = args.includes('--aplicar')
const fecha = valorDe('--fecha') ?? '2026-08-11'
const rutaInforme = valorDe('--informe')

function valorDe(bandera) {
  const i = args.indexOf(bandera)
  return i >= 0 ? args[i + 1] : undefined
}

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
for (const [nombre, valor] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`)
    process.exit(1)
  }
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

/**
 * Decide qué campos se le añaden a un ejercicio.
 *
 * Cuatro destinos, y solo el primero y el segundo escriben algo:
 *
 * - `rellena`   — cabecera con kilos: se separan carga, unidad y nota.
 * - `ondulada`  — la carga vive en `seriesPrescritas`; solo se separa la nota.
 * - `sin-carga` — porcentajes, «REGISTRA TU CARGA», tiempo, metros, peso
 *                 corporal. **No hay kilos que separar**, y forzarlos sería
 *                 inventárselos. Se deja intacto.
 * - `revisar`   — tiene pinta de llevar carga y no se pudo leer. A mano.
 */
function decidir(ejercicio) {
  const texto = typeof ejercicio.prescripcion === 'string' ? ejercicio.prescripcion : ''

  if (Array.isArray(ejercicio.seriesPrescritas) && ejercicio.seriesPrescritas.length > 0) {
    const { reconocida, notaCoach } = parsearOndulada(texto)
    if (!reconocida) return { destino: 'revisar', motivo: 'ondulado con cabecera no reconocida' }
    return { destino: 'ondulada', campos: { notaCoach } }
  }

  const r = parsearPrescripcion(texto)
  if (r.reconocida) {
    return {
      destino: 'rellena',
      campos: { cargaKg: r.cargaKg, unidadCarga: r.unidadCarga, notaCoach: r.notaCoach },
    }
  }

  // Sin cabecera legible. ¿Menciona kilos igualmente? Entonces es un caso raro
  // que hay que mirar, no un ejercicio sin carga.
  return /\d\s*KG/i.test(texto)
    ? { destino: 'revisar', motivo: 'menciona KG fuera de la cabecera' }
    : { destino: 'sin-carga' }
}

const { data: filas, error } = await sb
  .from('microciclos')
  .select('id, usuario_id, numero, estado, datos')
  .eq('estado', 'activo')

if (error) {
  console.error('No se pudieron leer los microciclos:', error.message)
  process.exit(1)
}

const objetivo = filas.filter((f) => f.datos?.fechaInicio === fecha)

const resumen = { rellena: 0, ondulada: 0, 'sin-carga': 0, revisar: 0 }
const paraRevisar = []
const cambiosDeTexto = []
const actualizaciones = []

for (const fila of objetivo) {
  let tocado = false
  const sesiones = (fila.datos.sesiones ?? []).map((sesion) => ({
    ...sesion,
    ejercicios: (sesion.ejercicios ?? []).map((ejercicio) => {
      const { destino, campos, motivo } = decidir(ejercicio)
      resumen[destino] += 1

      if (destino === 'revisar') {
        paraRevisar.push({
          microciclo: fila.id,
          ejercicioId: ejercicio.id,
          motivo,
          prescripcion: ejercicio.prescripcion,
        })
        return ejercicio
      }
      if (destino === 'sin-carga') return ejercicio

      const nuevo = { ...ejercicio, ...campos }

      // Red de seguridad: componer desde los campos tiene que devolver la misma
      // frase. Si no coincide, se guardan los campos igual —el texto no se
      // toca— pero queda anotado, porque la fase 3 sí regenera la frase y ahí
      // esa diferencia se le vería al asesorado.
      const recompuesta = componerPrescripcion(nuevo)
      if (recompuesta !== ejercicio.prescripcion) {
        cambiosDeTexto.push({
          microciclo: fila.id,
          ejercicioId: ejercicio.id,
          antes: ejercicio.prescripcion,
          compondria: recompuesta,
        })
      }

      tocado = true
      return nuevo
    }),
  }))

  if (tocado) actualizaciones.push({ id: fila.id, datos: { ...fila.datos, sesiones } })
}

console.log(`\nMicrociclos activos con fechaInicio ${fecha}: ${objetivo.length}`)
console.log(`Ejercicios: ${Object.values(resumen).reduce((a, b) => a + b, 0)}`)
console.table(resumen)
console.log(`Microciclos que se actualizarían: ${actualizaciones.length}`)
console.log(`Ejercicios a revisar a mano: ${paraRevisar.length}`)
console.log(`Frases que la fase 3 escribiría distinto: ${cambiosDeTexto.length}`)

if (rutaInforme) {
  await writeFile(rutaInforme, JSON.stringify({ resumen, paraRevisar, cambiosDeTexto }, null, 2))
  console.log(`\nInforme detallado en ${rutaInforme}`)
} else if (paraRevisar.length > 0) {
  console.log('\nPara revisar (usa --informe para el detalle completo):')
  for (const r of paraRevisar.slice(0, 10)) console.log(`  · ${r.ejercicioId} — ${r.motivo}`)
}

if (!aplicar) {
  console.log('\nENSAYO EN SECO. Nada se escribió. Añade --aplicar para escribir.\n')
  process.exit(0)
}

let escritos = 0
for (const upd of actualizaciones) {
  const { error: e } = await sb.from('microciclos').update({ datos: upd.datos }).eq('id', upd.id)
  if (e) {
    console.error(`Falló ${upd.id}: ${e.message}`)
    process.exit(1)
  }
  escritos += 1
}
console.log(`\n${escritos} microciclos actualizados.\n`)
