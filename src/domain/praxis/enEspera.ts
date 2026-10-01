import type { QueFalto, Trato } from './plan/responder'
import { filtroDeRiesgo, sinTildes } from './riesgo'

/**
 * «Pregunta en espera» (decisión D6 de Bryan, 29-sep; plazos de PD-8, 30-sep).
 *
 * Cuando Praxis no sabe, no inventa ni se queda callada: ofrece preguntarle a quien sí
 * sabe. Reglas firmadas:
 *   - se dice el ROL, nunca un nombre propio: «tu coach», y «tu nutricionista» si es de comida;
 *   - sin el «sí» de la persona no se manda nada;
 *   - como mucho 2 preguntas abiertas por persona, y 24 horas de plazo;
 *   - lo que tenga riesgo o sea de salud NO se guarda aquí: eso va por la capa de seguridad.
 *
 * Este módulo solo ARMA la pregunta. Guardarla es de `data/praxis/preguntasEnEspera.ts`,
 * contra la tabla de la migración 0105.
 */
export type Destinatario = 'coach' | 'nutricionista'

export const PLAZO_HORAS = 24
export const MAX_ABIERTAS = 2
export const MAX_LARGO_PREGUNTA = 500
const MAX_CITAS = 8
const MAX_LARGO_CITA = 160

export interface PreguntaEnEspera {
  /** La pregunta, en las palabras de la persona. */
  pregunta: string
  destinatario: Destinatario
  /** Qué le faltó a Praxis para contestar. */
  que_falto: QueFalto
  /** Referencias de lo que Praxis tenía delante (no el contenido). */
  citas: string[]
}

export type ResultadoArmar = { ok: true; pregunta: PreguntaEnEspera } | { ok: false; motivo: 'vacia' | 'riesgo' | 'tope' }

export function ofertaDePregunta(destinatario: Destinatario, trato: Trato): string {
  const quien = destinatario === 'nutricionista' ? 'nutricionista' : 'coach'
  return trato === 'usted' ? `¿Se lo pregunto a su ${quien}? Le aviso cuando responda.` : `¿Se lo pregunto a tu ${quien}? Te aviso cuando responda.`
}

const DE_COMIDA =
  /\b(comida|comidas|comer|arroz|pasta|pan|proteina|desayuno|almuerzo|cena|merienda|snack|dieta|menu|calorias?|kcal|macros?|carbohidratos?|carbos|grasas?|creatina|suplement\w*|alimento\w*|recetas?|frutas?|verduras?|azucar|antojos?|hambre|ayuno)\b/

/** Lo de comida va a la nutricionista; lo demás, al coach. */
export function destinatarioDe(frase: string): Destinatario {
  return DE_COMIDA.test(sinTildes(frase)) ? 'nutricionista' : 'coach'
}

export function armarPreguntaEnEspera(entrada: { frase: string; queFalto: QueFalto; citas: string[]; abiertas: number }): ResultadoArmar {
  const texto = entrada.frase.replace(/\s+/g, ' ').trim()
  if (!texto) return { ok: false, motivo: 'vacia' }
  if (filtroDeRiesgo(texto)) return { ok: false, motivo: 'riesgo' }
  if (entrada.abiertas >= MAX_ABIERTAS) return { ok: false, motivo: 'tope' }
  return {
    ok: true,
    pregunta: {
      pregunta: texto.slice(0, MAX_LARGO_PREGUNTA),
      destinatario: destinatarioDe(texto),
      que_falto: entrada.queFalto,
      citas: entrada.citas.slice(0, MAX_CITAS).map((c) => c.slice(0, MAX_LARGO_CITA)),
    },
  }
}
