import type { AlimentoIndice } from './busqueda'
import { seContraindica } from './embarazo'
import tabla from './bioequivalentes.json'

/**
 * Por qué alimento se puede cambiar otro sin romper el plan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PARA QUÉ SIRVE, Y NO ES PARA VARIAR POR VARIAR
 * ─────────────────────────────────────────────────────────────────────────────
 * El número uno de abandono de un plan es el hambre; el dos es no poder comer
 * lo que hay en casa. Si a alguien se le pautó arroz y no tiene arroz —o no lo
 * aguanta más— lo que evita que abandone es saber cuánta pasta pone en su
 * lugar. Por eso esto vive junto al plan y no en el buscador: el momento de
 * necesidad es cuando va a cocinar, no cuando anota lo que ya comió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO ESTÁ CALCULADO AQUÍ, Y LA DERIVA SÍ
 * ─────────────────────────────────────────────────────────────────────────────
 * `bioequivalentes.json` lo exporta `herramientas/base-alimentos/
 * bioequivalentes.py` (`py bioequivalentes.py`) y un test de allá compara el
 * archivo con el módulo. Lo que viaja es LA DECISIÓN —qué puede ocupar el lugar
 * de qué, y en cuántos gramos—, que es la parte difícil: descartar los que
 * están en otro estado (proponía bagre crudo para reemplazar una pechuga
 * frita), los de otro grupo (proponía torta de zanahoria por fríjol), los
 * duplicados y los que pedirían una cantidad que no se puede comer.
 *
 * La deriva se calcula aquí porque las dos composiciones ya están en el índice:
 * traerla del Cerebro sería traer un número que puede contradecir al que la app
 * pinta al lado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DERIVA SE DICE, NO SE ESCONDE
 * ─────────────────────────────────────────────────────────────────────────────
 * Igualar el ancla NO iguala el plato: 350 g de clara de huevo y 7 huevos
 * enteros dan los dos 44 g de proteína y se llevan 310 kcal de diferencia. Las
 * dos filas están en la tabla de intercambio de Alpha como equivalentes, y para
 * las calorías del día no lo son. Cada propuesta viene con lo que mueve.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTA TABLA NO SABE: DE QUIÉN ES
 * ─────────────────────────────────────────────────────────────────────────────
 * Se calcula una vez para todos, así que trae los vetos del perfil urbano
 * —caza e insectos— y NO puede traer ni las alergias ni las condiciones, que son
 * de cada persona. Por eso se exportan diez propuestas y se enseñan cinco: el
 * margen existe para que a una alérgica a los lácteos le queden cinco donde las
 * demás ven cinco, y no dos. Filtrar es obligatorio, no opcional.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL EMBARAZO SE FILTRA AQUÍ, Y CASI SE ESCAPA
 * ─────────────────────────────────────────────────────────────────────────────
 * **52 de las 1.958 propuestas de la tabla son hígado o menudencias.** Al lomo
 * de cerdo se le proponen 161 g de menudencias de pollo, y al tocino, 25 g de
 * hígado de res: son sustituciones correctas por proteína y son exactamente lo
 * que en embarazo no se puede proponer.
 *
 * La primera versión de esta pantalla filtraba las alergias y no la
 * contraindicación, y con eso una asesorada que declaró su embarazo —el dato que
 * costó un PR entero recoger— habría visto hígado entre sus cambios. El veto
 * vivía en `seContraindica` desde el 2026-08-09 **sin un solo consumidor**: la
 * app registraba y no proponía, así que no tenía dónde actuar. Esta pantalla es
 * la primera que propone algo, y por tanto la primera que tiene que respetarlo.
 */

interface OpcionExportada {
  id: string
  g: number
}

interface TablaBioequivalentes {
  /** Grupo del catálogo → macro que se iguala al sustituir. */
  anclas: Record<string, string>
  /** Cuántas enseñar después de filtrar por la persona. */
  en_pantalla: number
  cambios: Record<string, { porcion: number; opciones: OpcionExportada[] }>
}

const TABLA = tabla as TablaBioequivalentes

/** Los macros cuya deriva se enseña. El ancla siempre da cero: es su definición. */
export const MACROS_DE_LA_DERIVA = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'] as const

export type MacroDeLaDeriva = (typeof MACROS_DE_LA_DERIVA)[number]

export interface Cambio {
  alimento: AlimentoIndice
  /** Cuántos gramos de este alimento ocupan el lugar del original. */
  gramos: number
  /**
   * Qué mueve el cambio, en la cantidad propuesta.
   *
   * Un macro que a alguna de las dos filas le falte NO sale: un hueco de dato
   * no es una deriva de cero, y decir «+0 kcal» de algo que nadie midió sería
   * prometer que no mueve nada.
   */
  deriva: Partial<Record<MacroDeLaDeriva, number>>
  /**
   * Si la persona lo tiene en casa ahora mismo (migraciones 0024 y 0042).
   *
   * Sirve para dos cosas y ninguna es filtrar: sube la opción a los primeros
   * puestos —que son los únicos que caben en pantalla— y deja decírselo, que es
   * la diferencia entre «cámbialo por lentejas» y «cámbialo por las lentejas que
   * ya tienes».
   *
   * `false` cuando la despensa está vacía, que hoy es el caso de todo el mundo.
   */
  enCasa: boolean
}

export interface PorQueNoHayCambios {
  /** El grupo del alimento no tiene macro ancla: no se inventa uno. */
  motivo: 'sin_ancla' | 'sin_porcion' | 'sin_candidatos'
}

const aporte = (
  alimento: AlimentoIndice,
  gramos: number,
  macro: MacroDeLaDeriva,
): number | null => {
  const por100g = alimento.por100g?.[macro]
  return por100g == null ? null : (por100g * gramos) / 100
}

/** El macro por el que se cambia este alimento. `null` si su grupo no tiene. */
export const anclaDe = (alimento: Pick<AlimentoIndice, 'grupo'>): string | null =>
  TABLA.anclas[alimento.grupo] ?? null

/**
 * Por qué se puede cambiar este alimento, y en cuánto.
 *
 * `excluidos` son los ids que esta persona no puede o no quiere comer —sus
 * alergias, lo que excluye, lo que no le gusta—. Se pasa siempre: la tabla se
 * calculó sin saber quién la iba a leer, y proponerle leche a una alérgica a la
 * lactosa porque el archivo venía así sería el peor fallo posible de esta
 * pantalla.
 *
 * `condiciones` son las que ella declaró —hoy, embarazo y lactancia—. En
 * embarazo se cae el hígado, y no por su dosis sino por ser hígado: ver el
 * encabezado del módulo y `seContraindica`.
 */
export function cambiosPara(
  alimento: AlimentoIndice,
  porId: (id: string) => AlimentoIndice | undefined,
  excluidos: ReadonlySet<string> = new Set(),
  condiciones: ReadonlySet<string> = new Set(),
  enCasa: ReadonlySet<string> = new Set(),
): Cambio[] {
  const entrada = TABLA.cambios[alimento.id]
  if (!entrada) return []

  const enEmbarazo = condiciones.has('embarazo')

  const salida: Cambio[] = []
  for (const opcion of entrada.opciones) {
    // El tope se aplica DESPUÉS de ordenar, no aquí: si se cortara antes, lo
    // que la persona tiene en casa se quedaría fuera de pantalla por estar más
    // abajo en la tabla, que es justo lo que este cambio viene a evitar.
    if (excluidos.has(opcion.id)) continue
    const destino = porId(opcion.id)
    // Se mira el NOMBRE y no el id, igual que en el Cerebro: los ids de la TCAC
    // y los de USDA no se parecen entre sí, y la lista de palabras es la misma
    // en los dos lados.
    if (enEmbarazo && destino && seContraindica(destino.nombre)) continue
    // Un id que el índice no conoce se salta en silencio. Pasaría si alguien
    // exporta la tabla y no regenera el índice, y enseñar un hueco con gramos
    // sería peor que enseñar una propuesta menos.
    if (!destino) continue

    const deriva: Partial<Record<MacroDeLaDeriva, number>> = {}
    for (const macro of MACROS_DE_LA_DERIVA) {
      const suyo = aporte(destino, opcion.g, macro)
      const original = aporte(alimento, entrada.porcion, macro)
      if (suyo == null || original == null) continue
      deriva[macro] = Math.round((suyo - original) * 10) / 10
    }
    salida.push({ alimento: destino, gramos: opcion.g, deriva, enCasa: enCasa.has(opcion.id) })
  }

  // Lo que hay en casa primero, y el resto en el orden de la tabla.
  //
  // NO SE FILTRA, SE ORDENA. Ocultar lo que no está en casa dejaría sin ninguna
  // propuesta a quien tenga la despensa vacía —que hoy es todo el mundo— y sería
  // peor que no mirarla. Con la despensa vacía este `sort` no mueve nada y la
  // pantalla se comporta exactamente como antes.
  //
  // El orden de la tabla dentro de cada grupo se conserva: `sort` es estable en
  // todos los motores desde ES2019, y ese orden no es alfabético ni casual —lo
  // decidió quien curó las equivalencias.
  return salida
    .sort((a, b) => Number(b.enCasa) - Number(a.enCasa))
    .slice(0, TABLA.en_pantalla)
}

/**
 * Por qué este alimento no tiene cambios que proponer.
 *
 * VACÍO NO ES «NO HAY NADA PARECIDO», y la diferencia importa para lo que se le
 * dice a la persona. Un yogur sin equivalencias porque nadie le curó la porción
 * es un hueco que se llena; el grupo `otro` —azúcares, salsas, bebidas sueltas—
 * no es un grupo con una regla común y no la tendrá.
 */
export function porQueNoHayCambios(alimento: AlimentoIndice): PorQueNoHayCambios {
  if (anclaDe(alimento) === null) return { motivo: 'sin_ancla' }
  if (!TABLA.cambios[alimento.id]) return { motivo: 'sin_porcion' }
  return { motivo: 'sin_candidatos' }
}

/** La porción desde la que se calcularon los cambios de este alimento. */
export const porcionDeReferencia = (alimentoId: string): number | null =>
  TABLA.cambios[alimentoId]?.porcion ?? null
