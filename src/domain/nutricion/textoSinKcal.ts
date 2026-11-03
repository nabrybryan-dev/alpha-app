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
 *   - una palabra de kcal (kcal, kilocalorías, calorías, cal, cals) en la frase,
 *     o una palabra de energía (TDEE, energía, gasto, calórico, hipocalórico,
 *     déficit, superávit) junto a una cifra que no sea gramos, series, pasos…;
 *   - una cifra grande «al día» o «diarias» sin unidad («ronda las 1.800
 *     diarias»): en una nota de nutrición eso solo puede ser energía;
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
const PALABRA_KCAL =
  /kcal|kilocalor[ií]as?|calor[ií]as?|kilojulios?|(?<!\p{L})(?:cals?|kj)(?!\p{L})/iu
const PALABRA_ENERGIA =
  /(?<!\p{L})(?:TDEE|energ[ií]a|energ[ée]tic[oa]s?|gasto|\p{L}*cal[oó]ric[oa]s?|d[ée]ficit|super[áa]vit)(?!\p{L})/iu
/** «1.800 diarias», «2.300 al día»: una cifra grande por día sin unidad delante. */
const CIFRA_POR_DIA =
  /(\d[\d.,]*)\s*(?:diari[ao]s?|al\s+d[ií]a|por\s+d[ií]a|cada\s+d[ií]a)(?!\p{L})/giu

/**
 * Lo que puede valer una cifra de kcal: de una ración (50) a un día entero
 * (6000). Por encima son pasos («10.000 al día») o dinero, no energía.
 */
const KCAL_MINIMA = 50
const KCAL_MAXIMA = 6000

/** «aprox. 450 kcal»: el punto de una abreviatura no cierra frase. */
const ABREVIATURA = /(?:^|[\s(])(?:aprox|approx|aprox|p\.\s?ej|ej|vs|m[áa]x|m[ií]n|cca)$/iu

/**
 * Unidad que convierte la cifra en algo que NO son calorías. Va sin `^` para
 * poder reutilizarla con el segundo número de un rango.
 */
const UNIDAD_SEGURA =
  /^\s*(?:(?:g|gr|gramos?|kg|kilos?|mg|ml|cc|l|litros?|min|mins|minutos?|s|seg|segs|segundos?|h|horas?|series?|reps?|repeticiones?|pasos?|porciones?|porci[oó]n|cucharadas?|cucharaditas?|vasos?|tazas?|unidades?|semanas?|d[ií]as?|meses?|años?|lpm|bpm|ppm|pulsaciones|latidos|grados?|ui|pesos|cop|euros?|d[óo]lares|usd|mm|cm|m|km)(?!\p{L})|%|[°º]\s*[CF]?(?!\p{L}))|^\s*k\s*(?:pasos|m|km)(?!\p{L})/iu

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
      // «1. Desayuno…»: el número de una lista no cierra frase.
      const inicioDeLinea = texto.lastIndexOf('\n', i - 1) + 1
      const numeroDeLista = /^\s*\d+$/.test(texto.slice(inicioDeLinea, i))
      const abreviatura = ABREVIATURA.test(texto.slice(inicio, i))
      // «kcal.Bebe»: sin espacio, pero la mayúscula abre otra frase.
      const pegada = /\p{Ll}/u.test(anterior) && /\p{Lu}/u.test(siguiente)
      const finDeFrase =
        !decimal &&
        !numeroDeLista &&
        !abreviatura &&
        (siguiente === '' || /\s/.test(siguiente) || pegada)
      if (finDeFrase) {
        let fin = i + 1
        // El salto de línea va con la frase: si se quita, su línea no queda en blanco.
        while (texto[fin] === ' ' || texto[fin] === '\t' || texto[fin] === '\n') fin++
        cortar(fin)
        continue
      }
    }

    i++
  }

  if (inicio < texto.length) trozos.push({ texto: texto.slice(inicio), separador: '' })
  return trozos
}

/** ¿La frase da una cifra de energía? */
function mencionaEnergia(texto: string): boolean {
  if (PALABRA_KCAL.test(texto)) return true
  // «Tienes energía para 3 series» habla de energía, pero su cifra son series.
  if (PALABRA_ENERGIA.test(texto) && tieneCifraSuelta(texto)) return true
  for (const encontrada of texto.matchAll(CIFRA_POR_DIA)) {
    const valor = Number((encontrada[1] ?? '').replace(/\./g, '').replace(',', '.'))
    if (valor >= 500 && valor <= KCAL_MAXIMA) return true
  }
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
    // «$20.000»: dinero.
    if (/[$€]\s*$/.test(texto.slice(0, pos))) continue
    // «2026-11-15»: una fecha.
    const alrededor = texto.slice(Math.max(0, pos - 8), pos + numero.length + 6)
    if (/\d{4}-\d{1,2}-\d{1,2}/.test(alrededor)) continue
    const valor = Number(numero.replace(/\./g, '').replace(',', '.'))
    // «en 2027», «al 2026»: un año escrito sin punto de miles.
    if (/^20[2-3]\d$/.test(numero)) continue
    // Fuera de lo que vale una ración o un día no es energía: «3 bajas», «10.000».
    if (valor < KCAL_MINIMA || valor > KCAL_MAXIMA) continue
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
      // «Son 450 kcal. Te quedas en 380. Y luego 200 más.»: el contexto sigue
      // abierto mientras cada frase traiga otra cifra suelta.
      contextoDeEnergia = true
      // Quitar la frase no quita su salto de línea: la línea de antes y la de
      // después no se pegan. Si ya hay un salto delante, no se duplica.
      const saltos = trozo.separador.replace(/[^\n]/g, '')
      const previo = salida.at(-1) ?? ''
      if (saltos && previo && !previo.endsWith('\n')) salida.push('\n')
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
