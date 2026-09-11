/**
 * EL PRESS MILITAR, MEDIDO: dónde está el codo, en qué plano sube y si el antebrazo va vertical.
 *
 * Bryan, 2026-09-07: «la flexión de hombro se debe dar en un plano escapular alineado con el
 * codo; el codo debe mantener una flexión e irse extendiendo a medida que sube, y además
 * debe haber una breve aducción horizontal». Tres cosas medibles:
 *
 * 1. El AZIMUT del húmero respecto al plano frontal (0° = codos en cruz, 90° = codos al
 *    frente; positivo = hacia delante, que en este rig es +Z). El plano escapular está a
 *    unos 30°; la breve aducción horizontal lo lleva más allá a media subida.
 * 2. La ELEVACIÓN del húmero (0° = brazo caído, 180° = vertical sobre la cabeza).
 * 3. El ANTEBRAZO respecto a la vertical: en un press el antebrazo va vertical, con la mano
 *    encima del codo, en todo el recorrido. Y las manos a la anchura de una barra.
 *
 * Lo que se aprendió del rig midiendo (no de leerlo): `hombroAbd` eleva en el plano frontal,
 * `hombroFlex` gira alrededor del eje X del cuerpo, y `hombroRot` gira alrededor del eje Y
 * del CUERPO —se aplica el último—, así que con el brazo elevado es un barrido horizontal
 * (negativo = hacia delante) y con el brazo vertical es rotación del húmero. El antebrazo
 * flexiona en el plano del húmero y la vertical, y ese plano gira con `hombroRot`, así que
 * un antebrazo vertical sigue vertical al girar.
 *
 *     npx vite-node scripts/medir-press.mjs
 */
import { PATRONES } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'

const g = (r) => (r * 180) / Math.PI
const r1 = (x) => Math.round(x * 10) / 10
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norma = (v) => Math.hypot(v[0], v[1], v[2])
const angulo = (a, b) => g(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (norma(a) * norma(b))))))

const base = PATRONES.find((p) => p.id === 'empuje_vertical')

export function medir(esq) {
  const hombro = puntoDeHueso(esq, 'brazoD', 0)
  const codo = puntoDeHueso(esq, 'brazoD', 1)
  const muneca = puntoDeHueso(esq, 'antebrazoD', 1)
  const mano = puntoDeHueso(esq, 'manoD', 0.5)
  const hombroI = puntoDeHueso(esq, 'brazoI', 0)
  const manoI = puntoDeHueso(esq, 'manoI', 0.5)
  const humero = resta(codo, hombro)
  const antebrazo = resta(muneca, codo)
  const ladoX = Math.sign(hombro[0] - hombroI[0]) || 1
  const lateral = humero[0] * ladoX
  return {
    elevacion: r1(angulo(humero, [0, -1, 0])),
    azimut: r1(g(Math.atan2(humero[2], lateral))),
    antebrazoVsVertical: r1(angulo(antebrazo, [0, 1, 0])),
    codo: r1(angulo([-humero[0], -humero[1], -humero[2]], antebrazo)),
    manoSobreCodo: r1((mano[1] - codo[1]) * 100),
    manoSobreHombro: r1((mano[1] - hombro[1]) * 100),
    manoZ: r1((mano[2] - hombro[2]) * 100),
    anchoManos: r1(Math.abs(mano[0] - manoI[0]) * 100),
  }
}

const conPose = (pose) => esqueletoEnFase({ ...base, inicio: pose, fin: pose, medio: undefined }, 0)
const linea = (m) =>
  `elev ${m.elevacion} · azimut ${m.azimut} · antebrazo/vertical ${m.antebrazoVsVertical} · codo ${m.codo} · mano sobre codo ${m.manoSobreCodo} cm · mano sobre hombro ${m.manoSobreHombro} cm · manoZ ${m.manoZ} cm · manos a ${m.anchoManos} cm`

function fases(patron, titulo) {
  console.log(`\n## ${titulo}`)
  for (const f of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
    console.log(String(f).padEnd(5), linea(medir(esqueletoEnFase(patron, f))))
  }
}

fases(base, 'LA FICHA ACTUAL, por fases')

/**
 * La pose (abd, flex, rot, codo) que más se acerca a una elevación y un azimut CON EL
 * ANTEBRAZO VERTICAL. Los cuatro canales a la vez, porque en este rig no son independientes:
 * con el brazo en cruz, `hombroFlex` gira alrededor del propio húmero (es la rotación
 * externa que pone el antebrazo hacia arriba), y con el brazo caído es la flexión. Primero
 * se filtran los húmeros que caen cerca del objetivo, y solo para esos se barre el codo.
 */
function resolver(E, A) {
  const candidatos = []
  // LA MISMA RUTA EN LAS TRES POSES: abducción pequeña y la elevación por `hombroFlex`. Con
  // rutas distintas (medio por flexión, fin por abducción a 171°) las tres poses eran
  // buenas y la interpolación entre ellas pasaba el brazo por detrás del cuerpo: a la fase
  // 0,75 el codo estaba a −14° de azimut y las manos a 158 cm. Es la ambigüedad de Euler.
  for (let abd = 0; abd <= 30; abd += 3) {
    for (let flex = -20; flex <= 185; flex += 5) {
      for (let rot = -90; rot <= 40; rot += 5) {
        const m = medir(conPose({ hombroAbd: abd, hombroFlex: flex, hombroRot: rot, codoFlex: 90 }))
        if (Math.abs(m.elevacion - E) <= 4 && Math.abs(m.azimut - A) <= 4) candidatos.push({ abd, flex, rot, m })
      }
    }
  }
  let mejor = null
  for (const c of candidatos) {
    for (let codo = 0; codo <= 160; codo += 2) {
      const m = medir(conPose({ hombroAbd: c.abd, hombroFlex: c.flex, hombroRot: c.rot, codoFlex: codo }))
      const coste =
        m.antebrazoVsVertical * 2 +
        Math.abs(m.elevacion - E) +
        Math.abs(m.azimut - A) +
        (m.manoSobreCodo < 0 ? 100 : 0)
      if (!mejor || coste < mejor.coste) mejor = { coste, hombroAbd: c.abd, hombroFlex: c.flex, hombroRot: c.rot, codoFlex: codo, m }
    }
  }
  console.log(`   (${candidatos.length} húmeros candidatos)`)
  return mejor
}

console.log('\n## BARRIDO: canales para cada elevación y azimut, con el antebrazo vertical')
const objetivos = { inicio: [52, 34], medio: [112, 50], fin: [170, 30] }
const poses = {}
for (const [nombre, [E, A]] of Object.entries(objetivos)) {
  const r = resolver(E, A)
  poses[nombre] = r
  console.log(`${nombre} (E=${E}, A=${A}): hombroAbd ${r.hombroAbd} hombroFlex ${r.hombroFlex} hombroRot ${r.hombroRot} codoFlex ${r.codoFlex}\n      → ${linea(r.m)}`)
}

const propuesta = {
  ...base,
  inicio: { hombroAbd: poses.inicio.hombroAbd, hombroFlex: poses.inicio.hombroFlex, hombroRot: poses.inicio.hombroRot, codoFlex: poses.inicio.codoFlex, escapulaElev: 0 },
  medio: { hombroAbd: poses.medio.hombroAbd, hombroFlex: poses.medio.hombroFlex, hombroRot: poses.medio.hombroRot, codoFlex: poses.medio.codoFlex, escapulaElev: 10, toraxFlex: -2 },
  fin: { hombroAbd: poses.fin.hombroAbd, hombroFlex: poses.fin.hombroFlex, hombroRot: poses.fin.hombroRot, codoFlex: poses.fin.codoFlex, escapulaElev: 26, toraxFlex: -4 },
}
console.log('\npropuesta:', JSON.stringify({ inicio: propuesta.inicio, medio: propuesta.medio, fin: propuesta.fin }))
fases(propuesta, 'LA PROPUESTA, por fases (interpolada como la anima la app)')
