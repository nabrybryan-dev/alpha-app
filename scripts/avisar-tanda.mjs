/**
 * Deja UNA línea en `notificaciones.log` cuando una tanda de la revisión semanal no publica.
 *
 *     npm run avisar-tanda -- --semana 2026-10-19 --fase manana --paso "3 publicar" --motivo "..." [--codigo 3]
 *
 * Lo llama `revision-semanal-viernes.ps1` desde un solo sitio (su función `Falla`), de modo que
 * TODA salida con error de la cadena —guiones, voz, publicación, firma— deja su aviso. Nunca
 * falla: si no puede escribir, lo dice y sale con 0 (el aviso de un fallo no puede ser otro fallo).
 */
import process from 'node:process'
import { avisarABryan } from './lib/aviso-a-bryan.mjs'

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

async function main() {
  const args = argumentos()
  const semana = String(args.semana || 'sin-semana')
  const fase = String(args.fase || 'sin-fase')
  const paso = String(args.paso || 'sin-paso')
  const motivo = String(args.motivo || 'sin motivo escrito')
  const codigo = args.codigo === undefined ? '' : ` (código ${args.codigo})`

  const escribio = await avisarABryan({
    // Un id por semana, fase y paso: la misma caída repetida el mismo día no llena el archivo.
    id: `revision-semanal-${semana}-${fase}-${paso.replace(/\s+/g, '-')}`,
    tipo: 'revision_semanal_sin_publicar',
    mensaje: `Revisión semanal de la semana del ${semana} (fase ${fase}): NO publicó. Paso ${paso}${codigo}: ${motivo}`,
    urgente: false,
  })
  console.log(escribio ? 'Aviso a Bryan escrito en notificaciones.log.' : 'Aviso a Bryan: ya estaba escrito o no se pudo escribir.')
}

main()
  .catch((e) => console.log(`Aviso a Bryan: no se pudo escribir (${e.message}).`))
  .finally(() => process.exit(0))
