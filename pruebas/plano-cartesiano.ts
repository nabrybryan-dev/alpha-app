import { accionesDelPatron, segmentosDe } from '../src/domain/patrones/acciones'
import { PATRON_POR_ID, type Patron } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase, trazaDelPatron } from '../src/domain/patrones/escena'
import { brazosDeMomento } from '../src/domain/biomecanica/brazosDeMomento'
import { planDeMedida } from '../src/domain/biomecanica/palancas'
import { implementoDe } from '../src/domain/biomecanica/implementos'

/**
 * EL PLANO CARTESIANO DE UN PATRÓN: cuánto se mueve cada cosa, y contra qué.
 *
 * Es la hoja que hay que poder enseñar de cada ficha nueva del catálogo, y **no lleva
 * ni un número escrito a mano**: los tres bloques salen de los tres módulos que ya
 * existían, cada uno preguntado en su idioma.
 *
 * | Bloque | De dónde sale | Qué contesta |
 * | --- | --- | --- |
 * | Desplazamiento articular | `accionesDelPatron` + `segmentosDe` | cuántos grados recorre cada eje de cada articulación, en qué plano, y **qué segmento se mueve sobre cuál** |
 * | Trayectoria | `trazaDelPatron` | por dónde pasa el punto que el patrón declara seguir, en metros de mundo, y cuánto sube y cuánto deriva |
 * | Brazo de momento | `planDeMedida` + `brazosDeMomento` | la distancia horizontal del eje a la vertical de la carga, fase a fase: el brazo de la palanca |
 *
 * ## Los ejes, y por qué el plano no siempre es el mismo
 *
 * El mundo del salón tiene el sujeto mirando a **+Z** y su plano sagital en **X = 0**.
 * Así que, en coordenadas de mundo:
 *
 * - **Y** es la altura. Es contra la que tira la gravedad, y por eso el recorrido
 *   vertical es el que dice si un gesto levanta algo o solo lo pasea.
 * - **Z** es el eje adelante/atrás: la deriva SAGITAL. En cadena cerrada con peso
 *   libre tiene que ser pequeña frente a la vertical —lo comprueba
 *   `demandaDeTrayectoria`—, porque si la carga se fuera de lado el conjunto se
 *   caería.
 * - **X** es el eje izquierda/derecha: la deriva FRONTAL. En casi todo el catálogo es
 *   cero, y donde NO lo es, es el dato principal: una rotación de cadera no sube nada
 *   y no va a ninguna parte hacia delante — barre en X, y por eso su cámara mira desde
 *   arriba y no de perfil.
 *
 * La razón `deriva / vertical` es la que separa un levantamiento de un barrido, y no
 * hay que interpretarla sin mirar antes qué implemento hay: la ley de la deriva es de
 * la gravedad, así que solo aplica al peso libre. Con polea manda el cable y con
 * máquina manda el raíl, que es lo que dice `distanciaHorizontalVale` en el perfil del
 * implemento.
 *
 * ## Qué NO dice esta hoja
 *
 * Fuerza en newtons. El brazo de momento es la mitad geométrica del par —la otra mitad
 * es la carga, que la pone el asesorado y no vive en el patrón—, así que aquí sale la
 * PALANCA, no el momento. Un brazo de 22 cm dice que a igualdad de peso ese punto pide
 * el doble que uno de 11; no dice cuántos newton-metro son. Y el brazo sale vacío
 * cuando la línea de fuerza la fija un cable, porque entonces la distancia horizontal
 * mide el sitio de la polea, no al atleta (`perfiles-de-resistencia.md` §2.1).
 */

export type Vec3 = readonly [number, number, number]

export interface EjeMedido {
  accion: string
  plano: string
  desde: number
  hasta: number
  recorrido: number
}

export interface ArticulacionMedida {
  nombre: string
  rol: string
  /** El segmento que se mueve EN ESTE EJERCICIO, y el que hace de punto fijo. */
  movil: string
  fijo: string
  ejes: EjeMedido[]
}

export interface TrazaMedida {
  hueso: string
  /** Sube y baja: recorrido del punto seguido en el eje vertical, en cm. */
  vertical: number
  /** Adelante y atrás, en cm. */
  sagital: number
  /** Izquierda y derecha, en cm. */
  frontal: number
  /** La mayor de las dos derivas partida por la vertical. Sin vertical, `Infinity`. */
  razon: number
  puntos: Vec3[]
}

export interface BrazoMedido {
  articulacion: string
  protagonismo: string
  /** Centímetros en cada una de las cinco fases muestreadas. */
  porFase: number[]
}

export interface PlanoDePatron {
  id: string
  titulo: string
  categoria: string
  cadena: string
  apoyo: string
  /** El primer ejemplo de la ficha: es el que decide el implemento. */
  ejemplo: string
  implemento: string
  /** De dónde sale la línea contra la que se mide el brazo, o por qué no hay. */
  linea: string
  articulaciones: ArticulacionMedida[]
  traza: TrazaMedida | undefined
  brazos: BrazoMedido[]
}

export const FASES = [0, 0.25, 0.5, 0.75, 1]

const cm = (metros: number): number => Math.round(metros * 1000) / 10

function recorridoEn(puntos: Vec3[], eje: 0 | 1 | 2): number {
  const valores = puntos.map((p) => p[eje])
  return Math.max(...valores) - Math.min(...valores)
}

/** El primer ejemplo de la ficha, que es el nombre con el que se pregunta al modelo. */
export function primerEjemplo(patron: Patron): string {
  return patron.ejemplos.split('·')[0].trim()
}

export function planoDe(patron: Patron): PlanoDePatron {
  const ejemplo = primerEjemplo(patron)

  const articulaciones: ArticulacionMedida[] = accionesDelPatron(patron)
    .filter((r) => r.acciones.length > 0)
    .map((r) => {
      const { movil, fijo } = segmentosDe(patron, r.articulacion.id)
      return {
        nombre: r.articulacion.nombre,
        rol: r.rol,
        movil,
        fijo,
        ejes: r.acciones.map((a) => ({
          accion: a.accion,
          plano: a.eje.plano,
          desde: Math.round(a.desde),
          hasta: Math.round(a.hasta),
          recorrido: Math.round(a.recorrido),
        })),
      }
    })

  const puntos = (trazaDelPatron(patron) ?? []) as Vec3[]
  let traza: TrazaMedida | undefined
  if (patron.seguimiento && puntos.length > 0) {
    const vertical = recorridoEn(puntos, 1)
    const sagital = recorridoEn(puntos, 2)
    const frontal = recorridoEn(puntos, 0)
    traza = {
      hueso: patron.seguimiento[0],
      vertical: cm(vertical),
      sagital: cm(sagital),
      frontal: cm(frontal),
      razon: vertical === 0 ? Infinity : Math.round((Math.max(sagital, frontal) / vertical) * 100) / 100,
      puntos,
    }
  }

  const plan = planDeMedida(patron.categoria, ejemplo)
  const brazos: BrazoMedido[] = []
  if (plan) {
    const acumulado = new Map<string, { protagonismo: string; porFase: number[] }>()
    for (const fase of FASES) {
      for (const b of brazosDeMomento(esqueletoEnFase(patron, fase), plan)) {
        const fila = acumulado.get(b.articulacion) ?? { protagonismo: b.protagonismo, porFase: [] }
        fila.porFase.push(cm(b.metros))
        acumulado.set(b.articulacion, fila)
      }
    }
    for (const [articulacion, fila] of acumulado) {
      brazos.push({ articulacion, protagonismo: fila.protagonismo, porFase: fila.porFase })
    }
  }

  return {
    id: patron.id,
    titulo: patron.titulo,
    categoria: patron.categoria,
    cadena: patron.cadena,
    apoyo: patron.apoyo,
    ejemplo,
    implemento: implementoDe(ejemplo) ?? 'sin declarar',
    linea: plan ? plan.linea.origen : 'sin modelo de palanca',
    articulaciones,
    traza,
    brazos,
  }
}

export function planoDeId(id: string): PlanoDePatron {
  const patron = PATRON_POR_ID[id]
  if (!patron) throw new Error(`no existe el patrón ${id}`)
  return planoDe(patron)
}

/** La hoja de un patrón, en texto, para pegarla en un informe o leerla en la consola. */
export function hojaDe(plano: PlanoDePatron): string {
  const lineas: string[] = []
  lineas.push(`### ${plano.titulo} · \`${plano.id}\``)
  lineas.push('')
  lineas.push(
    `Categoría **${plano.categoria}** · cadena **${plano.cadena}** · apoyo **${plano.apoyo}** · ` +
      `ejemplo «${plano.ejemplo}» → implemento **${plano.implemento}** · línea de fuerza: **${plano.linea}**`,
  )
  lineas.push('')
  lineas.push('| Articulación | Papel | Se mueve | Sobre | Acción | Plano | Desde → hasta | Recorrido |')
  lineas.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const a of plano.articulaciones) {
    for (const [i, e] of a.ejes.entries()) {
      lineas.push(
        `| ${i === 0 ? a.nombre : ''} | ${i === 0 ? a.rol : ''} | ${i === 0 ? a.movil : ''} | ` +
          `${i === 0 ? a.fijo : ''} | ${e.accion} | ${e.plano} | ${e.desde}° → ${e.hasta}° | ${e.recorrido}° |`,
      )
    }
  }
  lineas.push('')
  if (plano.traza) {
    const t = plano.traza
    lineas.push(
      `**Trayectoria de \`${t.hueso}\`** — vertical (Y) ${t.vertical} cm · sagital (Z) ${t.sagital} cm · ` +
        `frontal (X) ${t.frontal} cm · razón deriva/vertical ${t.razon === Infinity ? '∞' : t.razon}`,
    )
  } else {
    lineas.push('**Sin trayectoria declarada**: el patrón no sigue ningún punto.')
  }
  lineas.push('')
  if (plano.brazos.length === 0) {
    lineas.push(`**Brazo de momento**: no se mide (${plano.linea}).`)
  } else {
    lineas.push('| Eje | Protagonismo | Brazo por fase (cm): 0 · 0,25 · 0,5 · 0,75 · 1 |')
    lineas.push('| --- | --- | --- |')
    for (const b of plano.brazos) {
      lineas.push(`| ${b.articulacion} | ${b.protagonismo} | ${b.porFase.join(' · ')} |`)
    }
  }
  return lineas.join('\n')
}

export function informeDelPlano(ids: string[]): string {
  return ids.map((id) => hojaDe(planoDeId(id))).join('\n\n')
}
