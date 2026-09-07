/**
 * LAS OCHO MEDIDAS QUE PIDE LA FICHA.
 *
 * Seis longitudes de segmento y dos perímetros, todas en centímetros y todas tomadas con
 * cinta por una persona. Son las que hacen falta para dejar de dibujar al asesorado con el
 * cuerpo del atlas: hasta hoy lo único medido en metros era la estatura, y con la estatura
 * sola dos personas de 1,75 con fémures distintos se ven iguales
 * (`patrones/estatura.ts`). Con estas ocho, no.
 *
 * ## Por qué ocho y no las que se quieran
 *
 * `MedidaCorporal.perimetros` es un `Record<string, number>` con las claves libres, y se ve
 * lo que pasa cuando nadie cierra un catálogo: en la app conviven «Cadera» y «Glúteos»,
 * «Brazo» y «Brazos», «Abdomen» y «Abdomen medio» para lo mismo, porque cada pantalla y
 * cada semilla escribió la etiqueta que le pareció. Un mapa con las claves abiertas no se
 * puede consultar: nadie sabe si la persona no tiene el dato o lo tiene con otro nombre.
 *
 * Aquí las claves están cerradas. Ocho, con nombre estable, y lo que no está en la lista
 * **se rechaza** en vez de guardarse: es la diferencia entre un formulario y un catálogo.
 *
 * ## Todas opcionales, y eso no es dejadez
 *
 * Alguien puede tomarse el fémur y no la cintura. Lo que falta **no se rellena**: no medido
 * no es cero ni es «lo que suele medir la gente», que es la misma regla que ya aplican
 * `pesoKg` en `types.ts` y `juegoParaEstatura` en `patrones/estatura.ts`. Lo que sí se
 * exige es que lo que esté, esté bien: un número finito y dentro de su rango.
 *
 * ## De dónde salen los rangos
 *
 * De los dos atlas que ya usa la app (`patrones/juegoDeHuesos.ts`), escalados a las dos
 * estaturas extremas que admite la ficha —130 y 220 cm, `ESTATURA_MINIMA_CM` y
 * `ESTATURA_MAXIMA_CM`— y con un ±15 % de holgura individual encima, porque dos personas de
 * la misma altura no tienen el mismo fémur y ese es justo el motivo de medir. Redondeados
 * hacia fuera.
 *
 * No son rangos de normalidad clínica y no sirven para decirle nada a nadie sobre su
 * cuerpo. Son lo mismo que los topes de la estatura: **el filtro del dato mal metido** —el
 * fémur en milímetros, la coma corrida, el campo de al lado—. Todo lo que un cuerpo humano
 * puede medir de verdad pasa.
 *
 * Los dos perímetros no tienen atlas del que derivarlos —un contorno no tiene techo
 * anatómico como un hueso— así que su rango es generoso a propósito y se apoya en lo que
 * se ve en consulta: por debajo de 40 cm de cintura no hay adulto, y por encima de 200 el
 * dato está mal escrito.
 */

/**
 * Las ocho, en el orden en el que se preguntan: primero las longitudes de abajo arriba y
 * después los dos perímetros. La ficha las pinta en este orden y el orden es parte del
 * contrato — cambiarlo cambia el formulario.
 */
export const CLAVES_DE_MEDIDA = [
  'tibiaCm',
  'femurCm',
  'torsoCm',
  'antebrazoCm',
  'brazoCm',
  'anchoClavicularCm',
  'cinturaCm',
  'caderasCm',
] as const

export type ClaveDeMedida = (typeof CLAVES_DE_MEDIDA)[number]

/** Lo que la ficha guarda de una persona. Todas opcionales: lo que falta, falta. */
export type MedidasDelCuerpo = Partial<Record<ClaveDeMedida, number>>

export interface DefinicionDeMedida {
  clave: ClaveDeMedida
  /** Lo que lee la persona en el formulario. */
  etiqueta: string
  /** Entre qué dos puntos se pone la cinta. Sin esto, cada uno mide una cosa distinta. */
  comoSeMide: string
  /** Centímetros, siempre. El sufijo `Cm` de la clave lo dice y aquí se declara. */
  unidad: 'cm'
  minimo: number
  maximo: number
}

/**
 * La tabla. Es la única fuente: la etiqueta del formulario, el rango del validador y la
 * fila del spec salen de aquí, para que no puedan decir tres cosas distintas.
 */
export const MEDIDAS: readonly DefinicionDeMedida[] = [
  {
    clave: 'tibiaCm',
    etiqueta: 'Tibia y peroné',
    comoSeMide:
      'De extremo a extremo: del hueco de la rodilla (interlínea articular) al hueso ' +
      'que sobresale en el tobillo, con la pierna estirada.',
    unidad: 'cm',
    minimo: 22,
    maximo: 56,
  },
  {
    clave: 'femurCm',
    etiqueta: 'Fémur',
    comoSeMide:
      'Del bulto del lateral de la cadera (trocánter mayor) al hueco de la rodilla, de ' +
      'pie y con el peso repartido.',
    unidad: 'cm',
    minimo: 27,
    maximo: 69,
  },
  {
    clave: 'torsoCm',
    etiqueta: 'Torso',
    comoSeMide:
      'De la cresta de la cadera a la punta del hombro (acromion), sentado y con la ' +
      'espalda recta.',
    unidad: 'cm',
    minimo: 32,
    maximo: 79,
  },
  {
    clave: 'antebrazoCm',
    etiqueta: 'Antebrazo',
    comoSeMide: 'Del pliegue del codo al pliegue de la muñeca, con el brazo estirado.',
    unidad: 'cm',
    minimo: 14,
    maximo: 34,
  },
  {
    clave: 'brazoCm',
    etiqueta: 'Brazo',
    comoSeMide: 'De la punta del hombro (acromion) al pliegue del codo, con el brazo colgando.',
    unidad: 'cm',
    minimo: 19,
    maximo: 46,
  },
  {
    clave: 'anchoClavicularCm',
    etiqueta: 'Ancho clavicular',
    comoSeMide: 'De una punta del hombro a la otra, por delante, de pie y relajado.',
    unidad: 'cm',
    minimo: 24,
    maximo: 57,
  },
  {
    clave: 'cinturaCm',
    etiqueta: 'Cintura',
    comoSeMide:
      'En el punto más estrecho entre la última costilla y la cresta de la cadera, al ' +
      'final de una espiración normal y sin apretar.',
    unidad: 'cm',
    minimo: 40,
    maximo: 200,
  },
  {
    clave: 'caderasCm',
    etiqueta: 'Caderas',
    comoSeMide: 'En la parte más ancha de los glúteos, de pie y con los pies juntos.',
    unidad: 'cm',
    minimo: 50,
    maximo: 200,
  },
]

export const MEDIDA_POR_CLAVE: Record<ClaveDeMedida, DefinicionDeMedida> = Object.fromEntries(
  MEDIDAS.map((m) => [m.clave, m]),
) as Record<ClaveDeMedida, DefinicionDeMedida>

const ES_CLAVE = new Set<string>(CLAVES_DE_MEDIDA)

/** Si una clave es una de las ocho. Sirve para leer lo que ya está guardado. */
export function esClaveDeMedida(clave: string): clave is ClaveDeMedida {
  return ES_CLAVE.has(clave)
}

/**
 * Un reparo: qué campo está mal y qué decirle a quien lo escribió.
 *
 * `campo` va vacío cuando el problema es del objeto entero y no de una medida. El mensaje
 * es el que se pinta, así que está escrito para leerse y no para depurar.
 */
export interface ReparoDeMedida {
  campo: string
  motivo: string
}

/**
 * REVISA UNAS MEDIDAS Y DEVUELVE LO QUE ESTÁ MAL. Lista vacía = se pueden guardar.
 *
 * Devuelve TODOS los reparos, no el primero: quien rellena ocho campos merece verlos todos
 * marcados de una vez en vez de descubrirlos de uno en uno.
 *
 * Rechaza tres cosas, y la tercera es la que justifica que el catálogo esté cerrado:
 *
 *  1. lo que no es un número (texto, `null`, infinito, `NaN`);
 *  2. lo que está fuera del rango de esa medida;
 *  3. **una clave que no es una de las ocho**. Es lo que impide que vuelva a pasar lo de
 *     `perimetros`, donde «Cadera» y «Glúteos» acabaron siendo dos columnas del mismo dato
 *     porque nadie dijo que no.
 */
export function revisarMedidas(entrada: unknown): ReparoDeMedida[] {
  if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return [{ campo: '', motivo: 'Las medidas tienen que venir en un objeto.' }]
  }
  const reparos: ReparoDeMedida[] = []
  for (const [clave, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (!esClaveDeMedida(clave)) {
      reparos.push({
        campo: clave,
        motivo: `«${clave}» no es una de las ocho medidas de la ficha.`,
      })
      continue
    }
    // Una clave presente con `undefined` es lo mismo que no traerla: es lo que deja un
    // campo del formulario en blanco, y un hueco no es un error.
    if (valor === undefined) continue
    const def = MEDIDA_POR_CLAVE[clave]
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      reparos.push({ campo: clave, motivo: `${def.etiqueta}: hace falta un número en cm.` })
      continue
    }
    if (valor < def.minimo || valor > def.maximo) {
      reparos.push({
        campo: clave,
        motivo: `${def.etiqueta}: ${valor} cm está fuera de lo posible (${def.minimo}–${def.maximo} cm).`,
      })
    }
  }
  return reparos
}

/*
 * LO QUE ESTE MÓDULO NO TRAE, a propósito.
 *
 * No hay una `medidasVigentes` que devuelva la toma más reciente, como sí la hay para la
 * estatura (`patrones/estatura.ts#estaturaVigente`). Se escribió y se quitó: su único
 * consumidor sería quien decida **si estas ocho mandan sobre las proporciones que salen de
 * la pista de pose** (`patrones/huellaArticular.ts#proporcionesDePista`), y esa decisión no
 * es de esta tanda —está apuntada en `docs/specs/2026-09-08-definicion-corporal.md` §5—.
 * Una función sin consumidor con una decisión pendiente dentro es justo lo que este repo
 * caza con `src/test/codigo-huerfano.test.ts`.
 */
