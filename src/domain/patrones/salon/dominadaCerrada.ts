import type { PatronSalon } from './tipos'

/** Dominada: las manos permanecen ancladas y la raíz asciende hacia ellas. */
export const dominadaCerrada: PatronSalon = {
  id: 'dominada_cerrada',
  nombre: 'Dominada en cadena cerrada',
  cadena: 'cerrada',
  apoyo: 'manos',
  cargaInicial: 'suspendida',
  raizCorporal: {
    eje: 'vertical',
    inicioMetros: 1.05,
    finMetros: 1.42,
  },
  rodilla: {
    flexionInicialGrados: 8,
    flexionFinalGrados: 8,
  },
}
