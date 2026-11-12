/**
 * CAMINO RÁPIDO LOCAL de agua, sueño y pasos (gramática cerrada frase -> cita, sin servidor ni modelo).
 *
 * Hermano de `rapido.ts` (series de entreno): la frase ENTERA debe casar con una de las formas de abajo; se arma la MISMA
 * extracción cruda que daría el modelo («cita» literal de la frase) y pasa por lo de siempre: `validarExtraccion` y
 * `resolverPropuesta` (que llama a `resolverVida` / `resolverAgua`, es decir `leerSueno`, `leerPasos`, `mlDeAgua`...).
 * No hay un segundo lector de cifras: aquí solo se decide QUÉ trozo de la frase es la cita.
 *
 * Ante la mínima duda se devuelve `null` y la frase sigue el camino de siempre (el servidor):
 *  1. Riesgo o salud (`filtroDeRiesgo`, `filtrarClinico`, `DE_SALUD`): `null` siempre. Nada clínico se acelera.
 *  2. Negaciones, hipotéticos, planes, preguntas, rangos, aproximados, «y pico», varias anotaciones en una frase: la
 *     gramática no las contempla y además hay un veto explícito de palabras.
 *  3. La cita debe ser UNA sola cifra completa (sin «como», «unas», «más o menos»...).
 *  4. La propuesta resultante debe ser de una sola anotación, sin avisos, descartes, preguntas ni notas.
 *
 * Esto NO guarda nada y NO sustituye la validación del servidor al guardar. Ver `VIDA_LOCAL_ENCENDIDA`.
 * Banco: `rapidoVida.test.ts` y `scripts/praxis-eval/rapidoVida-corpus.test.ts` (cero diferencias frente al camino actual).
 */
import { escanearNumeros, normalizarTexto } from './numeros.ts'
import { validarExtraccion } from './esquema.ts'
import { resolverPropuesta } from './resolver.ts'
import { filtrarClinico } from './filtroClinico.ts'
import { construirTarjeta, type Tarjeta } from './tarjeta.ts'
import { armarContexto } from './contexto.ts'
import { filtroDeRiesgo } from '../riesgo.ts'
import { DE_SALUD } from '../ordenes/ordenesDeVoz.ts'
import type { ContextoRegistro, Propuesta } from './tipos.ts'

/**
 * APAGADA por defecto. Con `true`, la conexión real de Praxis (`features/praxis/conexionReal.ts`) intenta primero esta
 * gramática en el teléfono; lo que no acepta sigue al servidor igual que hoy. Encenderla es una decisión de Bryan.
 */
export const VIDA_LOCAL_ENCENDIDA = false

/** Palabras que sacan una frase del camino rápido aunque la forma casara: negación, duda, plan, pregunta, rango. */
const VETO = /\b(no|ni|nunca|jamas|tampoco|sin|si|pero|aunque|como|casi|unos|unas|aprox\w*|mas|menos|entre|o|a|hasta|pico|piquito|algo|poco|tanto|ayer|manana|quiero|queria|meta|voy|ojala|tomara|dormiria|podria|deberia|cuanto|cuantos|cuantas|que|cual)\b|\?|¿/

/** Un único número completo (cifra o palabras, con «y media»/«mil» si los lee `escanearNumeros`) y nada más. */
function esUnNumero(span: string): boolean {
  const tokens = normalizarTexto(span).split(' ').filter(Boolean)
  if (tokens.length === 0 || tokens.length > 4) return false
  const e = escanearNumeros(span)
  return e.length === 1 && e[0].desde === 0 && e[0].hasta === tokens.length
}

/** Sueño: un decimal solo si es «,5» («7,5»); «7,25» o «6,3» se redondearían en silencio. */
const decimalDeSuenoClaro = (span: string): boolean => !/\d[.,]\d/.test(span) || /^\d{1,2}[.,]5$/.test(span)
/** Pasos: con separador solo el punto de miles («8.500»). «8,5 mil», «10,000» o «8.5» son ambiguos: al servidor. */
const separadorDePasosClaro = (span: string): boolean => !/[.,]/.test(span) || /^\d{1,3}(?:\.\d{3})+$/.test(span)

const S = '([a-z0-9.,]+(?: [a-z0-9.,]+){0,3}?)' // candidato a número; `esUnNumero` decide

interface Forma { re: RegExp; armar: (m: RegExpMatchArray) => { vida: Record<string, unknown> } | null }

const PREFIJO = '(?:(?:hoy|anoche|ya) )?'

const FORMAS: Forma[] = [
  // SUEÑO: «dormí seis horas», «anoche dormí 6 horas y media», «dormí siete horas y 30 minutos»
  {
    re: new RegExp(`^${PREFIJO}(?:dormi|he dormido) ${S} horas?( y (?:media|cuarto)| y ${S} minutos)?$`),
    armar: (m) => {
      if (!esUnNumero(m[1]) || !decimalDeSuenoClaro(m[1]) || (m[3] !== undefined && !esUnNumero(m[3]))) return null
      return { vida: { sueno_horas: m[0].replace(/^.*?(?:dormi|dormido) /, '') } }
    },
  },
  // AGUA: «tomé dos litros de agua», «me tomé tres vasos de agua», «tomé medio litro de agua», «tomé litro y medio de agua»
  {
    re: new RegExp(`^${PREFIJO}(?:me )?(?:he |acabo de )?(?:tome|bebi|tomado|bebido|tomarme|beberme) ${S} (litros?|vasos?)( y medio)? de agua(?: hoy)?$`),
    armar: (m) => {
      if (!esUnNumero(m[1])) return null
      return { vida: { agua: { cantidad: `${m[1]} ${m[2]}${m[3] ?? ''}`, medida: null } } }
    },
  },
  { re: new RegExp(`^${PREFIJO}(?:me )?(?:he |acabo de )?(?:tome|bebi|tomado|bebido|tomarme|beberme) (medio litro|litro y medio) de agua(?: hoy)?$`), armar: (m) => ({ vida: { agua: { cantidad: m[1], medida: null } } }) },
  // PASOS: «hoy caminé 8.500 pasos», «hice 9500 pasos», «llevo 12 mil pasos»
  {
    re: new RegExp(`^${PREFIJO}(?:camine|hice|llevo|lleve|logre|llegue a|he caminado|he hecho|(?:el|mi) reloj (?:me )?marca) ${S} pasos(?: hoy)?$`),
    armar: (m) => (esUnNumero(m[1]) && separadorDePasosClaro(m[1]) ? { vida: { pasos: `${m[1]} pasos` } } : null),
  },
]

/** La extracción cruda (la forma de la salida del modelo) o `null` si la frase no es de las simples. */
export function extraerRapidoVida(frase: string): unknown | null {
  if (!frase || frase.length > 80) return null
  if (/[?¿]/.test(frase)) return null
  const t = normalizarTexto(frase)
  if (!t || VETO.test(t)) return null
  // Riesgo y salud: antes que nada. Nada clínico se acelera.
  if (filtroDeRiesgo(frase) || filtrarClinico(t) || DE_SALUD.test(t)) return null
  for (const f of FORMAS) {
    const m = t.match(f.re)
    if (!m) continue
    const x = f.armar(m)
    if (!x) return null
    return { intencion: ['vida'], vida: x.vida }
  }
  return null
}

/** ¿La propuesta es UNA sola anotación de agua, sueño o pasos, sin avisos, descartes ni preguntas? */
export function propuestaVidaSinDudas(p: Propuesta): boolean {
  if (p.accion !== 'tarjeta' || p.registros.length !== 1) return false
  const r = p.registros[0]
  if (r.campo === 'checkin') {
    const claves = Object.keys(r.parche)
    if (claves.length !== 1 || !['horasSueno', 'pasos'].includes(claves[0])) return false
  } else if (r.campo !== 'hidratacion') return false
  return (
    p.descartado.length === 0 && p.notas_coach.length === 0 && p.citas_invalidas.length === 0 &&
    p.pregunta === undefined && p.seguimiento === undefined && p.aviso === undefined &&
    p.fecha_real === undefined && p.requiere_confirmacion_de_sesion !== true && p.respuesta === undefined
  )
}

export interface ResultadoRapidoVida {
  /** Lo mismo que habría devuelto el modelo. */
  bruto: unknown
  propuesta: Propuesta
}

/** La propuesta lista (sin servidor ni modelo), o `null` si la frase sigue el camino de siempre. */
export function caminoRapidoVida(frase: string, ctx: ContextoRegistro): ResultadoRapidoVida | null {
  const bruto = extraerRapidoVida(frase)
  if (bruto === null) return null
  const v = validarExtraccion(frase, bruto)
  if (v.citasInvalidas.length > 0) return null
  const propuesta = resolverPropuesta(frase, v.extraccion, ctx, v.citasInvalidas)
  return propuestaVidaSinDudas(propuesta) ? { bruto, propuesta } : null
}

/**
 * Para el teléfono: arma el contexto mínimo (hora y agua de hoy, `verComposicion`) y devuelve propuesta + tarjeta, la
 * misma forma que `proponerRegistro`. No hace nada con la bandera apagada.
 */
export function proponerVidaLocal(
  frase: string,
  e: { ahora: string; hidratacionHoyMl?: number; verComposicion?: boolean },
  mensajeId: string,
  encendida: boolean = VIDA_LOCAL_ENCENDIDA,
): { propuesta: Propuesta; tarjeta: Tarjeta } | null {
  if (!encendida) return null
  const ctx = armarContexto({ ahora: e.ahora, activo: null, hidratacionHoyMl: e.hidratacionHoyMl, verComposicion: e.verComposicion })
  const r = caminoRapidoVida(frase, ctx)
  return r ? { propuesta: r.propuesta, tarjeta: construirTarjeta(r.propuesta, mensajeId) } : null
}
