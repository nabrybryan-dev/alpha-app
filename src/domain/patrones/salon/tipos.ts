export interface PatronSalon {
  id: string
  nombre: string
  cadena: 'abierta' | 'cerrada'
  apoyo: 'manos' | 'pies'
  cargaInicial: 'suspendida' | 'suelo'
  raizCorporal: {
    eje: 'vertical'
    inicioMetros: number
    finMetros: number
  }
  rodilla: {
    flexionInicialGrados: number
    flexionFinalGrados: number
  }
}

export function cambioDeRodilla(patron: PatronSalon): number {
  return Math.abs(
    patron.rodilla.flexionFinalGrados - patron.rodilla.flexionInicialGrados,
  )
}
