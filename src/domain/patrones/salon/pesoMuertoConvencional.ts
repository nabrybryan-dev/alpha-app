import type { PatronSalon } from './tipos'

/** Peso muerto convencional: la carga parte del suelo y cadera y rodilla extienden. */
export const pesoMuertoConvencional: PatronSalon = {
  id: 'peso_muerto_convencional',
  nombre: 'Peso muerto convencional desde el suelo',
  cadena: 'cerrada',
  apoyo: 'pies',
  cargaInicial: 'suelo',
  raizCorporal: {
    eje: 'vertical',
    inicioMetros: 0.56,
    finMetros: 0.98,
  },
  rodilla: {
    flexionInicialGrados: 72,
    flexionFinalGrados: 6,
  },
}

/** Referencia explícita para impedir confundir el convencional con el rumano. */
export const pesoMuertoRumanoReferencia: PatronSalon = {
  id: 'peso_muerto_rumano',
  nombre: 'Peso muerto rumano',
  cadena: 'cerrada',
  apoyo: 'pies',
  cargaInicial: 'suspendida',
  raizCorporal: {
    eje: 'vertical',
    inicioMetros: 0.98,
    finMetros: 0.73,
  },
  rodilla: {
    flexionInicialGrados: 8,
    flexionFinalGrados: 18,
  },
}
