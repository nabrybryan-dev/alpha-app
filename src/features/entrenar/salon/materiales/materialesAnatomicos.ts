export interface MaterialAnatomico {
  roughness: number
  reflectivity: number
  subsurface: number
  fiberDensity: number
  deformation: number
}

export const RANGOS_MATERIAL_ANATOMICO = {
  roughness: [0, 1],
  reflectivity: [0, 1],
  subsurface: [0, 1],
  fiberDensity: [0, 1],
  deformation: [0, 1],
} as const

export const MATERIALES_ANATOMICOS = {
  musculo: {
    roughness: 0.58,
    reflectivity: 0.24,
    subsurface: 0.68,
    fiberDensity: 0.9,
    deformation: 0.76,
  },
  tendon: {
    roughness: 0.42,
    reflectivity: 0.32,
    subsurface: 0.28,
    fiberDensity: 0.72,
    deformation: 0.24,
  },
  pielHumeda: {
    roughness: 0.26,
    reflectivity: 0.62,
    subsurface: 0.46,
    fiberDensity: 0.08,
    deformation: 0.54,
  },
} as const satisfies Record<string, MaterialAnatomico>
