/**
 * LAS 15 REGIONES y su nombre hablado. Viven en el dominio porque las órdenes de voz de Praxis (puras) las nombran;
 * `features/entrenar/sujeto/regiones.ts` las re-exporta y añade los músculos de cada una.
 */

export type IdDeRegion =
  | 'pecho' | 'delt' | 'bic' | 'tri' | 'ante' | 'abd' | 'obl' | 'trap'
  | 'dors' | 'lumb' | 'glu' | 'cua' | 'isq' | 'adu' | 'gem'

/** Las quince, en el orden en que la maqueta las nombra. */
export const REGIONES: readonly { id: IdDeRegion; nombre: string }[] = [
  { id: 'pecho', nombre: 'Pectoral' },
  { id: 'delt', nombre: 'Deltoides' },
  { id: 'bic', nombre: 'Bíceps' },
  { id: 'tri', nombre: 'Tríceps' },
  { id: 'ante', nombre: 'Antebrazo' },
  { id: 'abd', nombre: 'Abdomen' },
  { id: 'obl', nombre: 'Oblicuos' },
  { id: 'trap', nombre: 'Trapecio' },
  { id: 'dors', nombre: 'Dorsal' },
  { id: 'lumb', nombre: 'Lumbares' },
  { id: 'glu', nombre: 'Glúteo' },
  { id: 'cua', nombre: 'Cuádriceps' },
  { id: 'isq', nombre: 'Isquiotibiales' },
  { id: 'adu', nombre: 'Aductores' },
  { id: 'gem', nombre: 'Gemelos' },
]

export const NOMBRE_DE_REGION: Record<IdDeRegion, string> = Object.fromEntries(
  REGIONES.map((r) => [r.id, r.nombre]),
) as Record<IdDeRegion, string>
