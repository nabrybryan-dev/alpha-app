import type { NivelCalidad } from './nucleo/analisis'

export type Modo = 'serie' | 'gravedad'
export type Referencia = 'diana4' | 'marcadores' | 'disco'

/** Una fila de la tanda. Lo que no se midió va `undefined` y sale vacío en el
 *  CSV: rellenarlo con ceros convertiría «no lo sé» en «salió cero». */
export interface Medicion {
  fecha: string
  modo: Modo
  ejercicio: string
  cargaKg?: number
  /** LAS CUENTAS TÚ, no la app. Es el dato que destapa el modo de fallo
   *  dominante de las apps de cámara, y no aparece si solo miras los m/s. */
  repsReales?: number
  repsDetectadas: number
  vPrimera?: number
  vUltima?: number
  /** La de la PRIMERA repetición según el instrumento de referencia. */
  vRef?: number
  /** La de la ÚLTIMA. No se compara sola: existe para poder calcular `pvRefPct`. */
  vRefUltima?: number
  pvPct?: number
  pvRefPct?: number
  fpsReal?: number
  unidad?: 'm/s' | 'px/s'
  calidad: NivelCalidad
  motivos: string
  aceleracion?: number
  errorPct?: number
  /** El recorrido mediano de la serie, en metros. Va al CSV porque es lo único
   *  que delata un diámetro de disco mal elegido: con la escala equivocada las
   *  velocidades salen desviadas por un factor constante y no chirría nada,
   *  pero una sentadilla de 1,40 m sí chirría. Ver `escala.ts`. */
  romM?: number
  /** `true` cuando ese recorrido no es posible para ese ejercicio. Vacío
   *  cuando no se pudo juzgar —sin escala no hay metros que comparar—, que no
   *  es lo mismo que estar bien. */
  escalaDudosa?: boolean
  /** Segundos de «Parar y analizar» a «Guardar»: lo que la medición le roba a
   *  la serie con el asesorado de pie esperando. */
  sAnadidos?: number
  /** De esos, cuántos fueron máquina y no tecleo. */
  sMaquina?: number
  nota: string
}

export const redondea2 = (x: number) => Math.round(x * 100) / 100

/** El %PV del instrumento de referencia, con la MISMA fórmula que `analisis.js`
 *  usa para el nuestro. Si las dos se separan, los dos números dejan de ser
 *  comparables y nada avisa. */
export function pvDeReferencia(vPrimera?: number, vUltima?: number): number | undefined {
  if (!Number.isFinite(vPrimera) || !Number.isFinite(vUltima)) return undefined
  if (!vPrimera || vPrimera <= 0 || !vUltima || vUltima <= 0) return undefined
  return redondea2(((vPrimera - vUltima) / vPrimera) * 100)
}

/** Mediana y no media: basta con que una vez suene el teléfono a mitad de
 *  teclear para que la media de cinco se vaya al doble. */
export function mediana(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

export interface Criterio {
  etiqueta: string
  umbral: string
  /** `undefined` = todavía no hay datos para contestarlo. */
  valor?: string
  cumple?: boolean
  detalle?: string
}

const finito = (x: number | undefined): x is number =>
  typeof x === 'number' && Number.isFinite(x)

/**
 * Los ocho criterios de la fase 2, recalculados en cada guardado.
 *
 * Los umbrales se escribieron ANTES de medir; aquí solo se comparan. Y en los
 * dos errores que se promedian sobre varias tomas se promedia el VALOR
 * ABSOLUTO: con el signo, una tanda dispersa pero centrada aprobaría sin ser
 * fiable, que es justo lo que hay que detectar.
 */
export function criteriosDeLaTanda(filas: Medicion[]): Criterio[] {
  const series = filas.filter((f) => f.modo === 'serie')
  const conCuenta = series.filter((f) => finito(f.repsReales))
  const perdidas = conCuenta.reduce(
    (a, f) => a + Math.max(0, f.repsReales! - f.repsDetectadas), 0)
  const fantasma = conCuenta.reduce(
    (a, f) => a + Math.max(0, f.repsDetectadas - f.repsReales!), 0)
  const totalReales = conCuenta.reduce((a, f) => a + f.repsReales!, 0)

  const conRef = series.filter((f) => finito(f.vRef) && finito(f.vPrimera))
  const difV = conRef.map((f) => f.vPrimera! - f.vRef!)
  const mediaV = difV.length ? difV.reduce((a, b) => a + b, 0) / difV.length : undefined
  const maxV = difV.length ? Math.max(...difV.map(Math.abs)) : undefined

  const conPV = series.filter((f) => finito(f.pvPct) && finito(f.pvRefPct))
  const difPV = conPV.map((f) => f.pvPct! - f.pvRefPct!)
  const errorPV = difPV.length
    ? difPV.reduce((a, b) => a + Math.abs(b), 0) / difPV.length
    : undefined
  const maxPV = difPV.length ? Math.max(...difPV.map(Math.abs)) : undefined

  const buenas = series.filter((f) => f.calidad === 'buena').length
  const pctValidas = series.length > 0 ? (buenas / series.length) * 100 : undefined
  const pctPerdidas = totalReales > 0 ? (perdidas / totalReales) * 100 : undefined

  // Solo cuentan las tomas que se pudieron juzgar: sin escala el recorrido está
  // en píxeles y no hay metros que comparar. Un `undefined` es «no lo sé», y
  // meterlo en el saco de las buenas seria dar por pasada una puerta que no se
  // ha mirado.
  const conRom = series.filter((f) => f.escalaDudosa !== undefined)
  const dudosas = conRom.filter((f) => f.escalaDudosa).length

  const sAnadidos = mediana(filas.map((f) => f.sAnadidos).filter(finito))
  const sMaquina = mediana(filas.map((f) => f.sMaquina).filter(finito))

  const caidas = filas.filter((f) => f.modo === 'gravedad' && finito(f.errorPct))
  const errorG = caidas.length
    ? caidas.reduce((a, f) => a + Math.abs(f.errorPct!), 0) / caidas.length
    : undefined

  const bajo = (x: number | undefined, tope: number) => (x === undefined ? undefined : x <= tope)
  const alto = (x: number | undefined, tope: number) => (x === undefined ? undefined : x >= tope)
  const mediaVAbs = mediaV === undefined ? undefined : Math.abs(mediaV)

  return [
    {
      etiqueta: 'Error medio de v₁ vs referencia',
      umbral: '≤ 0,050 m/s',
      valor: mediaVAbs?.toFixed(3),
      cumple: bajo(mediaVAbs, 0.05),
      detalle: `${conRef.length} series con referencia`,
    },
    {
      etiqueta: 'Error máximo de v₁',
      umbral: '≤ 0,050 m/s',
      valor: maxV?.toFixed(3),
      cumple: bajo(maxV, 0.05),
    },
    {
      etiqueta: 'Error de %PV vs referencia',
      umbral: '≤ 5 puntos',
      valor: errorPV?.toFixed(1),
      cumple: bajo(errorPV, 5),
      detalle: conPV.length
        ? `${conPV.length} series, peor ${maxPV!.toFixed(1)}`
        : 'hacen falta las DOS velocidades de referencia',
    },
    {
      etiqueta: 'Repeticiones perdidas',
      umbral: '≤ 2 %',
      valor: pctPerdidas === undefined ? undefined : `${pctPerdidas.toFixed(1)} %`,
      cumple: bajo(pctPerdidas, 2),
      detalle: `${perdidas} de ${totalReales}`,
    },
    {
      etiqueta: 'Repeticiones fantasma',
      umbral: '= 0',
      valor: conCuenta.length ? String(fantasma) : undefined,
      cumple: conCuenta.length ? fantasma === 0 : undefined,
    },
    {
      etiqueta: 'Mediciones válidas / intentadas',
      umbral: '≥ 60 %',
      valor: pctValidas === undefined ? undefined : `${pctValidas.toFixed(0)} %`,
      cumple: alto(pctValidas, 60),
      detalle: `${buenas} de ${series.length}`,
    },
    {
      etiqueta: 'Segundos añadidos por serie',
      umbral: '< 20 s',
      valor: sAnadidos === undefined ? undefined : `${sAnadidos.toFixed(1)} s`,
      cumple: sAnadidos === undefined ? undefined : sAnadidos < 20,
      detalle: sMaquina === undefined
        ? undefined
        : `${sMaquina.toFixed(1)} s de máquina, el resto es teclear`,
    },
    {
      // El error de escala no aparece en ningún otro criterio, y es el que más
      // daño hace: con el disco mal elegido las velocidades salen desviadas por
      // un factor constante, la calidad sale «buena» y el %PV ni se entera
      // —es un cociente entre dos velocidades medidas con la misma regla mala—.
      // Lo único que lo delata es un recorrido imposible. Ver `escala.ts`.
      etiqueta: 'Tomas con la escala en duda',
      umbral: '= 0',
      valor: conRom.length ? String(dudosas) : undefined,
      cumple: conRom.length ? dudosas === 0 : undefined,
      detalle: conRom.length
        ? `${conRom.length} series con recorrido en metros`
        : 'hace falta al menos una toma con escala',
    },
    {
      etiqueta: 'Prueba de gravedad (error medio)',
      umbral: '≤ 2 %',
      valor: errorG === undefined ? undefined : `${errorG.toFixed(2)} %`,
      cumple: bajo(errorG, 2),
      detalle: `${caidas.length} caídas`,
    },
  ]
}

/**
 * ¿Hay en la tanda alguna caída que valide la escala de este montaje?
 *
 * La prueba de gravedad es la única verdad de balde que tiene la herramienta:
 * se suelta el implemento, se ajusta la parábola y la aceleración tiene que
 * salir la g del sitio. Valida **escala y tiempos a la vez** y nadie discute la
 * física, así que es lo único que puede levantar la sospecha sobre el disco —
 * cuya escala falla en cuatro de cada cinco fotogramas reales.
 *
 * El 2 % es el mismo umbral que el criterio de la tanda: dos números distintos
 * para la misma pregunta acabarían diciendo cosas distintas.
 */
export function gravedadAprobada(filas: Medicion[]): boolean {
  return filas.some((f) => f.modo === 'gravedad' && finito(f.errorPct) && Math.abs(f.errorPct) <= 2)
}

export const COLUMNAS_CSV = [
  'fecha', 'modo', 'ejercicio', 'cargaKg', 'repsReales', 'repsDetectadas', 'vPrimera',
  'vUltima', 'vRef', 'vRefUltima', 'pvPct', 'pvRefPct', 'fpsReal', 'unidad', 'calidad',
  'motivos', 'romM', 'escalaDudosa', 'aceleracion', 'errorPct', 'sAnadidos', 'sMaquina', 'nota',
] as const

/** CSV con comillas donde hacen falta. Lo que falta sale vacío, no «undefined». */
export function aCsv(filas: Medicion[]): string {
  const escapar = (v: unknown) => {
    if (v === undefined || v === null) return ''
    const texto = String(v)
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  return [COLUMNAS_CSV.join(',')]
    .concat(
      filas.map((f) =>
        COLUMNAS_CSV.map((c) => escapar((f as unknown as Record<string, unknown>)[c])).join(',')),
    )
    .join('\n')
}

/** La tanda vive en el navegador, no en la base: mientras la prueba de gravedad
 *  no apruebe, estos números no tienen sitio en el historial de nadie. */
export const CLAVE_TANDA = 'alpha-encoder-fase2'

export function leerTanda(): Medicion[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_TANDA) ?? '[]') as Medicion[]
  } catch {
    return []
  }
}

export function anadirATanda(fila: Medicion): Medicion[] {
  const siguiente = [...leerTanda(), fila]
  try {
    localStorage.setItem(CLAVE_TANDA, JSON.stringify(siguiente))
  } catch {
    /* cuota llena: la fila se pierde, pero la sesión no se interrumpe */
  }
  return siguiente
}
