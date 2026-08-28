/**
 * El sujeto ejerciendo, articulación por articulación, sus acciones propias.
 *
 * Un patrón de entrenamiento mezcla varias articulaciones a la vez, y eso es lo
 * que hay que entender al final. Pero antes hay que ver **una sola cosa
 * moviéndose**: el codo flexionando de 0° a 152° y nada más, con el resto del
 * cuerpo quieto, mirado desde el plano en el que ese movimiento ocurre.
 *
 * Cada demostración es un `Patron` sintético, así que reutiliza todo lo que ya
 * existe —el retardo distal, el acortamiento muscular, el arco del movimiento,
 * la cámara orbital— sin una sola línea de render nueva.
 *
 * La cámara se coloca **perpendicular al plano de la acción**: una flexión se
 * mira de perfil y una abducción de frente. Verla desde el ángulo equivocado es
 * la forma más rápida de no entender un movimiento.
 */

import { porcionesQueCruzan } from './acciones'
import { esqueletoEnFase } from './escena'
import { puntoDeHueso } from './esqueleto'
import { ARTICULACIONES, type Articulacion, type EjeArticular, type Plano } from './articulaciones'
import type { Patron } from './catalogo'
import type { Activacion } from './musculos'
import type { Pose } from './esqueleto'
import { INDICE_HUESO } from './esqueleto'
import { clavePorcion } from './anatomia'

/**
 * Desde dónde se mira cada plano.
 *
 * El sagital de perfil, el frontal de frente y el transverso desde arriba, que
 * es la única forma de ver un giro.
 */
const CAMARA_POR_PLANO: Record<Plano, { azimut: number; elevacion: number }> = {
  sagital: { azimut: 88, elevacion: 6 },
  frontal: { azimut: 2, elevacion: 6 },
  transverso: { azimut: 24, elevacion: 62 },
}

/**
 * Cuánto del rango se recorre en la demostración.
 *
 * No se llega al tope absoluto: los últimos grados de cualquier articulación
 * los sujeta el ligamento y no el músculo, y enseñarlos como si fueran
 * recorrido de trabajo invitaría a buscarlos con carga.
 */
const MARGEN_LIGAMENTO = 0.92

/** Un lado nada más: aislar se entiende mejor que duplicar. */
const LADO_DEMO = 'D'

/**
 * La postura de estudio: dónde se coloca el cuerpo para que la articulación
 * se vea.
 *
 * Con el brazo colgando, la muñeca queda pegada a la cadera y mirarla de perfil
 * es mirar a través del muslo. No se arregla moviendo la cámara —el cuerpo
 * sigue delante—, sino separando el segmento, que es como se enseña.
 *
 * Es puesta en escena, no anatomía: coloca lo que NO se estudia y no toca el
 * canal que recorre, así que la demostración sigue aislando una sola cosa.
 */
const POSTURA_DE_ESTUDIO: Record<string, Pose> = {
  codo: { ['hombroAbd' + LADO_DEMO]: 38 },
  radiocubital: { ['hombroAbd' + LADO_DEMO]: 38, ['codoFlex' + LADO_DEMO]: 82 },
  muneca: { ['hombroAbd' + LADO_DEMO]: 46, ['codoFlex' + LADO_DEMO]: 24 },
}

/**
 * Los huesos del eje —columna, cráneo, pelvis— son únicos y sus canales no
 * llevan sufijo de lado. Escribir `lumbarFlexD` no da error: simplemente no lo
 * lee nadie y la demostración se queda quieta.
 */
const esPar = (hueso: string): boolean => INDICE_HUESO[hueso + LADO_DEMO] !== undefined

const ladoDe = (articulacion: Articulacion): string =>
  esPar(articulacion.huesoDistal) ? LADO_DEMO : ''

export interface Demostracion {
  id: string
  articulacion: Articulacion
  eje: EjeArticular
  patron: Patron
}

function activacionDe(articulacion: Articulacion): Activacion {
  const salida: Activacion = {}
  const lado = ladoDe(articulacion)
  // Se encienden todas las porciones que cruzan la articulación, no solo la que
  // hace la acción: se ve a la vez la que se acorta y la que se estira, que es
  // lo que explica el gesto.
  for (const { musculo, porcion } of porcionesQueCruzan(articulacion)) {
    const clave = clavePorcion(musculo.id, porcion.id)
    salida[lado ? `${clave}:${lado}` : clave] = 1
  }
  return salida
}

/**
 * El hueso cuya punta traza el arco del movimiento: el que está justo por
 * debajo de la articulación, porque es el que se mueve.
 */
function seguimientoDe(articulacion: Articulacion, eje: EjeArticular): Patron['seguimiento'] {
  // Una rotación axial no desplaza los puntos que están SOBRE el eje, así que
  // trazar la punta del hueso daría un arco de longitud cero. Se desplaza el
  // punto hacia fuera para que el giro se vea como lo que es.
  const desvio: [number, number, number] = eje.plano === 'transverso' ? [0.09, 0, 0] : [0, 0, 0]
  return [articulacion.huesoDistal, 1, desvio]
}

/**
 * La cámara va del lado del segmento que se estudia.
 *
 * El brazo derecho vive en x negativo, y la cámara sagital estaba fija en x
 * positivo: el tórax quedaba justo en medio y se veía un amasijo de costillas
 * con la mano detrás. No se arregla acercándose ni alejándose —el cuerpo sigue
 * delante—, sino rodeando al sujeto hasta el lado por el que se ve.
 *
 * Los huesos del eje quedan en la línea media y les da igual: ahí el azimut se
 * deja como está.
 */
function azimutHaciaElSegmento(patron: Patron, articulacion: Articulacion, azimut: number): number {
  const lado = ladoDe(articulacion)
  if (!lado) return azimut
  const esq = esqueletoEnFase(patron, 0.5)
  const x = puntoDeHueso(esq, articulacion.huesoDistal + lado, 0.5)[0]
  if (Math.abs(x) < 0.08) return azimut
  // El azimut positivo mira desde x positivo: si el segmento está al otro lado,
  // se cruza al suyo.
  return Math.sign(x) === Math.sign(Math.sin((azimut * Math.PI) / 180)) ? azimut : -azimut
}

/** Una demostración: esa articulación, ese eje, y el resto del cuerpo quieto. */
export function demostracion(articulacion: Articulacion, eje: EjeArticular): Demostracion {
  const [min, max] = eje.rango
  const canal = eje.canal + ladoDe(articulacion)
  // La postura no puede pisar el canal que se estudia: si el eje elegido es
  // uno de los que coloca, manda el recorrido.
  const postura: Pose = { ...POSTURA_DE_ESTUDIO[articulacion.id] }
  delete postura[canal]
  const desde = min * MARGEN_LIGAMENTO
  const hasta = max * MARGEN_LIGAMENTO

  const patron: Patron = {
    id: `demo-${articulacion.id}-${eje.canal}`,
    // No es una categoría de ejercicio: estas demostraciones no se buscan por
    // categoría, se eligen a mano desde el explorador.
    categoria: '',
    titulo: `${articulacion.nombre}: ${eje.positivo.toLowerCase()} y ${eje.negativo.toLowerCase()}`,
    // Una demostración no es un ejercicio: no hay nada que listar aquí, y qué
    // hueso se mueve sobre cuál ya lo dice el desglose articular.
    ejemplos: '',
    resumen:
      `${eje.positivo} y ${eje.negativo.toLowerCase()} en el ` +
      `${eje.plano === 'sagital' ? 'plano sagital' : eje.plano === 'frontal' ? 'plano frontal' : 'plano transverso'}, ` +
      `con un recorrido de ${Math.round(Math.abs(max - min))}° en total. ` +
      'Se enciende toda la musculatura que cruza la articulación: se ve a la vez ' +
      'la que se acorta y la que se estira.',
    // Sin claves ni errores: no es un ejercicio. Los límites de la articulación
    // los cuenta el desglose, y repetirlos aquí sería decirlo dos veces.
    claves: [],
    errores: [],
    // Flotando: el sujeto no se apoya en nada, para que nada distraiga del
    // segmento que se mueve.
    apoyo: 'ninguno',
    // Abierta: el sujeto flota y el segmento distal va libre, que es justo lo
    // que se quiere para estudiar la articulación sola. En un ejercicio de
    // verdad la cadena la decide el ejercicio, no la articulación.
    cadena: 'abierta',
    pies: [],
    raizInicio: [0, 0.95, 0],
    raizFin: [0, 0.95, 0],
    // El recorrido va del tope negativo al positivo, así que la demostración
    // enseña la acción y su contraria en la misma repetición. La postura va en
    // las dos poses con el mismo valor: coloca, no recorre.
    inicio: { ...postura, [canal]: desde },
    fin: { ...postura, [canal]: hasta },
    activacion: activacionDe(articulacion),
    seguimiento: seguimientoDe(articulacion, eje),
    camara: CAMARA_POR_PLANO[eje.plano],
    // Primer plano de la articulación. Sin esto manda el encuadre por
    // musculatura, y como aquí se enciende todo lo que la cruza —que en el codo
    // nace en la escápula y llega a la mano— el sujeto salía entero y de lejos.
    foco: articulacion.huesoDistal + ladoDe(articulacion),
  }

  // El azimut se decide con el cuerpo ya colocado, así que hace falta el patrón
  // construido para poder resolverlo.
  const camara = {
    ...patron.camara,
    azimut: azimutHaciaElSegmento(patron, articulacion, patron.camara.azimut),
  }
  return { id: patron.id, articulacion, eje, patron: { ...patron, camara } }
}

/** Todas las acciones que el sujeto puede ejercer, articulación por articulación. */
export const DEMOSTRACIONES: Demostracion[] = ARTICULACIONES.flatMap((articulacion) =>
  articulacion.ejes.map((eje) => demostracion(articulacion, eje)),
)

export const DEMOSTRACION_POR_ID: Record<string, Demostracion> = Object.fromEntries(
  DEMOSTRACIONES.map((d) => [d.id, d]),
)

/** Las demostraciones de una articulación concreta. */
export function demostracionesDe(articulacionId: string): Demostracion[] {
  return DEMOSTRACIONES.filter((d) => d.articulacion.id === articulacionId)
}
