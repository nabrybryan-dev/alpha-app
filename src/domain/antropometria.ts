import type { MedidasAntropometricas, PerfilAntropometrico } from './types'

/** Contrato cerrado: ni estatura ni envergadura forman parte del perfil. */
export const CLAVES_ANTROPOMETRICAS = [
  'tibiaPeroneCm',
  'femurCm',
  'torsoCm',
  'antebrazoCm',
  'brazoCm',
  'anchoClavicularCm',
  'cinturaCm',
  'caderasCm',
] as const satisfies readonly (keyof MedidasAntropometricas)[]

export type ClaveAntropometrica = (typeof CLAVES_ANTROPOMETRICAS)[number]

export interface LimiteAntropometrico {
  minimoCm: number
  maximoCm: number
  etiqueta: string
}

/**
 * Límites de captura, no percentiles ni diagnósticos. Son deliberadamente
 * amplios: rechazan unidades equivocadas y ceros sin declarar que un cuerpo
 * válido es "anormal".
 */
export const LIMITES_ANTROPOMETRICOS: Record<ClaveAntropometrica, LimiteAntropometrico> = {
  tibiaPeroneCm: { minimoCm: 20, maximoCm: 70, etiqueta: 'Tibia-peroné' },
  femurCm: { minimoCm: 20, maximoCm: 75, etiqueta: 'Fémur' },
  torsoCm: { minimoCm: 30, maximoCm: 90, etiqueta: 'Torso' },
  antebrazoCm: { minimoCm: 15, maximoCm: 45, etiqueta: 'Antebrazo' },
  brazoCm: { minimoCm: 15, maximoCm: 50, etiqueta: 'Brazo/húmero' },
  anchoClavicularCm: { minimoCm: 20, maximoCm: 65, etiqueta: 'Ancho clavicular/biacromial' },
  cinturaCm: { minimoCm: 40, maximoCm: 220, etiqueta: 'Cintura' },
  caderasCm: { minimoCm: 45, maximoCm: 240, etiqueta: 'Caderas' },
}

export interface ResultadoValidacionAntropometrica {
  valida: boolean
  errores: Partial<Record<ClaveAntropometrica, string>>
}

export function validarAntropometria(
  entrada: Partial<Record<ClaveAntropometrica, unknown>>,
): ResultadoValidacionAntropometrica {
  const errores: Partial<Record<ClaveAntropometrica, string>> = {}
  for (const clave of CLAVES_ANTROPOMETRICAS) {
    const valor = entrada[clave]
    const limite = LIMITES_ANTROPOMETRICOS[clave]
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      errores[clave] = `${limite.etiqueta}: escribe una medida en centímetros.`
    } else if (valor < limite.minimoCm || valor > limite.maximoCm) {
      errores[clave] = `${limite.etiqueta}: revisa la unidad (${limite.minimoCm}–${limite.maximoCm} cm).`
    }
  }
  return { valida: Object.keys(errores).length === 0, errores }
}

/**
 * Convierte una fila desconocida en el contrato exacto. Descarta claves extra
 * para que un campo viejo no se cuele por propagación de objetos.
 */
export function crearPerfilAntropometrico(
  usuarioId: string,
  entrada: Partial<Record<ClaveAntropometrica, unknown>>,
  actualizadoEn = new Date().toISOString(),
): PerfilAntropometrico {
  const validacion = validarAntropometria(entrada)
  if (!validacion.valida) {
    throw new Error(Object.values(validacion.errores).join(' '))
  }
  const medidas = Object.fromEntries(
    CLAVES_ANTROPOMETRICAS.map((clave) => [clave, entrada[clave]]),
  ) as unknown as MedidasAntropometricas
  return { usuarioId, actualizadoEn, ...medidas }
}

export function medidasDe(perfil: PerfilAntropometrico): MedidasAntropometricas {
  return Object.fromEntries(
    CLAVES_ANTROPOMETRICAS.map((clave) => [clave, perfil[clave]]),
  ) as unknown as MedidasAntropometricas
}
