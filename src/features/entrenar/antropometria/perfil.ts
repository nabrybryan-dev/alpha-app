import { LIMITES_ANTROPOMETRICOS } from '../../../domain/antropometria'
import type { MedidasAntropometricas } from '../../../domain/types'

interface Medida {
  clave: keyof MedidasAntropometricas
  nombre: string
  ayuda: string
  minimo: number
  maximo: number
  inicial: number
}

/** Las ocho medidas congeladas por el contrato del demo; no se agregan otras. */
export const MEDIDAS_DE_PALANCAS = [
  { clave: 'tibiaPeroneCm', nombre: 'Tibia y peroné', ayuda: 'De extremo a extremo', minimo: LIMITES_ANTROPOMETRICOS.tibiaPeroneCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.tibiaPeroneCm.maximoCm, inicial: 42 },
  { clave: 'femurCm', nombre: 'Fémur', ayuda: 'De cadera a rodilla', minimo: LIMITES_ANTROPOMETRICOS.femurCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.femurCm.maximoCm, inicial: 46 },
  { clave: 'torsoCm', nombre: 'Torso', ayuda: 'De cadera a hombro', minimo: LIMITES_ANTROPOMETRICOS.torsoCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.torsoCm.maximoCm, inicial: 52 },
  { clave: 'antebrazoCm', nombre: 'Antebrazo', ayuda: 'De codo a muñeca', minimo: LIMITES_ANTROPOMETRICOS.antebrazoCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.antebrazoCm.maximoCm, inicial: 27 },
  { clave: 'brazoCm', nombre: 'Brazo', ayuda: 'De hombro a codo', minimo: LIMITES_ANTROPOMETRICOS.brazoCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.brazoCm.maximoCm, inicial: 31 },
  { clave: 'anchoClavicularCm', nombre: 'Ancho clavicular', ayuda: 'De hombro a hombro', minimo: LIMITES_ANTROPOMETRICOS.anchoClavicularCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.anchoClavicularCm.maximoCm, inicial: 40 },
  { clave: 'cinturaCm', nombre: 'Cintura', ayuda: 'Perímetro natural', minimo: LIMITES_ANTROPOMETRICOS.cinturaCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.cinturaCm.maximoCm, inicial: 80 },
  { clave: 'caderasCm', nombre: 'Caderas', ayuda: 'Perímetro más amplio', minimo: LIMITES_ANTROPOMETRICOS.caderasCm.minimoCm, maximo: LIMITES_ANTROPOMETRICOS.caderasCm.maximoCm, inicial: 96 },
] as const satisfies readonly Medida[]

export function perfilInicial(perfil?: MedidasAntropometricas | null): MedidasAntropometricas {
  return Object.fromEntries(
    MEDIDAS_DE_PALANCAS.map((medida) => [medida.clave, perfil?.[medida.clave] ?? medida.inicial]),
  ) as unknown as MedidasAntropometricas
}
