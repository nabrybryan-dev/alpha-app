export const CLAVES_ANTROPOMETRICAS = [
  'estaturaCm',
  'masaKg',
  'torsoCm',
  'brazoCm',
  'antebrazoCm',
  'femurCm',
  'tibiaCm',
  'pieCm',
] as const

export type ClaveAntropometrica = (typeof CLAVES_ANTROPOMETRICAS)[number]
export type PerfilAntropometrico = Record<ClaveAntropometrica, number>

export interface PerfilPersonalizado {
  perfil: PerfilAntropometrico
  proporciones: Record<Exclude<ClaveAntropometrica, 'estaturaCm' | 'masaKg'>, number>
}

export function personalizarPerfil(perfil: PerfilAntropometrico): PerfilPersonalizado {
  const proporcion = (centimetros: number) => centimetros / perfil.estaturaCm
  return {
    perfil: { ...perfil },
    proporciones: {
      torsoCm: proporcion(perfil.torsoCm),
      brazoCm: proporcion(perfil.brazoCm),
      antebrazoCm: proporcion(perfil.antebrazoCm),
      femurCm: proporcion(perfil.femurCm),
      tibiaCm: proporcion(perfil.tibiaCm),
      pieCm: proporcion(perfil.pieCm),
    },
  }
}
