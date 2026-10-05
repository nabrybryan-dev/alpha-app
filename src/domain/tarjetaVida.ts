import { sumarDias } from './activacion'
import { diaSemanaDe } from './calendario'

/**
 * LA TARJETA SEMANAL DE ESTILO DE VIDA: LAS SIETE PREGUNTAS (V1..V7).
 *
 * V1..V6 son el diseño original (`auditoria-alpha-20260919/vigia-codex/consola-20260924/
 * DISENO-AGENTE-ESTILO-DE-VIDA.md` §2, tabla de la línea 47; no vive en la rama de
 * agentes `planes/estilo-de-vida-2`, por eso hay que citarlo aparte). V7 es la añadida el
 * 26-sep (`cerebro-alpha`, `agentes/estilo-vida/catalogo-vida-v2.json`,
 * `indice_adaptacion.pregunta_vida`).
 *
 * El catálogo real —el que decide qué ACCIÓN prescribir a partir de cada respuesta— vive
 * versionado en `cerebro-alpha` (`agentes/estilo-vida/catalogo-vida-v2.json`,
 * `agentes/estilo_vida.py`). Esto es solo el CUESTIONARIO: el texto que la persona lee y
 * el rango que se acepta, para que la app pueda pintarlo y guardarlo sin tener que
 * importar Python. Si el diseño cambia una pregunta, esta lista se actualiza a mano — es
 * la misma relación que `domain/medidas.ts` tiene con la ficha: una tabla, una fuente.
 *
 * Las escalas de sensación van de 0 a 10, no de 1 a 5 (diseño §2, «caras de 10 puntos,
 * nunca de 5»): V4 es 0-10. V7 es la excepción declarada (1-5, es una escala GUIADA de
 * comparación con centro "igual que siempre", no de sensación).
 *
 * V6 no hace falta para que la tarjeta cuente como respondida (igual que en
 * `agentes/estilo_vida.py::senales_de`, que también deja V7 fuera de esa cuenta): en el
 * diseño «V6 solo sale si la semana anterior hubo una acción», y aquí, sin la prescripción
 * del agente conectada todavía (fase 2, `PendienteDeCadena` en `EstiloVidaTab`), no hay
 * forma de saber si la hubo — se ofrece siempre, pero contestarla nunca es obligatorio.
 */
export type IdPreguntaVida = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7'

export interface EscalaVida {
  minimo: number
  maximo: number
  /** Solo en escalas guiadas (V7): el texto de cada punto, para no dejar un número suelto
   *  sin decir qué significa. */
  etiquetas?: Record<number, string>
}

export interface PreguntaVida {
  id: IdPreguntaVida
  pilar: string
  texto: string
  escala: EscalaVida
}

export const PREGUNTAS_VIDA: readonly PreguntaVida[] = [
  {
    id: 'V1',
    pilar: 'pantallas',
    texto: '¿Cuántos días usaste el celular en la cama o en la última hora antes de dormir?',
    escala: { minimo: 0, maximo: 7 },
  },
  {
    id: 'V2',
    pilar: 'circadiano_luz',
    texto: '¿Cuántos días estuviste al menos 10 min al aire libre antes de las 10:00?',
    escala: { minimo: 0, maximo: 7 },
  },
  {
    id: 'V3',
    pilar: 'sueno',
    texto: '¿Cuántas noches tardaste más de 30 min en dormirte o te despertaste y no pudiste volver a dormir?',
    escala: { minimo: 0, maximo: 7 },
  },
  {
    id: 'V4',
    // "Estrés y seguridad" en el diseño; `estres_recuperacion` es el pilar canónico de
    // `agentes/estilo_vida.py::PILARES` al que se asigna. `alarmas_de` dispara
    // `animo_muy_bajo` con V4 <= 2: la pregunta es de ÁNIMO, no de nivel de estrés.
    pilar: 'estres_recuperacion',
    texto: '¿Cómo estuvo tu ánimo esta semana?',
    escala: { minimo: 0, maximo: 10 },
  },
  {
    id: 'V5',
    pilar: 'recompensa',
    // Una opción cerrada, no un sí/no: `alarmas_de` compara V5 contra 'nada' y 'trabajo'
    // literalmente, así que la escala tiene que traer esos dos valores tal cual.
    texto: '¿Qué te quitó más tiempo o ganas de entrenar?',
    escala: {
      minimo: 0,
      maximo: 6,
      etiquetas: {
        0: 'Redes o vídeos',
        1: 'Comida',
        2: 'Alcohol',
        3: 'Juegos',
        4: 'Trabajo',
        5: 'Nada en particular',
        6: 'Otro',
      },
    },
  },
  {
    id: 'V6',
    // No es uno de los seis pilares que sube o baja de estado: mide el CUMPLIMIENTO de la
    // acción prescrita la semana anterior, sea cual sea su pilar. El diseño la interpola
    // con el texto real de la acción («‹acción de la semana›»); esta app no tiene todavía
    // esa prescripción conectada (fase 2), así que queda genérica hasta que la haya.
    pilar: 'medicion',
    texto: '¿Cuántos días cumpliste la acción que te propuso tu coach la semana pasada?',
    escala: { minimo: 0, maximo: 7 },
  },
  {
    id: 'V7',
    pilar: 'indice_adaptacion',
    texto: 'Esta semana, ¿cómo rendiste en tu trabajo o en tus estudios comparado con una semana normal?',
    escala: {
      minimo: 1,
      maximo: 5,
      etiquetas: {
        1: 'Mucho peor que lo normal',
        2: 'Algo peor',
        3: 'Igual que siempre',
        4: 'Algo mejor',
        5: 'Mucho mejor que lo normal',
      },
    },
  },
] as const

export const PREGUNTA_VIDA_POR_ID: Record<IdPreguntaVida, PreguntaVida> = Object.fromEntries(
  PREGUNTAS_VIDA.map((p) => [p.id, p]),
) as Record<IdPreguntaVida, PreguntaVida>

const ES_ID_PREGUNTA_VIDA = new Set<string>(PREGUNTAS_VIDA.map((p) => p.id))

export function esIdPreguntaVida(id: string): id is IdPreguntaVida {
  return ES_ID_PREGUNTA_VIDA.has(id)
}

/** Lo que se guarda: cada pregunta contestada, o ausente si se saltó (nunca un cero). */
export type RespuestasTarjetaVida = Partial<Record<IdPreguntaVida, number>>

export interface ReparoDeTarjetaVida {
  campo: string
  motivo: string
}

/**
 * Revisa unas respuestas antes de guardarlas. Mismo criterio que
 * `domain/medidas.ts::revisarMedidas`: todos los reparos de una vez, no el primero, y una
 * clave que no es una de las siete se rechaza en vez de guardarse silenciosa.
 */
export function revisarRespuestasTarjetaVida(entrada: unknown): ReparoDeTarjetaVida[] {
  if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return [{ campo: '', motivo: 'Las respuestas tienen que venir en un objeto.' }]
  }
  const reparos: ReparoDeTarjetaVida[] = []
  for (const [id, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (!esIdPreguntaVida(id)) {
      reparos.push({ campo: id, motivo: `«${id}» no es una de las siete preguntas de la tarjeta.` })
      continue
    }
    // Saltarse una pregunta llega como `undefined`, y saltarla no es un error (se puede
    // saltar cualquiera): es un dato desconocido, nunca un empeoramiento.
    if (valor === undefined) continue
    const { escala } = PREGUNTA_VIDA_POR_ID[id]
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      reparos.push({ campo: id, motivo: `${id}: hace falta un número.` })
      continue
    }
    if (valor < escala.minimo || valor > escala.maximo || !Number.isInteger(valor)) {
      reparos.push({
        campo: id,
        motivo: `${id}: tiene que ser un número entero entre ${escala.minimo} y ${escala.maximo}.`,
      })
    }
  }
  return reparos
}

/** El lunes de la semana que contiene `fechaIso` (`DIAS_SEMANA`: domingo = 0). */
export function lunesDeSemanaActual(fechaIso: string): string {
  const dia = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'].indexOf(diaSemanaDe(fechaIso))
  // domingo(0) está a 6 días del lunes anterior; lunes(1) está a 0.
  return sumarDias(fechaIso, -((dia + 6) % 7))
}

/**
 * La semana que la tarjeta debe mostrar hoy: la que YA TERMINÓ.
 *
 * Un domingo, "la semana" es la que termina hoy mismo (su lunes es el de esta semana). Los
 * demás días, la semana en curso todavía no terminó — lo que se puede revisar es la
 * anterior, ya cerrada.
 */
export function semanaAMostrar(hoyIso: string): string {
  const lunesActual = lunesDeSemanaActual(hoyIso)
  return diaSemanaDe(hoyIso) === 'DOMINGO' ? lunesActual : sumarDias(lunesActual, -7)
}

/**
 * ¿Toca mostrar la tarjeta hoy?
 *
 * Domingo (para revisar la semana que termina), o cualquier día después si la semana que
 * ya tocaba revisar sigue sin respuesta — así una persona que no abrió la app el domingo
 * no pierde la oportunidad de contar su semana, en vez de esperar al domingo siguiente.
 * Nunca se ofrece la semana EN CURSO: preguntar por una semana a medias no tiene con qué
 * contestarse todavía.
 */
export function debeMostrarTarjeta(hoyIso: string, semanasYaRespondidas: readonly string[]): boolean {
  return !semanasYaRespondidas.includes(semanaAMostrar(hoyIso))
}
