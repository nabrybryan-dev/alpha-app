/**
 * La revisión larga: EL MODELO ESCRIBE LAS FRASES, LAS CIFRAS LAS PONE LA PLANTILLA.
 *
 * Decisión de Bryan del 12-sep: la revisión semanal pasa de 15 s a 2-3 minutos, con cinco
 * cosas dentro, y la redacta un modelo. Pero el principio de `guion.ts` sigue en pie —«un
 * modelo suelto puede decirle a alguien que subió cinco kilos cuando fueron tres, y eso no
 * es un fallo de vídeo: es la palabra del coach»—, así que se parte en dos:
 *
 *   · el modelo escribe con HUECOS: `{registro_pct}`, nunca «74 %»;
 *   · esta pieza comprueba el borrador y pone cada cifra en su hueco.
 *
 * Es la regla que ya escribía la spec del 10-sep (encargo `voz-y-redaccion`): «el modelo no
 * coloca números: los devuelve aparte y la plantilla los pone en el hueco».
 *
 * LO QUE SE RECHAZA, y cada regla es una forma de que la voz del coach mienta sin dar error:
 *   · una cifra escrita por el modelo, en dígitos o con letras («tres sesiones»);
 *   · un hueco que no existe (el modelo inventando un dato con forma de hueco);
 *   · un hueco que existe pero NO TIENE DATO (la frase afirmaría un número que no hay);
 *   · felicitar una semana mala: con un eje ilegible, sin dato o por detrás del plan, «muy
 *     bien» es la máquina diciendo lo que la persona quiere oír;
 *   · una sección vacía o que falte: las cinco las pidió Bryan;
 *   · salirse de 2-3 minutos: por debajo no dice nada y por encima no cabe en la tanda.
 *
 * Esta pieza NO llama al modelo: es pura, y por eso se puede probar y ver fallar sin red.
 */

/** Las cinco cosas que pidió Bryan, en el orden en que se dicen. */
export const SECCIONES = ['semana', 'recordar', 'plan', 'cambiar', 'progresion'] as const
export type Seccion = (typeof SECCIONES)[number]

/** Lo que el modelo puede nombrar. `valor` ya viene listo para decirse en voz alta. */
export interface Hueco {
  /** `undefined` = no hay dato, y usar el hueco es un error. */
  valor?: string
  /** Qué significa, dicho para el modelo. */
  significa: string
}
export type Huecos = Record<string, Hueco>

/** Lo que devuelve el modelo: una cadena por sección, con huecos y sin cifras. */
export type Borrador = Partial<Record<Seccion, string>>

/**
 * La voz lee unos 16 caracteres por segundo. MEDIDO el 12-sep con la voz clonada: 2.084
 * caracteres sonaron 127 s (16,4/s). Con el 14 que se estimó antes, una revisión «de 2-3
 * minutos» salía en 1:45-2:35. Si cambia el molde de la voz, se vuelve a medir.
 */
export const CARACTERES_POR_SEGUNDO = 16
export const LARGO_MINIMO = 2 * 60 * CARACTERES_POR_SEGUNDO
export const LARGO_MAXIMO = 3 * 60 * CARACTERES_POR_SEGUNDO

export interface Revision {
  ok: boolean
  problemas: string[]
  /** El texto con las cifras puestas. Solo si `ok`. */
  texto?: string
  caracteres?: number
}

const HUECO = /\{([a-z0-9_]+)\}/g

const CIFRA = /\d/

/** Cantidades con letras. «un» y «una» no están: son artículos casi siempre. */
const CANTIDAD_CON_LETRAS =
  /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|mil|mitad|doble|triple|por ?ciento|kilos?|kilogramos?|kg)\b/i

const FELICITA =
  /\b(felicit\w*|enhorabuena|excelente\w*|genial|incre[ií]ble|espectacular|perfect[oa]|bravo|orgullos[oa]s?|buen(?:a|os|as)? trabajo|muy bien|lo est[aá]s haciendo (?:muy )?bien|sigue as[ií])\b/i

export interface EjeDeLaFicha {
  estado: string
  desvio_pct?: number | null
}

/**
 * Una semana es MALA si alguno de los ejes de su plan no se pudo medir o va por detrás más
 * de la banda (10 %), o si la ficha avisa de registro calcado. Mala no es un juicio sobre la
 * persona: es la condición en la que felicitar sería mentir.
 */
export function esSemanaMala(ejes: EjeDeLaFicha[], avisos: string[] = [], banda = 10): boolean {
  if (avisos.some((a) => /calcad/i.test(a))) return true
  return ejes.some(
    (e) => e.estado !== 'medido' || (typeof e.desvio_pct === 'number' && e.desvio_pct < -banda),
  )
}

export function revisarBorrador(
  borrador: Borrador,
  huecos: Huecos,
  opciones: { semanaMala: boolean; minimo?: number; maximo?: number },
): Revision {
  const minimo = opciones.minimo ?? LARGO_MINIMO
  const maximo = opciones.maximo ?? LARGO_MAXIMO
  const problemas: string[] = []

  for (const seccion of SECCIONES) {
    const crudo = borrador[seccion]
    if (typeof crudo !== 'string' || !crudo.trim()) {
      problemas.push(`falta la sección «${seccion}»`)
      continue
    }
    // Las cifras se buscan con los huecos QUITADOS: `{semana_2}` no es una cifra del modelo.
    const sinHuecos = crudo.replace(HUECO, ' ')
    if (CIFRA.test(sinHuecos)) {
      problemas.push(`«${seccion}» escribe una cifra: las cifras van en su hueco`)
    }
    const conLetras = sinHuecos.match(CANTIDAD_CON_LETRAS)
    if (conLetras) {
      problemas.push(`«${seccion}» escribe una cantidad con letras («${conLetras[0]}»): va en su hueco`)
    }
    if (opciones.semanaMala) {
      const felicita = crudo.match(FELICITA)
      if (felicita) {
        problemas.push(`«${seccion}» felicita («${felicita[0]}») una semana en la que eso no es verdad`)
      }
    }
    for (const [, clave] of crudo.matchAll(HUECO)) {
      const hueco = huecos[clave]
      if (!hueco) problemas.push(`«${seccion}» usa el hueco {${clave}}, que no existe`)
      else if (hueco.valor === undefined) {
        problemas.push(`«${seccion}» usa {${clave}}, que no tiene dato: esa frase afirmaría algo que no hay`)
      }
    }
  }
  if (problemas.length) return { ok: false, problemas }

  const texto = SECCIONES.map((s) =>
    (borrador[s] as string).trim().replace(HUECO, (_, clave: string) => huecos[clave].valor as string),
  ).join(' ')

  if (/[{}]|undefined|null|NaN/.test(texto)) {
    return { ok: false, problemas: ['el texto final conserva un hueco o un valor vacío'] }
  }
  const caracteres = texto.length
  if (caracteres < minimo || caracteres > maximo) {
    return {
      ok: false,
      problemas: [
        `dura ${Math.round(caracteres / CARACTERES_POR_SEGUNDO)} s y tiene que durar entre ` +
          `${Math.round(minimo / CARACTERES_POR_SEGUNDO)} y ${Math.round(maximo / CARACTERES_POR_SEGUNDO)} s`,
      ],
      caracteres,
    }
  }
  return { ok: true, problemas: [], texto, caracteres }
}
