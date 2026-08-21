/**
 * De lo que la pantalla entiende a lo que la base guarda.
 *
 * `interpretarSerie` produce un `SerieMedida`, que está hecho para PINTARSE:
 * lleva títulos, cifras y frases. La tabla `mediciones_velocidad` guarda el
 * HECHO, que es otra cosa: columnas comparables, vocabulario cerrado y nada de
 * texto para leer. Este módulo es la traducción, y es puro.
 *
 * Vive en `domain/` y no en `data/` a propósito: decidir si una serie es buena,
 * dudosa o descartada es una regla de negocio —es la puerta de entrada del
 * motor, contrato §5— y no un detalle de cómo se guarda.
 *
 * Ver `wiki/motor-velocidad/contrato-datos.md` y la migración 0043.
 */
import type { SerieMedida, MotivoSinMedida } from './serieMedida'

/**
 * El vocabulario cerrado, en la forma que acepta el CHECK de la 0043.
 *
 * Son DOS familias y no se mezclan, aunque compartan columna:
 *
 *   · Las de la captura (`pocos_fps`, `marcador_perdido`, `sin_escala`…) dicen
 *     por qué falló la MEDICIÓN. Las emite la herramienta de cámara.
 *   · Las del gesto (`codo_estirado`, `te_desplazas`…) dicen por qué el
 *     MOVIMIENTO no era medible aunque la cámara fuera perfecta. Las emite
 *     `interpretarSerie`.
 *
 * Traducir unas a otras destruiría lo único que justifica tener vocabulario
 * cerrado, que es poder contar qué falla más para arreglar el protocolo.
 */
export type MotivoCalidad =
  | 'pocos_fps' | 'marcador_perdido' | 'angulo' | 'pocas_reps' | 'sin_escala'
  | 'inclinacion_no_medible' | 'referencia_torcida' | 'salto_imposible'
  | 'radio_incoherente' | 'sin_segmentar' | 'contorno_parcial' | 'camara_movida'
  | 'rom_implausible' | 'contraste'
  | 'codo_estirado' | 'te_desplazas' | 'objeto_tapado' | 'un_solo_ciclo'

export type Calidad = 'buena' | 'dudosa' | 'descartada'

/** Lo que la fila necesita saber y la serie no puede saber por sí sola. */
export interface ContextoMedicion {
  usuarioId: string
  microcicloId?: string
  /** `YYYY-MM-DD`. */
  fecha: string
  ejercicioId: string
  /** Se congela: los catálogos se renombran y la fila tiene que seguir leyéndose. */
  ejercicioNom: string
  ordenSerie: number
  cargaKg: number
  /** `v1.0.0`. Sin esto no se pueden comparar épocas. */
  versionAlgo: string
  /** fps REAL medido, resolución, reloj usado, escala, inclinación, plataforma. */
  captura: Record<string, unknown>
}

export interface MedicionVelocidad {
  id: string
  usuarioId: string
  microcicloId: string | null
  fecha: string
  ejercicioId: string
  ejercicioNom: string
  ordenSerie: number
  cargaKg: number
  repsMedidas: number | null
  vPrimera: number | null
  vUltima: number | null
  pvPct: number | null
  concMsMedia: number | null
  tipoVelocidad: 'VM'
  calidad: Calidad
  motivosCalidad: MotivoCalidad[]
  versionAlgo: string
  captura: Record<string, unknown>
  reps: Array<{ n: number; vMedia: number }>
}

/**
 * `codo-estirado` -> `codo_estirado`.
 *
 * Los dos vocabularios nacieron con convenciones distintas y la columna solo
 * admite una. Se normaliza aquí, en un sitio, y no en cada sitio que escribe.
 */
export function claveDeMotivo(m: MotivoSinMedida): MotivoCalidad {
  return m.clave.replace(/-/g, '_') as MotivoCalidad
}

/**
 * La calidad sale de CUÁNTOS motivos hay, no de cuáles. Contrato §5: ninguno es
 * `buena`, uno es `dudosa` —se guarda y se le enseña al coach, pero no toca
 * ninguna carga— y dos o más es `descartada`.
 *
 * `interpretarSerie` solo devuelve `sin-medida` dentro de `if (motivos.length >
 * 0)`, así que una serie sin medida SIEMPRE trae al menos un motivo. Es la
 * invariante de la que depende el CHECK `mediciones_motivo_obligatorio`, y por
 * eso hay una prueba que la fija.
 */
export function calidadDe(motivos: MotivoCalidad[]): Calidad {
  if (motivos.length === 0) return 'buena'
  if (motivos.length === 1) return 'dudosa'
  return 'descartada'
}

/**
 * El id SE DERIVA, no se sortea.
 *
 * Sale de las mismas cuatro cosas que el `unique (usuario_id, fecha,
 * ejercicio_id, orden_serie)` de la tabla, así que volver a medir la misma serie
 * REFRESCA su fila en vez de crear otra. Es la lección de la despensa: con un id
 * aleatorio, repetir una medición insertaría una fila nueva cada vez y no habría
 * forma de saber cuál manda.
 *
 * Aquí importa más que en la despensa, porque repetir una medición no es raro:
 * es lo que uno hace cuando la primera sale `descartada`.
 */
export function idDeMedicion(c: {
  usuarioId: string; fecha: string; ejercicioId: string; ordenSerie: number
}): string {
  return `${c.usuarioId}:${c.fecha}:${c.ejercicioId}:${c.ordenSerie}`
}

/** Redondea a los decimales que admite la columna, sin arrastrar coma flotante. */
const dec = (x: number, n: number): number => Math.round(x * 10 ** n) / 10 ** n

/**
 * La traducción. No inventa nada: lo que la serie no midió sale `null`, porque
 * el contrato dice que **una medición degradada sigue valiendo** —vale como
 * registro de que el protocolo falló ahí, y esa es la materia prima para
 * arreglarlo—.
 */
export function aMedicion(serie: SerieMedida, ctx: ContextoMedicion): MedicionVelocidad {
  const comun = {
    id: idDeMedicion(ctx),
    usuarioId: ctx.usuarioId,
    microcicloId: ctx.microcicloId ?? null,
    fecha: ctx.fecha,
    ejercicioId: ctx.ejercicioId,
    ejercicioNom: ctx.ejercicioNom,
    ordenSerie: ctx.ordenSerie,
    cargaKg: ctx.cargaKg,
    tipoVelocidad: 'VM' as const,
    versionAlgo: ctx.versionAlgo,
    captura: ctx.captura,
  }

  if (serie.estado === 'medida') {
    const vs = serie.velocidades
    return {
      ...comun,
      repsMedidas: serie.reps,
      vPrimera: vs.length ? dec(vs[0].velocidadMs, 3) : null,
      vUltima: vs.length ? dec(vs[vs.length - 1].velocidadMs, 3) : null,
      pvPct: dec(serie.perdidaPct, 2),
      // El tirón ES la concéntrica. En milisegundos, que es lo que guarda la
      // columna: comparar tempos en segundos con dos decimales pierde la
      // diferencia entre 0,61 y 0,614, y esa diferencia es medio 1 % de v.
      concMsMedia: serie.tempo ? Math.round(serie.tempo.tironS * 1000) : null,
      calidad: 'buena',
      motivosCalidad: [],
      reps: vs.map((r) => ({ n: r.indice, vMedia: dec(r.velocidadMs, 3) })),
    }
  }

  const motivos = serie.motivos.map(claveDeMotivo)
  return {
    ...comun,
    // Lo poco que se salvó sí se guarda. `loQuedoMedido` existe justamente
    // porque una serie sin medida no es una serie sin datos.
    repsMedidas: serie.loQuedoMedido.reps,
    vPrimera: null,
    vUltima: null,
    pvPct: null,
    concMsMedia: null,
    calidad: calidadDe(motivos),
    motivosCalidad: motivos,
    reps: [],
  }
}
