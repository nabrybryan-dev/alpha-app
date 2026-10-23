// Corre el dominio sobre las poses de scripts/poses-sentadilla.json y vuelca los tres momentos.
import { readFileSync } from 'node:fs'
import { momentosDeSentadilla } from '../src/domain/sujeto/dinamica'

const poses = JSON.parse(readFileSync('scripts/poses-sentadilla.json', 'utf8'))
const salida = poses.map((p: any) => {
  const r = momentosDeSentadilla({ sexo: p.sexo, talla: p.talla, masa: p.masa, cargaKg: p.carga, pose: p.pose })
  return { nombre: p.nombre, tobillo: r.tobillo.valor, rodilla: r.rodilla.valor, cadera: r.cadera.valor }
})
console.log(JSON.stringify(salida, null, 1))
