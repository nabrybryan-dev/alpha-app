/**
 * Parte el objetivo del bloque en piezas que se puedan leer de un vistazo.
 *
 * EL PROBLEMA. `perfil.objetivos` es un campo de texto libre y en la práctica
 * llega de dos formas: un párrafo de 110–650 caracteres, o —en las altas
 * nuevas— hasta 2.600 caracteres separados por `||`. La tarjeta lo pintaba tal
 * cual, así que la persona abría su plan y se encontraba un muro. Es
 * exactamente lo que el handoff del rediseño venía a arreglar: «nadie lo lee».
 *
 * NO SE REESCRIBE NADA. Se corta por donde el coach ya cortó (`||`) y se
 * reconoce la etiqueta que él mismo puso (`PASOS:`, `SUEÑO:`, `RODILLA:`). Si
 * no hay ni separadores ni etiquetas, sale un solo bloque de texto — igual que
 * antes, pero recortable. Inventar secciones donde no las hay sería peor.
 */

export interface SeccionObjetivo {
  /** La etiqueta que escribió el coach («PASOS»), si la hay. */
  etiqueta?: string
  texto: string
}

export interface ObjetivosDelBloque {
  /** El titular del bloque: «BLOQUE 1 · GANANCIA DE MASA MAGRA». */
  titular?: string
  /** Lo que seguía al titular en el primer segmento. */
  entrada?: string
  secciones: SeccionObjetivo[]
}

/** Una etiqueta es un arranque EN MAYÚSCULAS antes de dos puntos. El límite de
 *  largo es generoso porque el coach escribe cosas como «M1 ES UN MICROCICLO DE
 *  CALIBRACIÓN:»; lo que evita falsos positivos son las mayúsculas, no el largo. */
const RE_ETIQUETA = /^([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .·/%-]{1,44}):\s+/

/** El titular va antes de un guion largo y no lleva punto. */
const RE_TITULAR = /^([^—.]{4,90})\s+—\s+/

export function objetivosDelBloque(objetivos: string | undefined): ObjetivosDelBloque {
  const limpio = (objetivos ?? '').trim()
  if (!limpio) return { secciones: [] }

  const trozos = limpio
    .split('||')
    .map((t) => t.trim())
    .filter(Boolean)

  const [primero, ...resto] = trozos
  const conTitular = RE_TITULAR.exec(primero)
  const titular = conTitular?.[1]?.trim()
  const entrada = (conTitular ? primero.slice(conTitular[0].length) : primero).trim()

  const secciones = resto.map((t) => {
    const m = RE_ETIQUETA.exec(t)
    return m
      ? { etiqueta: m[1].trim(), texto: t.slice(m[0].length).trim() }
      : { texto: t }
  })

  return { titular, entrada: entrada || undefined, secciones }
}
