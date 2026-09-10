import { IMPLEMENTOS, implementoDe, type Implemento } from '../../../../domain/biomecanica/implementos'
import type { ItemMarcable, Sesion } from '../../../../domain/types'

/**
 * LOS IMPLEMENTOS DE LA SESIÓN: qué hierro hace falta hoy.
 *
 * Es el punto 5 de los cinco del encargo —«los implementos necesarios para esa sesión,
 * alrededor»—. Un salón sin material es un decorado: lo que dice que esto es un gimnasio y
 * no una sala vacía es la barra apoyada, las mancuernas y la polea.
 *
 * ## LA REGLA NO ESTÁ AQUÍ, y esa es la parte importante
 *
 * Qué implemento pide un ejercicio lo decide `domain/biomecanica/implementos.ts` con
 * `implementoDe()`, que es la tabla que ya usa la biomecánica para saber dónde entra la
 * carga, cuántas masas hay y si la distancia horizontal sigue valiendo. Esta capa **no
 * clasifica**: pregunta y cuenta.
 *
 * Esto empezó siendo una lista de términos escrita aquí, y estaba mal por el motivo de
 * siempre: dos sitios decidiendo lo mismo son iguales el primer día y distintos el día que
 * alguien ajuste uno, y nadie lo nota porque los dos siguen enseñando algo creíble. Además
 * la de aquí ya se equivocaba en un caso que la del dominio tiene resuelto y documentado:
 * un «jalón unilateral en polea» clasificado por la palabra «unilateral» pierde la polea.
 *
 * El nombre que se enseña también sale de allí (`IMPLEMENTOS[x].nombre`). Un segundo juego
 * de nombres en la interfaz sería la misma deriva, en pequeño.
 *
 * ## Lo único que decide esta capa: sobre qué se corre
 *
 * Los bloques de cardio no tienen implemento en el dominio, y es correcto que no lo tengan:
 * esa tabla clasifica **implementos de carga** —dónde entra el peso y qué le hace a la
 * medida—, y una cinta no aporta carga. Pero un día de cardio el salón tampoco puede
 * quedarse vacío, así que aquí se reconoce la SUPERFICIE sobre la que se corre. No pisa a
 * la tabla del dominio porque no responde a su pregunta.
 *
 * ## Cuando no se puede saber, se dice
 *
 * Los ejercicios cuyo nombre no delata implemento se cuentan aparte y se enseñan como lo
 * que son. Colgar una barra por defecto sería mandar a alguien a la estación equivocada.
 */

/** Un implemento del salón, con cuántos ejercicios de hoy lo piden. */
export interface ImplementoDelSalon {
  /** La clave con la que se busca su silueta. */
  id: string
  /** Cómo se llama. Sale del dominio para los de carga; de aquí para la superficie. */
  nombre: string
  /** En cuántos ejercicios o bloques de hoy hace falta. */
  ejercicios: number
}

/** La superficie sobre la que se corre. No es un implemento de carga, y por eso vive aquí. */
const PISTA = { id: 'cardio', nombre: 'Cinta o pista' } as const
const TERMINOS_DE_PISTA = /trote|carrera|caminata|correr|cinta|bici|el[ií]ptica|remo ergo|sprint/i

export interface ImplementosDeSesion {
  /** Los implementos deducidos, del más usado al menos. */
  implementos: readonly ImplementoDelSalon[]
  /**
   * Cuántos ejercicios o bloques de hoy no dejan ver su material.
   *
   * Se cuenta y se enseña: un salón que se calla lo que no sabe deducir es un salón que
   * miente por omisión.
   */
  sinDeducir: number
}

/** La ficha del salón para un implemento del dominio. */
function fichaDe(implemento: Implemento): { id: string; nombre: string } {
  return { id: implemento, nombre: IMPLEMENTOS[implemento].nombre }
}

/**
 * Los implementos que hacen falta hoy, con cuántos ejercicios los piden.
 *
 * Mira el nombre de cada ejercicio de fuerza y, cuando la sesión es metabólica, también el
 * título de cada bloque de cardio: una sesión de trote necesita pista o cinta, y dejar el
 * salón sin nada alrededor un día de cardio es lo que hacía que ese día pareciera otra app.
 */
export function implementosDeSesion(sesion: Sesion | undefined): ImplementosDeSesion {
  if (!sesion) return { implementos: [], sinDeducir: 0 }

  const cuenta = new Map<string, ImplementoDelSalon>()
  let sinDeducir = 0

  const anotar = (ficha: { id: string; nombre: string } | undefined) => {
    if (!ficha) {
      sinDeducir += 1
      return
    }
    const previo = cuenta.get(ficha.id)
    cuenta.set(ficha.id, { ...ficha, ejercicios: (previo?.ejercicios ?? 0) + 1 })
  }

  for (const ejercicio of sesion.ejercicios) {
    const implemento = implementoDe(ejercicio.nombre)
    anotar(implemento ? fichaDe(implemento) : undefined)
  }

  for (const bloque of sesion.bloquesCardio ?? []) {
    anotar(TERMINOS_DE_PISTA.test(textoDeBloque(bloque)) ? PISTA : undefined)
  }

  const implementos = [...cuenta.values()].sort(
    (a, b) => b.ejercicios - a.ejercicios || a.nombre.localeCompare(b.nombre),
  )
  return { implementos, sinDeducir }
}

/** El texto donde buscar la superficie de un bloque de cardio. */
function textoDeBloque(bloque: ItemMarcable): string {
  return `${bloque.titulo} ${bloque.indicaciones}`
}
