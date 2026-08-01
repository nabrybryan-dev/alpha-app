import {
  disponibilidadEnergetica,
  evaluarDisponibilidad,
  grasaPct,
  imc,
  masaMagraKg,
  type Medidas,
  type VeredictoEnergetico,
} from './composicion'
import { edadA, factorActividad, repartirMacros, tdee, tmb, type Macros } from './energia'
import { generoDe, type Respuestas } from './encuesta'
import type { SenalesDeRevision } from './visibilidad'

/**
 * De lo que respondió el asesorado a sus cifras.
 *
 * NADA DE ESTO SE GUARDA. Se recalcula siempre desde las respuestas en crudo,
 * igual que las kcal de una comida se recalculan desde `alimento_id` + gramos.
 * El día que se corrija una fórmula, los perfiles viejos se corrigen solos en
 * vez de arrastrar para siempre un número hecho con la versión anterior.
 *
 * TODO SE CALCULA, PARA TODOS. Que el asesorado vea o no cada cifra se decide
 * en otro sitio (`visibilidad.ts`). Aquí no se esconde nada: el coach y la
 * nutricionista necesitan el cuadro completo siempre, y la alerta de
 * disponibilidad energética -la que protege a quien está en riesgo- tiene que
 * funcionar aunque la persona no vea ni un número.
 */

export interface PerfilCalculado {
  /** `null` cuando falta alguna medida. Nunca un número inventado. */
  grasaPct: number | null
  masaMagraKg: number | null
  imc: number | null
  tmb: number | null
  factorActividad: number | null
  tdee: number | null
  macros: Macros | null
  /** Solo si además sabemos lo que come y lo que gasta entrenando. */
  energia: VeredictoEnergetico | null
  /** Qué faltó para poder calcular. Vacío si salió todo. */
  incompleto: string[]
}

export interface ContextoEnergetico {
  /** Lo que de verdad comió, del registro. Sin esto no hay disponibilidad. */
  ingestaKcal?: number
  /** Lo que gastó entrenando ese día. */
  gastoEjercicioKcal?: number
}

const numero = (valor: unknown): number | null => {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export function calcularPerfil(
  respuestas: Respuestas,
  hoyIso: string,
  contexto: ContextoEnergetico = {},
): PerfilCalculado {
  const genero = generoDe(respuestas)
  const pesoKg = numero(respuestas.pesoKg)
  const alturaCm = numero(respuestas.alturaCm)
  const nacimiento = typeof respuestas.fechaNacimiento === 'string' ? respuestas.fechaNacimiento : ''
  const edad = nacimiento ? edadA(nacimiento, hoyIso) : null

  const medidas: Partial<Medidas> = {
    pesoKg: pesoKg ?? undefined,
    alturaCm: alturaCm ?? undefined,
    cuelloCm: numero(respuestas.cuelloCm) ?? undefined,
    cinturaCm: numero(respuestas.cinturaCm) ?? undefined,
    caderaCm: numero(respuestas.caderaCm) ?? undefined,
    genero: genero ?? undefined,
  }

  const grasa = grasaPct(medidas)
  const magra = masaMagraKg(medidas)
  const basal = tmb(pesoKg, alturaCm, edad, genero)
  const fa = factorActividad(numero(respuestas.pasosDiarios), numero(respuestas.diasEntreno))
  const gasto = tdee(basal, fa)

  // La proteína sube a 1,9 g/kg en mujeres: es donde más masa magra hay que
  // proteger, y es el criterio que ya usa el Cerebro.
  const macros =
    gasto !== null && pesoKg !== null
      ? repartirMacros(gasto, pesoKg, { proteinaAlta: genero === 'M' })
      : null

  let energia: VeredictoEnergetico | null = null
  if (contexto.ingestaKcal !== undefined && genero) {
    energia = evaluarDisponibilidad(
      disponibilidadEnergetica(contexto.ingestaKcal, contexto.gastoEjercicioKcal ?? 0, magra),
      genero,
    )
  }

  const incompleto: string[] = []
  if (grasa === null) incompleto.push('composición corporal')
  if (basal === null) incompleto.push('metabolismo basal')
  if (fa === null) incompleto.push('factor de actividad')

  return {
    grasaPct: grasa,
    masaMagraKg: magra,
    imc: pesoKg !== null && alturaCm !== null ? imc(pesoKg, alturaCm) : null,
    tmb: basal,
    factorActividad: fa,
    tdee: gasto,
    macros,
    energia,
    incompleto,
  }
}

/**
 * Las señales de la encuesta que piden que alguien lo mire antes de enseñar
 * cifras.
 *
 * De la encuesta de la app sale UNA: el ciclo alterado. El antecedente de
 * conducta alimentaria lo trae la encuesta de captación, que sí lo pregunta —y
 * la de la app no, a propósito: preguntarlo en un formulario sin nadie al otro
 * lado que responda es peor que no preguntarlo. Para quien ya lleva meses, esa
 * bandera la levanta la nutricionista, que conoce a la persona.
 */
export function senalesDeLaEncuesta(respuestas: Respuestas): SenalesDeRevision {
  const ciclo = respuestas.cicloMenstrual
  return {
    cicloAlterado: ciclo === 'irregular' || ciclo === 'ausente',
  }
}
