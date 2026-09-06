/**
 * DE QUIÉN ES EL GIMNASIO QUE SE VE.
 *
 * El salón no está modelado por nosotros: el equipamiento sale de Sketchfab bajo licencia
 * **CC Attribution**, que permite usarlo en una app comercial **a condición de nombrar al
 * autor de forma visible**. No es una cortesía ni un detalle de buena educación: es la
 * condición legal que hace lícito el uso. Sin este listado en pantalla, el gimnasio se
 * está usando fuera de licencia.
 *
 * Por eso vive aquí, al lado de `piezas.ts` —quien carga los modelos— y no en un `.md`
 * suelto: un documento en el escritorio de alguien no se despliega con la app. Esto sí.
 *
 * Las superficies (suelo, hormigón, metal) vienen de Poly Haven y son **CC0**, dominio
 * público: no obligan a nada. Se nombran igual, porque cuesta una línea y porque la
 * siguiente persona que mire esto necesita saber cuáles obligan y cuáles no —esa es
 * justamente la información que se pierde primero.
 *
 * Licencias verificadas una a una en la ficha de cada modelo el 2026-09-06.
 */

export interface FuenteDelGimnasio {
  /** El nombre con el que está publicada, tal cual. */
  obra: string
  /** Cómo firma su autor. Es lo que la licencia obliga a mostrar. */
  autor: string
  /** La etiqueta de la ficha, no una interpretación nuestra. */
  licencia: 'CC Attribution' | 'CC0'
  enlace: string
  /** Qué se ve de esto en el salón, para quien lea los créditos sin saber qué es qué. */
  queEs: string
}

/**
 * Si la licencia obliga a dar crédito. Lo decide la licencia, no quien escribe la lista:
 * mantenerlo como función y no como un campo a mano evita que alguien marque `false` un
 * CC-BY para no tener que enseñarlo.
 */
export function obligaACitar(f: FuenteDelGimnasio): boolean {
  return f.licencia === 'CC Attribution'
}

export const CREDITOS_DEL_GIMNASIO: readonly FuenteDelGimnasio[] = [
  {
    obra: 'GAME READY GYM ENVIRONMENT ASSET PACK',
    autor: 'Oxygen3D',
    licencia: 'CC Attribution',
    enlace: 'https://sketchfab.com/3d-models/8aef4a478bbe49d483280968aff59064',
    queEs: 'Casi todo lo que se ve: mancuernas, bancos, discos, máquinas y el ring.',
  },
  {
    obra: 'Squat Rack With Bar',
    autor: 'Sousinho',
    licencia: 'CC Attribution',
    enlace: 'https://sketchfab.com/3d-models/squat-rack-with-bar-8e3109a049274de2941e7a2e014aa10d',
    queEs: 'El rack de sentadillas con su barra.',
  },
  {
    obra: 'Inspire - FT1 Functional Trainer',
    autor: 'Douglas.Alves1',
    licencia: 'CC Attribution',
    enlace: 'https://sketchfab.com/3d-models/inspire-ft1-functional-trainer-71a03da0c43f4054a5c9249f62b29ddc',
    queEs: 'La máquina de poleas.',
  },
  {
    obra: 'anti_skid_tiles · concrete_wall_008 · metal_plate_02',
    autor: 'Poly Haven',
    licencia: 'CC0',
    enlace: 'https://polyhaven.com',
    queEs: 'El suelo de goma, el hormigón de las paredes y el acero.',
  },
] as const
