import { centroDeMasas } from '../patrones/gravedad'
import { puntoDeHueso, type EsqueletoResuelto } from '../patrones/esqueleto'
import type { Vec3 } from '../patrones/algebra'
import type { PlanDeMedida } from './palancas'
import type { Articulacion, Protagonismo } from './tipos'

/**
 * EL BRAZO DE MOMENTO EXTERNO DE CADA EJE, medido sobre el esqueleto resuelto.
 *
 * Es la regla de la que sale toda la tabla de palancas
 * (`perfiles-de-resistencia.md` §2.1): con peso libre la carga tira siempre vertical, así
 * que el brazo de momento externo de una articulación es la **distancia horizontal entre
 * esa articulación y la vertical de la carga**. Ni más ni menos. Aquí se mide sobre el
 * sujeto que se está dibujando —el de la prescripción o el fantasma— para poder DIBUJARLO:
 * un segmento horizontal de la articulación a la vertical de la carga, y un arco en la
 * articulación que barre más cuanto más largo es el brazo.
 *
 * ## Qué ejes
 *
 * Los que el plan de medida declara para ese ejercicio con protagonismo principal o
 * secundario. Los estabilizadores no giran: no tienen brazo que enseñar.
 *
 * ## Qué vertical
 *
 * La del ORIGEN de la línea que dice el plan: la carga externa está en las manos —el
 * punto medio de las dos muñecas—, y en los patrones sin carga la línea es la del centro
 * de masas del propio cuerpo. Con cable no hay vertical: la línea la fija el cable, no la
 * gravedad, y aquí no se dibuja nada antes que dibujar algo falso.
 *
 * ## Qué punto es «la articulación»
 *
 * El arranque del hueso que cuelga de ella (`puntoDeHueso(…, 0)`): la tibia arranca en la
 * rodilla, el muslo en la cadera, el brazo en el hombro. Se toma el punto medio de los dos
 * lados, porque el brazo es una medida en el plano sagital y el segmento va centrado en el
 * cuerpo. Las articulaciones que el rig no tiene como hueso (la escápula) se saltan.
 */
export interface BrazoDeMomento {
  articulacion: Articulacion
  protagonismo: Protagonismo
  /** La articulación, en el mundo. */
  eje: Vec3
  /** El punto de la vertical de la carga a la altura de la articulación. */
  pie: Vec3
  /** La distancia horizontal entre los dos, en metros. */
  metros: number
  /**
   * EL LARGO DEL HUESO QUE CUELGA DE LA ARTICULACIÓN, en metros.
   *
   * Va aquí y no en el dibujo porque es del sujeto, no del estilo: el arco del par se
   * dimensiona con él —un tercio del fémur, de la tibia, del brazo— y así encoge y crece
   * con la persona en pantalla. Con una tabla de centímetros fijos pasaba lo contrario:
   * al doblarse, el cuerpo pasaba de 655 px de alto a 409 y el arco seguía igual, así que
   * el mismo arco pasaba del 6 % de su altura al 16 % y parecía despegarse.
   */
  largo: number
}

/** De la articulación de la tabla al hueso del rig que arranca en ella. */
const HUESO_DE: Partial<Record<Articulacion, { raiz: string; lados: boolean }>> = {
  tobillo: { raiz: 'pie', lados: true },
  rodilla: { raiz: 'tibia', lados: true },
  cadera: { raiz: 'muslo', lados: true },
  lumbar: { raiz: 'lumbar', lados: false },
  hombro: { raiz: 'brazo', lados: true },
  codo: { raiz: 'antebrazo', lados: true },
  muñeca: { raiz: 'mano', lados: true },
}

/** El largo del hueso, en metros: de su arranque a su punta. */
function largoDe(esq: EsqueletoResuelto, raiz: string, lados: boolean): number {
  const nombre = lados ? `${raiz}D` : raiz
  if (!esq.mundo[nombre]) return 0
  const a = puntoDeHueso(esq, nombre, 0)
  const b = puntoDeHueso(esq, nombre, 1)
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

/** El punto medio de dos huesos, o el arranque de uno. `undefined` si el rig no lo tiene. */
function centroDe(esq: EsqueletoResuelto, raiz: string, lados: boolean): Vec3 | undefined {
  if (!lados) return esq.mundo[raiz] ? puntoDeHueso(esq, raiz, 0) : undefined
  if (!esq.mundo[`${raiz}D`] || !esq.mundo[`${raiz}I`]) return undefined
  const d = puntoDeHueso(esq, `${raiz}D`, 0)
  const i = puntoDeHueso(esq, `${raiz}I`, 0)
  return [(d[0] + i[0]) / 2, (d[1] + i[1]) / 2, (d[2] + i[2]) / 2]
}

/** Dónde está la carga: en las manos. */
export function puntoDeCarga(esq: EsqueletoResuelto): Vec3 | undefined {
  return centroDe(esq, 'mano', true)
}

export function brazosDeMomento(esq: EsqueletoResuelto, plan: PlanDeMedida): BrazoDeMomento[] {
  if (plan.linea.origen === 'cable') return []
  const carga = plan.linea.origen === 'centro-de-masas' ? centroDeMasas(esq) : puntoDeCarga(esq)
  if (!carga) return []
  const salida: BrazoDeMomento[] = []
  for (const e of plan.ejes) {
    if (e.protagonismo === 'estabilizador') continue
    const hueso = HUESO_DE[e.articulacion]
    if (!hueso) continue
    const eje = centroDe(esq, hueso.raiz, hueso.lados)
    if (!eje) continue
    const pie: Vec3 = [carga[0], eje[1], carga[2]]
    salida.push({
      articulacion: e.articulacion,
      protagonismo: e.protagonismo,
      eje,
      pie,
      metros: Math.hypot(pie[0] - eje[0], pie[2] - eje[2]),
      largo: largoDe(esq, hueso.raiz, hueso.lados),
    })
  }
  return salida
}
