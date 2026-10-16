/**
 * RITMO Y VELOCIDAD DEL CARDIO REGISTRADO, DERIVADOS — NUNCA GUARDADOS.
 *
 * `BloqueCardio` (`domain/types.ts`) guarda `duracionRealMin`, `distanciaKm` y `fcMedia`
 * tal cual los anota la persona. Ritmo (min/km) y velocidad (km/h) se calculan aquí, cada
 * vez que hacen falta, a partir de esos dos primeros — igual que el resto del repo prefiere
 * derivar sobre guardar dos veces el mismo hecho (`CLAUDE.md`, «la frase y los campos
 * divergen en silencio»): un ritmo guardado aparte podría quedar desactualizado si alguien
 * corrige la duración o la distancia después, y nada lo notaría.
 *
 * Los dos son opcionales en el origen —caminadora sin GPS, escaladora sin distancia— así
 * que las tres funciones devuelven `undefined` en vez de dividir por lo que falta o por
 * cero. `undefined` es «no se puede saber», nunca «cero minutos por kilómetro».
 */

export interface CardioRegistrado {
  duracionRealMin?: number
  distanciaKm?: number
}

function datosValidos(registro: CardioRegistrado): registro is Required<CardioRegistrado> {
  const { duracionRealMin, distanciaKm } = registro
  return (
    duracionRealMin !== undefined &&
    distanciaKm !== undefined &&
    Number.isFinite(duracionRealMin) &&
    Number.isFinite(distanciaKm) &&
    duracionRealMin > 0 &&
    distanciaKm > 0
  )
}

/** Minutos por kilómetro. `undefined` sin duración o sin distancia (o con alguna en 0). */
export function ritmoMinPorKm(registro: CardioRegistrado): number | undefined {
  if (!datosValidos(registro)) return undefined
  return Math.round((registro.duracionRealMin / registro.distanciaKm) * 100) / 100
}

/** Kilómetros por hora. `undefined` sin duración o sin distancia (o con alguna en 0). */
export function velocidadKmH(registro: CardioRegistrado): number | undefined {
  if (!datosValidos(registro)) return undefined
  return Math.round((registro.distanciaKm / (registro.duracionRealMin / 60)) * 100) / 100
}

/**
 * El ritmo listo para leer: `"5:30 min/km"`, o `undefined` si no se puede calcular.
 *
 * Los segundos son la parte fraccionaria del minuto, no un redondeo de mostrar: 5,5 min/km
 * son 5 minutos y 30 segundos, no "5,5 min/km" — que nadie lee como un tiempo.
 */
export function ritmoLegible(registro: CardioRegistrado): string | undefined {
  const ritmo = ritmoMinPorKm(registro)
  if (ritmo === undefined) return undefined
  const minutos = Math.floor(ritmo)
  const segundos = Math.round((ritmo - minutos) * 60)
  // Un redondeo de segundos a 60 (p. ej. 4,999 min) sube el minuto en vez de mostrar "4:60".
  const [m, s] = segundos === 60 ? [minutos + 1, 0] : [minutos, segundos]
  return `${m}:${String(s).padStart(2, '0')} min/km`
}

/**
 * Bloques que se marcan como cardio pero NO son de desplazamiento: core, fuerza,
 * explosividad, movilidad. La sesión compartida del jueves (16-oct-2026, Karin, Dhanny y
 * Lina) los carga como bloques, y pedirle distancia o FC media a una plancha es un error que
 * la persona ve. Se decide por el TÍTULO: las indicaciones de un cardio de verdad pueden
 * nombrar el core («activa el core») y no por eso dejan de ser cardio.
 */
const SIN_DESPLAZAMIENTO =
  /\b(core|abdom\w*|plancha\w*|fuerza|explosiv\w*|potencia|pliometr\w*|salto\w*|movilidad|estabilidad|estiramient\w*|stretching|foam|propiocepcion|tecnica|activacion|plank|hollow|dead bug|bird dog|pallof|clamshell)\b/

/** Si el título nombra un medio de cardio, manda él: «bici + activación de glúteo» o
 *  «caminata + movilidad» siguen pidiendo distancia. */
const CON_DESPLAZAMIENTO =
  /\b(cardio|bici\w*|caminadora|caminat\w*|caminar|trote|correr|carrera|escaladora|eliptica|remo|remadora|ciclismo|liss|z\d|zona \d|km)\b/

/** `false` si el bloque es de core, fuerza, explosividad o movilidad y no nombra ningún
 *  medio de cardio: no se le pide distancia ni FC media, solo la duración. */
export function pideDistanciaYFc(titulo: string): boolean {
  const limpio = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return CON_DESPLAZAMIENTO.test(limpio) || !SIN_DESPLAZAMIENTO.test(limpio)
}
