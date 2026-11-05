/**
 * VOZ NATURAL DEL CONCEPTO (diseño DISENO-PASO-A-FUNCION-20261104.md, sección 13; criterio firmado, etapa A).
 *
 * Regla de precedencia de Bryan (4-nov-2026): gana la ficha. El concepto de la biblioteca solo entra cuando el portero
 * no atiende ni pide aclarar, la biblioteca lo encuentra sobre su corte, la pregunta no es «cómo», no hay alerta de
 * salud ni de riesgo, el redactor redacta y el segundo lector aprueba. Si algo falla, `mostrar` es null y quien llama
 * deja la consulta COMO HOY: no se muestra el texto del concepto (en la zona sin ficha la biblioteca se equivoca 10 de
 * 18 veces cuando está «segura»). Esa es la «pieza textual» del criterio en este camino: lo de hoy.
 *
 * No guarda nada. Deja UNA línea de registro con estados y contadores; nunca la pregunta, la redacción ni los campos.
 * En modo «sombra» corre todo y no muestra nada. Este archivo todavía NO está conectado a `index.ts` (eso es la etapa B).
 */
import { revisarGuardas, type ReglaGuarda } from './guardas.ts'
import { limpiarPregunta } from './limpiador.ts'
import { leerConSegundoLector, redactar, type DepsModelos, type EstadoLlamada, type Lectura, type MotivoRechazo, type Proveedor } from './modelos.ts'
import { VERSION_PROMPT_LECTOR } from './promptLector.ts'
import { VERSION_PROMPT_REDACTOR } from './promptRedactor.ts'
import { CAMPOS_POR_TIPO, tipoDePregunta, type CampoConcepto, type TipoPregunta } from './tipoPregunta.ts'

/** Corte de la biblioteca (e5-base) con el que se midió la cobertura (MEDICION-COBERTURA-PORTERO-20261104.md). */
export const CORTE_BIBLIOTECA = 0.8219
/** Espera total máxima (decisión 6 de Bryan): pasado esto, lo de hoy. */
export const ESPERA_MAX_MS = 8000

export interface EntornoVoz {
  /** 'sombra' corre sin mostrar; 'encendido' muestra; cualquier otro valor o ausente = apagado. */
  PRAXIS_REDACTOR?: string
  DEEPSEEK_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  /** Nivel de aviso en tokens por día y proveedor. Sin freno: al cruzarlo se avisa y se sigue (decisión 3 de Bryan). */
  PRAXIS_VOZ_AVISO_TOKENS_DIA?: string
}

export interface ContadorGasto {
  /** Suma tokens al día de hoy de ese proveedor y devuelve el total del día ANTES y DESPUÉS. */
  sumar(proveedor: Proveedor, tokens: number, ahoraMs: number): { antes: number; despues: number }
}

/** En memoria: se pierde al reciclar la instancia. Vale para avisar en pruebas; el contador real va en base (otra migración). */
export function contadorEnMemoria(): ContadorGasto {
  const tabla = new Map<string, number>()
  return {
    sumar(p, tokens, ahoraMs) {
      const llave = `${p}:${new Date(ahoraMs).toISOString().slice(0, 10)}`
      const antes = tabla.get(llave) ?? 0
      tabla.set(llave, antes + tokens)
      return { antes, despues: antes + tokens }
    },
  }
}

export interface DepsVoz extends DepsModelos {
  entorno: EntornoVoz
  gasto: ContadorGasto
}

export interface EntradaVoz {
  pregunta: string
  /** El portero atendió o pidió aclarar: gana la ficha y aquí no se hace nada. */
  porteroDecidio: boolean
  /** El mejor concepto de la biblioteca, ya leído de `praxis_conceptos` (estado aprobada). */
  concepto: { id: string; coseno: number; campos: Partial<Record<CampoConcepto, unknown>> } | null
  /** Marca de salud o de riesgo de los filtros que corren antes. */
  alerta: boolean
  nombresConocidos: readonly string[]
}

export type Omitido = 'apagado' | 'ficha_gana' | 'sin_concepto' | 'bajo_corte' | 'alerta' | 'como' | 'sin_campos'

export interface MetaVoz {
  modo: 'apagado' | 'sombra' | 'encendido'
  omitido?: Omitido
  tipo_pregunta?: TipoPregunta
  concepto_id?: string
  datos_quitados?: number
  redactor_estado?: EstadoLlamada | `guarda_${ReglaGuarda}`
  hueco?: boolean
  lector_estado?: Lectura['estado']
  motivo_rechazo?: MotivoRechazo
  mostrado: 'redaccion' | 'lo_de_hoy'
  tokens_redactor: number
  tokens_lector: number
  ms: number
  version_prompt_redactor: string
  version_prompt_lector: string
}

export interface ResultadoVoz { mostrar: string | null; anotarDuda: boolean; meta: MetaVoz }

const modoDe = (v: string | undefined): MetaVoz['modo'] => (v === 'sombra' || v === 'encendido' ? v : 'apagado')

function anotarGasto(d: DepsVoz, p: Proveedor, tokens: number): void {
  if (tokens <= 0) return
  const { antes, despues } = d.gasto.sumar(p, tokens, d.ahoraMs())
  const nivel = Number(d.entorno.PRAXIS_VOZ_AVISO_TOKENS_DIA)
  if (Number.isFinite(nivel) && nivel > 0 && antes < nivel && despues >= nivel) console.log('praxis-registro: voz aviso_gasto', p, despues, 'nivel', nivel)
}

function porQueNo(d: DepsVoz, e: EntradaVoz, modo: MetaVoz['modo']): Omitido | null {
  if (modo === 'apagado' || !d.entorno.DEEPSEEK_API_KEY) return 'apagado'
  if (e.porteroDecidio) return 'ficha_gana'
  if (!e.concepto) return 'sin_concepto'
  if (e.concepto.coseno < CORTE_BIBLIOTECA) return 'bajo_corte'
  if (e.alerta) return 'alerta'
  return null
}

export async function vozDelConcepto(d: DepsVoz, e: EntradaVoz): Promise<ResultadoVoz> {
  const inicio = d.ahoraMs()
  const modo = modoDe(d.entorno.PRAXIS_REDACTOR)
  const meta: MetaVoz = { modo, mostrado: 'lo_de_hoy', tokens_redactor: 0, tokens_lector: 0, ms: 0, version_prompt_redactor: VERSION_PROMPT_REDACTOR, version_prompt_lector: VERSION_PROMPT_LECTOR }
  const fin = (mostrar: string | null, anotarDuda = false): ResultadoVoz => {
    meta.ms = d.ahoraMs() - inicio
    const { omitido, tipo_pregunta, concepto_id, redactor_estado, lector_estado, motivo_rechazo, mostrado, tokens_redactor, tokens_lector, ms } = meta
    console.log('praxis-registro: voz', JSON.stringify({ modo, omitido, tipo_pregunta, concepto_id, redactor_estado, lector_estado, motivo_rechazo, mostrado, tokens_redactor, tokens_lector, ms }))
    return { mostrar, anotarDuda, meta }
  }
  const omitido = porQueNo(d, e, modo)
  if (omitido) return (meta.omitido = omitido), fin(null)
  const concepto = e.concepto!
  meta.concepto_id = concepto.id
  const tipo = tipoDePregunta(e.pregunta)
  meta.tipo_pregunta = tipo
  if (tipo === 'como') return (meta.omitido = 'como'), fin(null, true)
  const campos = Object.fromEntries(CAMPOS_POR_TIPO[tipo].filter((k) => concepto.campos[k]).map((k) => [k, concepto.campos[k]]))
  if (!campos.respuesta) return (meta.omitido = 'sin_campos'), fin(null)
  const limpia = limpiarPregunta(e.pregunta, e.nombresConocidos)
  meta.datos_quitados = limpia.quitados
  const restante = () => Math.max(0, ESPERA_MAX_MS - (d.ahoraMs() - inicio))
  const red = await redactar(d, d.entorno.DEEPSEEK_API_KEY, { pregunta: limpia.texto, tipo, campos }, restante())
  meta.tokens_redactor = red.tokens
  anotarGasto(d, 'deepseek', red.tokens)
  meta.redactor_estado = red.estado
  if (red.estado !== 'ok' || !red.respuesta) return fin(null)
  meta.hueco = red.hueco
  const regla = revisarGuardas(red.respuesta, `${limpia.texto} ${JSON.stringify(campos)}`)
  if (regla) return (meta.redactor_estado = `guarda_${regla}`), fin(null)
  if (restante() <= 0) return (meta.lector_estado = 'timeout'), fin(null)
  const lec = await leerConSegundoLector(d, d.entorno.ANTHROPIC_API_KEY, { pregunta: limpia.texto, campos, respuesta: red.respuesta }, restante())
  meta.tokens_lector = lec.tokens
  anotarGasto(d, 'anthropic', lec.tokens)
  meta.lector_estado = lec.estado
  if (lec.motivo) meta.motivo_rechazo = lec.motivo
  if (lec.estado !== 'aprobo') return fin(null)
  if (d.ahoraMs() - inicio > ESPERA_MAX_MS) return (meta.lector_estado = 'timeout'), fin(null)
  if (modo !== 'encendido') return fin(null) // sombra: todo corrió, nada se muestra
  meta.mostrado = 'redaccion'
  return fin(red.respuesta, red.hueco === true)
}
