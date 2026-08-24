/**
 * La tabla completa: un modelo mecánico por patrón de movimiento.
 *
 * Sale de `taxonomia.ts` (los 32 patrones y sus grupos) y de
 * `Cerebro Alpha/wiki/conocimiento/perfiles-de-resistencia.md` (el brazo de
 * momento externo). Va partida en tres por región porque entera pasa del
 * tamaño de archivo del proyecto; el porqué de cada campo está en `palancas.ts`.
 *
 * Fuente de verdad: `Cerebro Alpha/wiki/conocimiento/segmentos-ejes-y-palancas.md`.
 */

import type { Categoria } from '../taxonomia'
import type { ModeloDePalanca } from './tipos'
import { MODELOS_INFERIOR } from './modelosInferior'
import { MODELOS_SUPERIOR } from './modelosSuperior'
import { MODELOS_CORE } from './modelosCore'

export const MODELOS = {
  ...MODELOS_INFERIOR,
  ...MODELOS_SUPERIOR,
  ...MODELOS_CORE,
} as Readonly<Record<Categoria, ModeloDePalanca | null>>

/**
 * Variantes de ejecución que cambian el MODELO, no solo el reparto.
 *
 * Mismo mecanismo que `VARIANTES` en `taxonomia.ts` y por la misma razón: la
 * variante vive en el paréntesis del nombre. La diferencia es qué se juegan.
 * Allí una variante redistribuye el estímulo entre grupos; aquí puede cambiar
 * la cadena entera —una dominada y un jalón son el mismo patrón y modelos
 * mecánicos opuestos— y con ella, de dónde sale la línea de fuerza.
 */
export const VARIANTES: Partial<Record<Categoria, readonly { patron: RegExp; modelo: ModeloDePalanca }[]>> = {
  'TRACCIÓN VERTICAL': [
    {
      // Una dominada NO es un jalón invertido: la mano está fija al mundo y el
      // que gira es el cuerpo. No hay barra que seguir, así que la línea sale
      // del centro de masas o no sale.
      patron: /DOMINADA|PULL[- ]?UP|CHIN[- ]?UP/,
      modelo: {
        ...(MODELOS['TRACCIÓN VERTICAL'] as ModeloDePalanca),
        variante: 'DOMINADA',
        cadena: 'cerrada',
        anclaje: 'las manos en la barra fija',
        segmentosMoviles: ['cuerpo-entero'],
        referencia: 'vertical',
        linea: {
          origen: 'centro-de-masas',
          nota:
            'El lastre se suma al centro de masas del cuerpo, no lo sustituye. Seguir solo el ' +
            'disco del cinturón daría un brazo que no es el del ejercicio.',
        },
        marcas: ['muñeca', 'codo', 'hombro', 'cadera'],
        alineacion: {
          regla: 'el centro de masas bajo la barra',
          toleranciaMm: 40,
          porQue:
            'Cuanto más se aleja el cuerpo de la vertical de las manos, mayor el brazo en el ' +
            'hombro. Es lo que separa una dominada estricta de una con impulso, y se ve.',
        },
      },
    },
  ],
  'EMPUJE HORIZONTAL': [
    {
      // Fondos y flexiones: manos fijas, cuerpo móvil. Cambia la cadena y el
      // origen de la línea, igual que la dominada.
      patron: /FONDO|FLEXION(ES)? DE BRAZOS|PUSH[- ]?UP|DIP/,
      modelo: {
        ...(MODELOS['EMPUJE HORIZONTAL'] as ModeloDePalanca),
        variante: 'PESO CORPORAL',
        cadena: 'cerrada',
        anclaje: 'las manos en el suelo o en las paralelas',
        segmentosMoviles: ['cuerpo-entero'],
        referencia: 'vertical',
        linea: { origen: 'centro-de-masas' },
        marcas: ['muñeca', 'codo', 'hombro', 'cadera'],
        alineacion: {
          regla: 'la cadera en línea entre hombro y tobillo',
          toleranciaMm: 40,
          porQue: 'La flexión con la cadera caída o levantada cambia cuánta parte del cuerpo se está empujando.',
        },
      },
    },
  ],
  SENTADILLA: [
    {
      patron: /FRONTAL|GOBLET|COPA/,
      modelo: {
        ...(MODELOS.SENTADILLA as ModeloDePalanca),
        variante: 'CARGA DELANTE',
        alineacion: {
          regla: 'la barra sobre el mediopié, con el torso más vertical que en la trasera',
          toleranciaMm: 20,
          porQue:
            'Con la carga delante, mantener el mediopié OBLIGA a un torso vertical: eso acorta ' +
            'el brazo en la cadera y alarga el de la rodilla. El reparto cambia por geometría, ' +
            'no por intención.',
        },
      },
    },
  ],
  'SENTADILLA UNILATERAL': [
    {
      patron: /TORSO INCLINADO/,
      modelo: {
        ...(MODELOS['SENTADILLA UNILATERAL'] as ModeloDePalanca),
        variante: 'TORSO INCLINADO',
        alineacion: {
          regla: 'el ángulo del torso constante: es lo que define la variante',
          toleranciaMm: 25,
          porQue:
            'Inclinar el torso alarga el brazo externo en la cadera y manda el trabajo al ' +
            'aductor. Si el ángulo cambia dentro de la serie, el ejercicio prescrito no es el ' +
            'que se está haciendo.',
        },
      },
    },
  ],
}
