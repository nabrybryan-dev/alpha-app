import type { PartePreparacion, Sesion, TipoPreparacion } from '../../domain/types'

export type PatronSesion = 'torso' | 'pierna' | 'fullbody' | 'general'

// El coach siempre puede sobrescribir programando `preparacion` en la sesión.
export function patronDeSesion(nombre: string): PatronSesion {
  const n = nombre.toUpperCase()
  if (/UPPER|TORSO|PUSH|PULL|EMPUJE|TRACCI/.test(n)) return 'torso'
  if (/LEG|PIERNA|LOWER|GL[UÚ]TEO/.test(n)) return 'pierna'
  if (/FULL/.test(n)) return 'fullbody'
  return 'general'
}

const parte = (
  id: string,
  tipo: TipoPreparacion,
  titulo: string,
  indicaciones: string,
  duracionMin?: number,
): PartePreparacion => ({ id, tipo, titulo, indicaciones, duracionMin })

const CARDIO_BASE = parte(
  'prep-base-cardio',
  'calentamiento',
  'Cardio suave 5-8 min',
  'Bici, caminadora inclinada o elíptica a ritmo conversacional: sube la temperatura y lubrica las articulaciones antes de cargar.',
  6,
)

const MOVILIDAD: Record<PatronSesion, PartePreparacion[]> = {
  torso: [
    parte(
      'prep-base-torso-1',
      'movilidad',
      'Dislocaciones de hombro con banda × 12',
      'Agarre ancho, brazos estirados: prepara el hombro y activa el manguito rotador.',
    ),
    parte(
      'prep-base-torso-2',
      'movilidad',
      'Círculos de codo y muñeca × 10 por lado',
      'Amplios y controlados: despierta las articulaciones que van a recibir la carga.',
    ),
    parte(
      'prep-base-torso-3',
      'movilidad',
      'Band pull-apart × 15',
      'Aprieta las escápulas al final de cada repetición: activa espalda alta y sistema nervioso.',
    ),
  ],
  pierna: [
    parte(
      'prep-base-pierna-1',
      'movilidad',
      '90/90 de cadera × 8 por lado',
      'Transiciones lentas, tronco erguido: abre la cadera en rotación interna y externa.',
    ),
    parte(
      'prep-base-pierna-2',
      'movilidad',
      'Dorsiflexión de tobillo contra pared × 10 por lado',
      'Rodilla hacia la pared sin levantar el talón: el tobillo manda en la sentadilla.',
    ),
    parte(
      'prep-base-pierna-3',
      'movilidad',
      'Sentadilla profunda con pausa × 8',
      'Baja al máximo rango sin carga y quédate 2 s: cadera, rodilla y tobillo trabajando juntas.',
    ),
  ],
  fullbody: [
    parte(
      'prep-base-full-1',
      'movilidad',
      'Gato-camello × 10',
      'Segmenta la columna vértebra a vértebra: prepara el tronco completo.',
    ),
    parte(
      'prep-base-full-2',
      'movilidad',
      'El mejor estiramiento del mundo × 6 por lado',
      'Zancada + rotación torácica: cadera, tobillo y torso en un solo movimiento.',
    ),
    parte(
      'prep-base-full-3',
      'movilidad',
      'Dislocaciones de hombro con banda × 10',
      'Mismo tiempo total que en sesiones enfocadas, cubriendo la mayor cantidad de articulaciones.',
    ),
  ],
  general: [
    parte(
      'prep-base-gen-1',
      'movilidad',
      'Gato-camello × 10',
      'Movilidad general de columna antes de cualquier esfuerzo.',
    ),
    parte(
      'prep-base-gen-2',
      'movilidad',
      'Balanceos de pierna y círculos de tobillo × 10',
      'Frontales y laterales, controlados: prepara cadera y tobillo.',
    ),
  ],
}

export function plantillaPreparacion(patron: PatronSesion): PartePreparacion[] {
  return [CARDIO_BASE, ...MOVILIDAD[patron]].map((p) => ({ ...p }))
}

export function preparacionDe(sesion: Sesion): PartePreparacion[] {
  return sesion.preparacion ?? plantillaPreparacion(patronDeSesion(sesion.nombre))
}
