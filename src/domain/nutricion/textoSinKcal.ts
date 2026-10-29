/**
 * QUITAR LAS CALORÍAS DE UN TEXTO LIBRE SIN INVENTAR NADA.
 *
 * El interruptor `verContadorKcal` es clínico: apagado, la persona no debe ver
 * cifras de energía. En los campos estructurados se resuelve no pintando el
 * número, pero hay tres sitios donde la cifra vive dentro de la prosa del coach
 * —el análisis del plan y las notas de una receta— y ahí no hay campo que
 * esconder.
 *
 * LA REGLA ES BORRAR LA FRASE QUE HABLA DE KCAL, no reescribirla. Reescribir
 * («son 148 de las 445 kcal» → «es buena parte de la energía») mete palabras que
 * el coach no firmó y puede cambiar el consejo. Quitar la frase entera deja el
 * resto de la nota intacto y no afirma nada nuevo; si la nota se quedaba sin
 * nada que decir, devuelve vacío y quien la pinta la omite.
 *
 * QUÉ CUENTA COMO CIFRA DE KCAL. No basta con la palabra: el coach escribe
 * «2100kcal», «1.800 calorías», «TDEE ~2.050», «~450 cal», y a veces la cifra
 * sigue en la frase siguiente sin repetir la unidad («te quedas cerca de 380»).
 * Por eso hay tres disparadores:
 *   - una palabra de energía (kcal, kilocalorías, calorías, cal, TDEE, energía,
 *     déficit, superávit) en la frase;
 *   - una cifra pegada a una unidad de energía, aunque la palabra no lleve
 *     espacio delante;
 *   - una cifra suelta en la frase que CONTINÚA una frase de energía. Es el caso
 *     de la nota del canje de los rollitos, que se colaba entero.
 *
 * NO SE TOCA LO QUE NO ES ENERGÍA. Gramos, minutos, series, repeticiones,
 * porciones, pasos, porcentajes, fracciones y rangos con unidad no son calorías.
 * La cifra suelta solo se elimina cuando la frase anterior hablaba de energía, y
 * una frase sin ninguna mención de energía no se toca nunca.
 *
 * LOS CORTES. Se parte por punto, interrogación, exclamación, punto y coma,
 * elipsis y saltos de línea, conservando el separador de cada trozo que queda:
 * las listas del plan (`whitespace-pre-line`) no pueden perder su forma. El
 * punto decimal (`30.5 g`) no parte la frase.
 */
const PALABRA_KCAL = /kcal|kilocalor[ií]as?|calor[ií]as?/i
const PALABRA_CAL = /\bcal\b/i
const TDEE = /\bTDEE\b/i
const PALABRA_ENERGIA = /\b(energ[ií]a|energ[ée]tic[oa]s?|d[ée]ficit|super[áa]vit)\b/i
const CIFRA = /\d[\d.,]*/

/**
 * Unidad que convierte la cifra en algo que NO son calorías. Va sin `^` para
 * poder reutilizarla con el segundo número de un rango.
 */
const UNIDAD_SEGURA =
  /^\s*(?:g|gr|gramos?|kg|kilos?|mg|ml|l|litros?|min|mins|minutos?|h|horas?|series?|reps?|repeticiones?|pasos?|porciones?|porci[oó]n|cucharadas?|cucharaditas?|vasos?|tazas?|unidades?|semanas?|d[ií]as?|meses?|años?|%|mm|cm|m|km)\b|^\s*k\s*(?:pasos|m|km)\b/i

interface Trozo {
  /** Lo que se decide conservar o borrar, sin el separador. */
  texto: string
  /** Puntuación y espacios que van detrás: se conservan con el trozo. */
  separador: string
}

/**
 * Trocea el texto sin perder un solo carácter: `texto + separador` de todos los
 * trozos reconstruye el original exacto. El separador se queda con el trozo que
 * sobrevive, así que quitar uno no deja un hueco de espacios.
 */
function trocear(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  let inicio = 0
  let i = 0
  const cortar = (finSeparador: number) => {
    trozos.push({
      texto: texto.slice(inicio, i),
      separador: texto.slice(i, finSeparador),
    })
    i = finSeparador
    inicio = finSeparador
  }

  while (i < texto.length) {
    const caracter = texto[i]

    if (caracter === '\n') {
      let fin = i + 1
      while (texto[fin] === '\n') fin++
      cortar(fin)
      continue
    }

    if (caracter === ';' || caracter === '…') {
      let fin = i + 1
      while (texto[fin] === ' ' || texto[fin] === '\t') fin++
      cortar(fin)
      continue
    }

    if (caracter === '!' || caracter === '?') {
      let fin = i + 1
      while (texto[fin] === '!' || texto[fin] === '?') fin++
      while (texto[fin] === ' ' || texto[fin] === '\t') fin++
      cortar(fin)
      continue
    }

    if (caracter === '.') {
      const anterior = texto[i - 1] ?? ''
      const siguiente = texto[i + 1] ?? ''
      const decimal = /\d/.test(anterior) && /\d/.test(siguiente)
      const finDeFrase = !decimal && (siguiente === '' || /\s/.test(siguiente))
      if (finDeFrase) {
        let fin = i + 1
        while (texto[fin] === ' ' || texto[fin] === '\t') fin++
        cortar(fin)
        continue
      }
    }

    i++
  }

  if (inicio < texto.length) trozos.push({ texto: texto.slice(inicio), separador: '' })
  return trozos
}

/** ¿La frase habla de energía con una cifra, o habla de energía sin más? */
function mencionaEnergia(texto: string): boolean {
  if (PALABRA_KCAL.test(texto)) return true
  const hayCifra = CIFRA.test(texto)
  if (TDEE.test(texto) && hayCifra) return true
  if (PALABRA_CAL.test(texto) && hayCifra) return true
  if (PALABRA_ENERGIA.test(texto) && hayCifra) return true
  return false
}

/** ¿El número va seguido de una unidad que lo convierte en otra cantidad? */
function seguidaDeUnidad(resto: string): boolean {
  if (UNIDAD_SEGURA.test(resto)) return true
  // «8-12 reps», «9-10k pasos», «0.5-1 kg»: la unidad va tras el segundo número.
  const rango = /^\s*[-–]\s*\d[\d.,]*\s*(.*)$/.exec(resto)
  return rango ? UNIDAD_SEGURA.test(rango[1] ?? '') : false
}

/**
 * ¿Queda en la frase alguna cifra que no sea gramos, minutos, series, pasos…?
 * Es la señal de que la frase continúa hablando de energía sin repetir «kcal».
 */
function tieneCifraSuelta(texto: string): boolean {
  for (const encontrada of texto.matchAll(/\d[\d.,]*/g)) {
    const numero = encontrada[0]
    const pos = encontrada.index ?? 0
    const resto = texto.slice(pos + numero.length)

    // «1/2 papa»: el numerador y el denominador son una fracción, no una cifra.
    if (texto[pos - 1] === '/' || resto.startsWith('/')) continue
    // «M22»: la cifra va pegada a una letra y no es una cantidad.
    if (/\p{L}/u.test(texto[pos - 1] ?? '')) continue
    if (seguidaDeUnidad(resto)) continue
    // Por debajo de 50 no es una ración de energía; evita borrar «3 bajas».
    if (Number(numero.replace(/\./g, '')) < 50) continue
    return true
  }
  return false
}

export function sinCifrasDeKcal(texto: string): string {
  if (!texto) return ''

  const salida: string[] = []
  let contextoDeEnergia = false

  for (const trozo of trocear(texto)) {
    const explicita = mencionaEnergia(trozo.texto)
    const continuaLaEnergia =
      !explicita && contextoDeEnergia && tieneCifraSuelta(trozo.texto)

    if (explicita || continuaLaEnergia) {
      // La frase de energía abre el contexto; la que solo lo continúa lo cierra.
      contextoDeEnergia = explicita
      continue
    }

    salida.push(trozo.texto + trozo.separador)
    contextoDeEnergia = false
  }

  return salida
    .join('')
    .replace(/[ \t]+$/gm, '')
    .trim()
    .replace(/[;,]\s*$/, '')
}
