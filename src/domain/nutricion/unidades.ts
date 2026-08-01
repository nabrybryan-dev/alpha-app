/**
 * Convierte a gramos lo que el asesorado responde sobre aceite y sal (R3).
 *
 * POR QUÉ NO SE PREGUNTA "poco / normal / bastante". Decisión de Bryan, y
 * tiene razón: son los dos alimentos más densos del catálogo -el aceite 8,8
 * kcal por gramo, la sal 388 mg de sodio por gramo- así que la diferencia
 * entre lo que una persona llama "normal" y lo que llama otra son cientos de
 * kcal al mes. Con un adjetivo, alguien tendría que decidir por todos cuántos
 * gramos son; con una cucharada, lo dice el propio asesorado.
 *
 * POR QUÉ NO SE PREGUNTA POR ESPECIAS. El orégano no aporta calorías: dos
 * gramos son ruido. Los condimentos solo mueven el sodio, y eso lo cubren la
 * sal y el cubito de caldo.
 */

/** Gramos por unidad. El aceite se mide en cucharadas soperas (~14 g) y la
 *  sal en cucharaditas (~6 g rasa), que es como se cocina. */
export const ACEITE: Record<string, number> = {
  '1/2 cda': 7.0,
  '1 cda': 14.0,
  '1 1/2 cda': 21.0,
  '2 cda': 28.0,
  '3 cda': 42.0,
}

export const SAL: Record<string, number> = {
  '1 pizca': 0.4,
  '1/2 cdta': 3.0,
  '1 cdta': 6.0,
  '1 cubito': 4.0,
}

/** Responder "nada" es una afirmación -no le puse-, no un hueco de información. */
export const NADA = 'nada'

function buscar(tabla: Record<string, number>, respuesta: string | null): number | null {
  if (respuesta === null) return null
  const limpia = respuesta.trim().toLowerCase()
  if (limpia === NADA) return 0
  const valor = tabla[limpia]
  return valor === undefined ? null : valor
}

/** Gramos de aceite. `null` si la respuesta no es una de las opciones. */
export function gramosDeAceite(respuesta: string | null): number | null {
  return buscar(ACEITE, respuesta)
}

/** Gramos de sal o caldo. `null` si la respuesta no es una de las opciones. */
export function gramosDeSal(respuesta: string | null): number | null {
  return buscar(SAL, respuesta)
}

/**
 * Las opciones a mostrar en la app, de menor a mayor.
 *
 * `cual` debe ser exactamente "aceite" o "sal". Antes se resolvía con un
 * operador ternario (`cual === 'aceite' ? ACEITE : SAL`): cualquier valor
 * que no fuera literalmente "aceite" -una mayúscula, un espacio de más- caía
 * al else y devolvía en silencio las opciones de sal. Aquí revienta en vez
 * de reinterpretarse.
 */
export function opciones(cual: string): string[] {
  let tabla: Record<string, number>
  if (cual === 'aceite') {
    tabla = ACEITE
  } else if (cual === 'sal') {
    tabla = SAL
  } else {
    throw new Error(`cual debe ser "aceite" o "sal", no ${JSON.stringify(cual)}`)
  }
  return Object.keys(tabla).sort((a, b) => tabla[a] - tabla[b])
}
