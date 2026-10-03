/** Los cinco escalones discretos de la cuarta dimensión anatómica. */
export const CAPAS_W = [
  { w: 0, id: 'piel', nombre: 'Piel' },
  { w: 1, id: 'musculo-superficial', nombre: 'Músculo superficial' },
  { w: 2, id: 'musculo-profundo', nombre: 'Músculo profundo' },
  { w: 3, id: 'tendon', nombre: 'Tendón y tejido pasivo' },
  { w: 4, id: 'hueso', nombre: 'Hueso' },
] as const

export type NivelW = (typeof CAPAS_W)[number]['w']
