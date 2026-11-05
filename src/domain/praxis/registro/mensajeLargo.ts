/**
 * Mensaje largo → áreas del check-in (propuesta, nunca escritura).
 *
 * La persona le cuenta a Praxis cómo le va en un texto corrido. Este paso parte el texto en
 * trozos, decide a qué área del check-in habla cada trozo y le aplica las MISMAS reglas y la
 * MISMA tabla cerrada de `vida.ts` (se llama a `resolverVida`, no se copia la tabla).
 *
 * Reglas firmes:
 *  - `filtroDeRiesgo` pasa PRIMERO sobre el texto entero. Si marca, no se extrae nada.
 *  - Solo campos reales de `CheckinDiario`. El ánimo no tiene campo en el check-in: queda
 *    descartado con ese motivo, no se inventa uno.
 *  - Lo que la tabla no conoce («pesado», «brutal») NO se interpreta: se descarta con el motivo.
 *    Las palabras nuevas se proponen aparte (CAMBIO-PROPUESTO-TABLA-MENSAJE-LARGO), no se añaden aquí.
 *  - Una negación que no está en la tabla («no estoy estresada») no se invierte: se descarta.
 *  - El dolor nunca se escribe, salvo la ausencia explícita (cero medido) que ya admite `vida.ts`.
 *  - Un área dicha dos veces con valores distintos no se elige: queda dudosa.
 *  - Cada valor trae la CITA literal del texto. La persona confirma en la tarjeta.
 */
import { filtroDeRiesgo, type MarcaDeRiesgo } from '../riesgo.ts'
import { normalizarTexto } from './numeros.ts'
import { resolverVida, sinDolorExplicito } from './vida.ts'
import type { Confianza, ContextoRegistro, RegistroCheckin, VidaExtraida } from './tipos.ts'

/** Campo real de `CheckinDiario` al que apunta cada área. */
export type CampoCheckin =
  | 'horasSueno' | 'calidadSueno' | 'estres' | 'cansancio' | 'hambreEscala'
  | 'motivacion' | 'rendimiento' | 'alimentacion' | 'dolor'

export interface ValorPropuesto { campo: CampoCheckin; valor: string | number; cita: string; confianza: Confianza }
export interface AreaDudosa { campo: CampoCheckin; candidatos: { valor: string | number; cita: string }[]; motivo: string }
export interface TrozoDescartado { area: string; cita: string; motivo: string }

export type ResultadoMensajeLargo =
  | { tipo: 'riesgo'; marca: MarcaDeRiesgo }
  | { tipo: 'propuesta'; propuestas: ValorPropuesto[]; dudosas: AreaDudosa[]; descartado: TrozoDescartado[] }

const CTX: ContextoRegistro = {
  ahora: '2026-11-05T12:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [],
  pantalla: { ejercicioId: null }, ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
}

/** Separadores de trozo. «y media» (7 horas y media) no parte. */
const SEPARADOR = /[.,;!?\n]+|\s+(?:pero|aunque|y(?!\s+medi[ao]\b)|ademas|tambien)\s+/gi

/** Negaciones que la tabla de vida.ts SÍ entiende como frase completa. */
const NEGACION_EN_TABLA = /\b(sin (estres|energia|ganas|fuerza)|no tengo (muchas |pocas )?ganas|no dormi mal|no pude dormir|no me duele(n)? (nada|ni))\b/g
const NEGACION = /\b(no|ni|nunca|tampoco|nada|nadie|ningun\w*)\b/

/** Valoraciones que la tabla no conoce (salvo las de sueño, que tienen tabla propia). */
const FUERA_DE_TABLA = /\b(pesad[oa]|dur[oa]|dificil|brutal|horrible|terrible|genial|increible|espectacular|agotador\w*|liviano|ligero|tremend[oa]|insoportable)\b/

const HORAS = /\b(\d+(?:[.,]\d+)?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+horas?\b(?:\s+y\s+medi[ao])?/

export function trozosDeMensaje(texto: string): string[] {
  return texto.split(SEPARADOR).map((t) => t.trim()).filter((t) => t.length > 0)
}

interface Candidato { campo: CampoCheckin; valor: string | number; cita: string; confianza: Confianza }

/** Aplica la tabla de vida.ts. Devuelve el parche y la confianza por campo, o null si no salió nada. */
function aplicarTabla(vida: Partial<VidaExtraida>): RegistroCheckin | null {
  const v: VidaExtraida = {
    sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
    actividad_sin_numero: null, agua: null, escalas: [], senales: [], ...vida,
  }
  const r = resolverVida(v, CTX)
  return r.registros.find((x): x is RegistroCheckin => x.campo === 'checkin') ?? null
}

type Intentar = (area: string, campo: CampoCheckin, vida: Partial<VidaExtraida>, sinFiltros?: boolean) => void

/** Dolor (solo el cero explícito; lo demás, al filtro clínico) y sueño (calidad y horas) de un trozo. */
function dolorYSueno(n: string, cita: string, intentar: Intentar, descartado: TrozoDescartado[]): void {
  if (/\b(dolor\w*|dolen|duel\w*|molest\w*)/.test(n)) {
    if (sinDolorExplicito(cita)) intentar('dolor', 'dolor', { sin_dolor: cita }, true)
    else descartado.push({ area: 'dolor', cita, motivo: 'el dolor no se escribe por esta vía: lo maneja el filtro clínico' })
  }
  if (/\b(dorm\w*|sueno|desvel\w*|insomnio)\b/.test(n)) {
    if (/\b(dorm\w*|desvel\w*|insomnio)\b/.test(n)) intentar('sueño', 'calidadSueno', { calidad_sueno: cita })
    else descartado.push({ area: 'sueño', cita, motivo: '«sueño» sin decir cómo dormió: no se convierte en un valor' })
    const h = HORAS.exec(n)
    if (h) intentar('sueño (horas)', 'horasSueno', { sueno_horas: h[0] })
  }
}

export function proponerDesdeMensajeLargo(texto: string): ResultadoMensajeLargo {
  const marca = filtroDeRiesgo(texto)
  if (marca) return { tipo: 'riesgo', marca }

  const candidatos: Candidato[] = []
  const descartado: TrozoDescartado[] = []

  for (const cita of trozosDeMensaje(texto)) {
    const n = normalizarTexto(cita)
    const negado = NEGACION.test(n.replace(NEGACION_EN_TABLA, ' '))
    const ajeno = FUERA_DE_TABLA.exec(n)?.[0]

    /** Intenta un campo del trozo; si no sale valor, deja el descarte con su motivo. */
    const intentar = (area: string, campo: CampoCheckin, vida: Partial<VidaExtraida>, sinFiltros = false) => {
      if (!sinFiltros && negado) {
        descartado.push({ area, cita, motivo: 'trae una negación que no está en la tabla de palabras: no se invierte el sentido' })
        return
      }
      if (!sinFiltros && ajeno && !area.startsWith('sueño')) {
        descartado.push({ area, cita, motivo: `«${ajeno}» no está en la tabla de palabras: no se convierte en un valor` })
        return
      }
      const reg = aplicarTabla(vida)
      const valor = reg?.parche[campo]
      if (reg && valor !== undefined) {
        candidatos.push({ campo, valor, cita, confianza: reg.confianza_por_campo[campo] ?? 'media' })
      } else {
        descartado.push({
          area, cita,
          motivo: area === 'hambre'
            ? 'el hambre se pide de 1 a 10 con un número: «mucha» o «bastante» no es un número'
            : 'no está en la tabla de palabras: no se convierte en un valor',
        })
      }
    }

    const hablaDeGanas = /\bganas\b/.test(n) && /\b(entren\w*|gym|gimnasio|rutina)\b/.test(n)
    const hablaDeHambre = /\b(hambre|hambrient\w*)\b/.test(n)

    dolorYSueno(n, cita, intentar, descartado)
    if (/\b(estres\w*|agobi\w*|tranquil\w*|relajad\w*)/.test(n)) intentar('estrés', 'estres', { escalas: [{ campo: 'estres', cita }] })
    if (/\b(energia|cansad\w*|cansanc\w*|agotad\w*|destruid\w*|rendid\w*|reventad\w*|hecho polvo|muert[oa])\b/.test(n) && !/\bmuert[oa] de\b/.test(n)) {
      intentar('energía', 'cansancio', { escalas: [{ campo: 'cansancio', cita }] })
    }
    if (/\b(animo|triste|feliz|content[oa]|bajon|bajone\w*|desanimad\w*|alegre|animad\w*)\b/.test(n)) {
      descartado.push({ area: 'ánimo', cita, motivo: 'el check-in no tiene campo de ánimo: no se anota (y el ánimo no es ganas de entrenar)' })
    }
    if (hablaDeHambre) intentar('hambre', 'hambreEscala', { escalas: [{ campo: 'hambre', cita }] })
    if (hablaDeGanas) intentar('motivación', 'motivacion', { escalas: [{ campo: 'ganas_de_entrenar', cita }] }, true)
    else if (/\b(entren\w*|gym|gimnasio|rutina|sesion)\b/.test(n)) {
      intentar('rendimiento', 'rendimiento', { escalas: [{ campo: 'rendimiento', cita }] })
    }
    if (/\b(comi\w*|comida|aliment\w*|dieta)\b/.test(n) && !hablaDeHambre) {
      intentar('alimentación', 'alimentacion', { escalas: [{ campo: 'alimentacion', cita }] })
    }
  }

  // Un área con dos valores distintos no se elige.
  const propuestas: ValorPropuesto[] = []
  const dudosas: AreaDudosa[] = []
  for (const campo of [...new Set(candidatos.map((c) => c.campo))]) {
    const lista = candidatos.filter((c) => c.campo === campo)
    if (new Set(lista.map((c) => String(c.valor))).size > 1) {
      dudosas.push({ campo, candidatos: lista.map((c) => ({ valor: c.valor, cita: c.cita })), motivo: 'el mensaje dice cosas distintas sobre lo mismo: que la persona elija' })
    } else propuestas.push(lista[0])
  }
  return { tipo: 'propuesta', propuestas, dudosas, descartado }
}
