// Lee `informes/testigo-salon.json` y decide si certifica lo que dice certificar.
// Sale 0 si el acta pasa, 1 si no. Lo usa `comprobar-meta.sh` (paso 2).
//
// Tres exigencias, y cada una nace de un falso verde que ya ocurrio:
//
//   `rama` — el salon tiene DOS ramas legitimas. Un dia de cardio abre el salon con
//   paredes y suelo pero SIN sujeto ni camara, a proposito. Un acta levantada ese dia
//   diria `sujeto: false` por una ausencia correcta, o —peor— podria darse por buena
//   sin haber medido nunca el cuerpo. Solo cierra la meta un acta de `conSujeto`.
//
//   `enLienzo` — el 2-sep el acta daba `sala` e `implementos` en verde mientras
//   `construirSala` y `construirImplementos` no tenian una sola llamada. No mentia:
//   las marcas `data-testigo` estaban puestas en las capas SVG/HTML que se dibujan
//   ENCIMA del lienzo. Se estaba certificando el cartel, no la sala. Los cuatro
//   elementos que son escena tienen que declarar que se midieron sobre el canvas.
//   `letras3D` queda fuera de esa exigencia A PROPOSITO: los rotulos de pared son
//   interfaz sobre la pared, no geometria del motor.
//
//   `ejeW` — que la escalera de cinco peldanos se pinte no prueba nada; el eje puede
//   estar muerto y los botones perfectos. Lo unico que lo prueba es que al pasar de
//   W0 a W4 CAMBIEN pixeles dentro del cuerpo.
import { readFileSync } from 'node:fs'

const ACTA = 'informes/testigo-salon.json'
/** Los cinco del §5 de SEMANA-2.md. Si falta uno, no esta. */
const CLAVES = ['sala', 'letras3D', 'sujeto', 'camara', 'implementos']
/** Los que son geometria del motor y por tanto se miden sobre el canvas. */
const DE_ESCENA = ['sala', 'sujeto', 'camara', 'implementos']

/**
 * EL SUELO DE «SE VE», en tanto por uno del cuadro.
 *
 * Superar el ruido de fondo prueba que una pieza SE DIBUJA. No prueba que se VEA, y el
 * §5 de `SEMANA-2.md` pide lo segundo: las cinco cosas a la vez, sin scroll y sin tocar
 * nada. El 2-sep el acta daba `implementos` en verde con 36 píxeles de 304.704 —el
 * 0,01 % de la pantalla, una mota— y `camara` con 302. Las dos ganaban al ruido por unas
 * decenas de píxeles y ninguna de las dos se ve.
 *
 * EL NÚMERO SALE DE MIRAR, no de elegirlo redondo. Nació en 0,25 % a ojo y se corrigió
 * el mismo día contra tres retratos de piezas sueltas (`--sin-partes` + `--foto`):
 *
 * - a 36 px la prensa era invisible en la foto: no había nada que señalar;
 * - a 497 px la estación se distingue como un objeto pequeño al fondo a la izquierda;
 * - a 14.081 px la prensa se lee como una máquina.
 *
 * Así que el listón va donde separa «no está» de «se distingue», que es lo que el §5 pide
 * —ver las cinco cosas—, y no donde separa «se distingue» de «domina el cuadro». Un
 * décimo de punto son ~305 px en un 414x736.
 *
 * Sigue siendo discutible y por eso está aquí solo, con su motivo: subirlo o bajarlo es
 * una decisión de Bryan, no un ajuste que se hace de pasada dentro de otro cambio.
 */
const SUELO_DE_VISIBLE = 0.001

let acta
try {
  acta = JSON.parse(readFileSync(ACTA, 'utf8'))
} catch (e) {
  console.log(`  FALLA ${ACTA} no se puede leer: ${e.message}`)
  process.exit(1)
}

let mal = 0
const falla = (m) => {
  console.log(`  FALLA ${m}`)
  mal++
}
const paso = (m) => console.log(`  OK    ${m}`)

if (acta.pestanaVisible !== true) falla('pestanaVisible no es true')
if (acta.formato !== '9:16') falla(`formato no es 9:16 (${acta.formato})`)
if (acta.rama !== 'conSujeto') {
  falla(`rama es "${acta.rama}": un dia sin sujeto no cierra esta meta`)
} else {
  paso('rama conSujeto')
}

for (const clave of CLAVES) {
  const e = (acta.elementos || {})[clave]
  if (!e || e.visible !== true || !(e.pixeles > 0)) {
    falla(`${clave}: ${JSON.stringify(e)}`)
    continue
  }
  if (DE_ESCENA.includes(clave) && e.enLienzo !== true) {
    falla(`${clave} visible pero enLienzo=${e.enLienzo}: eso es la capa de encima, no la escena`)
    continue
  }
  const cuadro = (acta.viewport?.ancho ?? 0) * (acta.viewport?.alto ?? 0)
  const suelo = Math.round(cuadro * SUELO_DE_VISIBLE)
  if (DE_ESCENA.includes(clave) && cuadro > 0 && e.pixeles < suelo) {
    falla(
      `${clave} solo pone ${e.pixeles} px de ${cuadro} (${((e.pixeles / cuadro) * 100).toFixed(2)} %): ` +
        `se dibuja, pero por debajo de ${suelo} px no se VE`,
    )
    continue
  }
  paso(`${clave} ${e.pixeles} px${DE_ESCENA.includes(clave) ? ' en el lienzo' : ''}`)
}

const w = acta.ejeW
if (!w || !(w.cambioEnSujeto > 0)) {
  falla(`ejeW: ${JSON.stringify(w)} — atravesar W0→W4 no cambio un solo pixel del cuerpo`)
} else if (w.desde !== 0 || w.hasta !== 4) {
  falla(`ejeW recorrio ${w.desde}→${w.hasta}, y el contrato es 0→4`)
} else {
  paso(`ejeW ${w.desde}→${w.hasta}: ${w.cambioEnSujeto} px del cuerpo cambian`)
}

if (acta.cuando) console.log(`  (acta del ${acta.cuando}, usuario ${acta.usuario || '?'}, sesion ${acta.sesion || '?'})`)
process.exit(mal > 0 ? 1 : 0)
