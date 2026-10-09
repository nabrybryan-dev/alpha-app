import type { TipoComida } from '../../domain/types'

/**
 * A que comida del diario corresponde el titulo del menu.
 *
 * Los titulos los escribe el coach ("Desayuno · overnight oats"), asi que se
 * mira solo la primera palabra. Lo que no encaje cae en snack, que es donde
 * viven las medias mananas y los pre-entrenos.
 *
 * Separado de `MiPlan.tsx` (y no exportado desde ahí) para que ese archivo
 * solo exporte el componente: lo pedía el aviso de `react-refresh`.
 */
export function comidaDe(titulo: string): TipoComida {
  const primera = titulo.trim().split(/[\s·]/)[0].toLowerCase()
  return (['desayuno', 'almuerzo', 'cena'] as const).find((c) => c === primera) ?? 'snack'
}
