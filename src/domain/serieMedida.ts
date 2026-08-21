/**
 * De la medición cruda de un vídeo a lo que ve el asesorado.
 *
 * Esta capa existe por una decisión de diseño que conviene no perder: **cuando
 * la medida no vale, la pantalla lo dice arriba y con cifras concretas**, no
 * con un «no se pudo procesar». Cada motivo es un número que el asesorado puede
 * comprobar en su propio vídeo. Eso obliga a que el fallo se razone aquí, con
 * los datos delante, y no en el componente.
 *
 * Y la otra: **lo medido no se tira**. Aunque no haya repeticiones, el
 * recorrido, el pico y los ángulos sí se midieron, así que viajan igualmente.
 * El hueco de repeticiones se marca con `null` —que la pantalla pinta como una
 * raya— y nunca con un cero: un cero es un dato, una raya es una ausencia.
 */

/** Lo que entrega la tubería de visión por cada fotograma con el objeto visible. */
export interface MuestraDeVideo {
  /** Instante de captura, en segundos. */
  t: number
  /** Posición vertical en metros, creciente hacia arriba. */
  alturaM: number
  /** Posición horizontal en metros. */
  lateralM: number
  /** Ángulo del tronco contra la vertical, en grados. */
  troncoGrados?: number
  /** Ángulo del codo (hombro-codo-muñeca), en grados. */
  codoGrados?: number
}

export interface EntradaSerie {
  ejercicio: string
  lado?: 'derecho' | 'izquierdo'
  muestras: MuestraDeVideo[]
  /** Fotogramas del vídeo, incluidos aquellos donde no se vio el objeto. */
  fotogramasTotales: number
  /** Umbral de pérdida de velocidad pautado para este asesorado, en %. */
  umbralPerdidaPct: number
}

export interface MotivoSinMedida {
  /** Clave estable, para pruebas y telemetría. No se enseña. */
  clave: 'codo-estirado' | 'te-desplazas' | 'objeto-tapado' | 'un-solo-ciclo'
  /** La frase corta, en negrita en la pantalla. */
  titulo: string
  /** La cifra que lo sostiene. Sin ella el motivo no se muestra. */
  cifra: string
  detalle: string
}

export interface LoQuedoMedido {
  verticalCm: number | null
  picoMs: number | null
  /** `null` cuando no se pudo contar. La pantalla pinta una raya, nunca un 0. */
  reps: number | null
}

export interface RepeticionMedida {
  indice: number
  velocidadMs: number
}

export interface TempoMedio {
  bajadaS: number
  pausaS: number
  tironS: number
}

export interface SerieConMedida {
  estado: 'medida'
  ejercicio: string
  lado?: 'derecho' | 'izquierdo'
  reps: number
  velocidadMediaMs: number
  recorridoCm: number
  troncoGrados: number | null
  troncoDispersion: number | null
  velocidades: RepeticionMedida[]
  perdidaPct: number
  umbralPct: number
  tempo: TempoMedio | null
}

export interface SerieSinMedida {
  estado: 'sin-medida'
  ejercicio: string
  motivos: MotivoSinMedida[]
  loQuedoMedido: LoQuedoMedido
  fotogramas: { conObjeto: number; totales: number }
  /** Altura contra tiempo, para el gráfico que enseña lo que sí pasó. */
  trazaAltura: Array<{ t: number; alturaM: number }>
}

export type SerieMedida = SerieConMedida | SerieSinMedida

/** Mediana, sin ordenar el array de entrada. */
function mediana(xs: number[]): number {
  if (xs.length === 0) return NaN
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

function desviacion(xs: number[]): number {
  if (xs.length < 2) return NaN
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}

/**
 * Velocidad por diferencias centradas.
 *
 * No se interpola sobre los huecos: si faltan fotogramas, el intervalo es más
 * largo y la velocidad sale promediada sobre él. Inventar puntos donde no se
 * vio nada produciría una curva bonita y falsa.
 */
function velocidades(t: number[], s: number[]): number[] {
  return s.map((_, i) => {
    const a = Math.max(0, i - 1)
    const b = Math.min(s.length - 1, i + 1)
    const dt = t[b] - t[a]
    return dt > 0 ? (s[b] - s[a]) / dt : 0
  })
}

interface Ciclo {
  iIni: number
  iFin: number
  velocidadMediaMs: number
  recorridoM: number
  concentricaS: number
  excentricaS: number
  pausaS: number
}

/**
 * Parte la serie en repeticiones.
 *
 * Un ciclo es un tramo de subida continua entre dos valles. Se exige un
 * recorrido mínimo para no contar como repetición el temblor de quien sujeta la
 * mancuerna esperando.
 */
export function segmentarCiclos(
  t: number[],
  s: number[],
  recorridoMinimoM = 0.08,
): Ciclo[] {
  if (t.length < 6) return []
  const v = velocidades(t, s)
  const ciclos: Ciclo[] = []
  let iValle: number | null = null

  for (let i = 1; i < s.length; i++) {
    const subiendo = v[i] > 0
    const subiendoAntes = v[i - 1] > 0
    if (subiendo && !subiendoAntes) iValle = i - 1
    if (!subiendo && subiendoAntes && iValle !== null) {
      const iPico = i - 1
      const recorrido = s[iPico] - s[iValle]
      if (recorrido >= recorridoMinimoM) {
        const dur = t[iPico] - t[iValle]
        // Excéntrica y pausa: lo que va del pico anterior a este valle.
        const iPicoPrevio = ciclos.length ? ciclos[ciclos.length - 1].iFin : null
        let excentrica = 0
        let pausa = 0
        if (iPicoPrevio !== null) {
          const bajada = t[iValle] - t[iPicoPrevio]
          // La pausa es el tramo quieto justo antes de tirar: se mide como el
          // tiempo con velocidad casi nula al final de la bajada.
          let j = iValle
          while (j > iPicoPrevio && Math.abs(v[j]) < 0.05) j--
          pausa = t[iValle] - t[j]
          excentrica = Math.max(0, bajada - pausa)
        }
        ciclos.push({
          iIni: iValle,
          iFin: iPico,
          velocidadMediaMs: dur > 0 ? recorrido / dur : 0,
          recorridoM: recorrido,
          concentricaS: dur,
          excentricaS: excentrica,
          pausaS: pausa,
        })
      }
      iValle = null
    }
  }
  return ciclos
}

const cm = (m: number) => Math.round(m * 1000) / 10
const dec = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n

/**
 * Decide si la serie se pudo medir, y si no, por qué.
 *
 * El orden de los motivos importa: van del más determinante al menos. Quien
 * lee solo el primero tiene que quedarse con la causa principal.
 */
export function interpretarSerie(entrada: EntradaSerie): SerieMedida {
  const { ejercicio, lado, muestras, fotogramasTotales, umbralPerdidaPct } = entrada
  const validas = muestras.filter((m) => Number.isFinite(m.alturaM) && Number.isFinite(m.t))

  const t = validas.map((m) => m.t)
  const s = validas.map((m) => m.alturaM)
  const x = validas.map((m) => m.lateralM)

  const recorridoVerticalM = s.length ? Math.max(...s) - Math.min(...s) : 0
  const recorridoLateralM = x.length ? Math.max(...x) - Math.min(...x) : 0
  const picoMs = s.length > 2 ? Math.max(...velocidades(t, s).map(Math.abs)) : 0

  const troncos = validas.map((m) => m.troncoGrados).filter((a): a is number => Number.isFinite(a))
  const codos = validas.map((m) => m.codoGrados).filter((a): a is number => Number.isFinite(a))

  const ciclos = segmentarCiclos(t, s)

  const motivos: MotivoSinMedida[] = []

  // 1 · El codo casi no se dobla. Sin flexión no hay tirón que medir, así que
  //     este motivo va primero: explica todos los demás.
  const codoMedio = codos.length ? mediana(codos) : NaN
  if (Number.isFinite(codoMedio) && codoMedio > 150) {
    motivos.push({
      clave: 'codo-estirado',
      titulo: 'El codo casi no se dobla.',
      cifra: `${Math.round(codoMedio)}° de media`,
      detalle: 'el brazo va estirado todo el tramo, así que no hay tirón.',
    })
  }

  // 2 · Te desplazas por la habitación. Si el recorrido horizontal supera al
  //     vertical, lo que se ha seguido es a la persona andando, no el gesto.
  if (recorridoLateralM > recorridoVerticalM * 1.5 && recorridoLateralM > 0.3) {
    motivos.push({
      clave: 'te-desplazas',
      titulo: `La mancuerna recorre ${cm(recorridoLateralM)} cm en horizontal.`,
      cifra: 'Se desplaza contigo',
      detalle: 'por la habitación, no sube y baja.',
    })
  }

  // 3 · El objeto se pierde de vista demasiado rato.
  const proporcionVista = fotogramasTotales > 0 ? validas.length / fotogramasTotales : 1
  if (proporcionVista < 0.8) {
    motivos.push({
      clave: 'objeto-tapado',
      titulo: `La mano la tapa ${Math.round((1 - proporcionVista) * 100)} % del tiempo.`,
      cifra: `Solo ${validas.length} de ${fotogramasTotales}`,
      detalle: 'fotogramas con la mancuerna a la vista.',
    })
  }

  // 4 · Un solo gesto no es una serie. Va el último porque, cuando aparece
  //     junto a los anteriores, es su consecuencia y no la causa.
  if (ciclos.length < 2) {
    const dur = ciclos.length === 1 ? dec(t[ciclos[0].iFin] - t[ciclos[0].iIni], 2) : null
    motivos.push({
      clave: 'un-solo-ciclo',
      titulo: ciclos.length === 1
        ? `Un solo gesto de subida y bajada en ${dur} s.`
        : 'No se reconoció ningún gesto de subida y bajada.',
      cifra: 'Hacen falta al menos dos ciclos',
      detalle: 'seguidos para contar repeticiones.',
    })
  }

  if (motivos.length > 0) {
    return {
      estado: 'sin-medida',
      ejercicio,
      motivos,
      loQuedoMedido: {
        verticalCm: recorridoVerticalM > 0 ? cm(recorridoVerticalM) : null,
        picoMs: picoMs > 0 ? dec(picoMs, 2) : null,
        reps: null,
      },
      fotogramas: { conObjeto: validas.length, totales: fotogramasTotales },
      trazaAltura: validas.map((m) => ({ t: m.t, alturaM: m.alturaM })),
    }
  }

  // A partir de aquí la serie SÍ se midió.
  const velocidadesRep = ciclos.map((c, i) => ({
    indice: i + 1,
    velocidadMs: dec(c.velocidadMediaMs, 2),
  }))
  // v₁ es la mejor de las dos primeras: una primera repetición dubitativa
  // —se coloca, respira— no debe fijar la referencia del día.
  const vPrimera = Math.max(ciclos[0].velocidadMediaMs, ciclos[1].velocidadMediaMs)
  const vUltima = ciclos[ciclos.length - 1].velocidadMediaMs
  const perdidaPct = vPrimera > 0 ? ((vPrimera - vUltima) / vPrimera) * 100 : 0

  const conTempo = ciclos.filter((c) => c.excentricaS > 0)
  const tempo: TempoMedio | null = conTempo.length
    ? {
      bajadaS: dec(conTempo.reduce((a, c) => a + c.excentricaS, 0) / conTempo.length, 1),
      pausaS: dec(conTempo.reduce((a, c) => a + c.pausaS, 0) / conTempo.length, 1),
      tironS: dec(conTempo.reduce((a, c) => a + c.concentricaS, 0) / conTempo.length, 1),
    }
    : null

  return {
    estado: 'medida',
    ejercicio,
    lado,
    reps: ciclos.length,
    velocidadMediaMs: dec(ciclos.reduce((a, c) => a + c.velocidadMediaMs, 0) / ciclos.length, 2),
    recorridoCm: Math.round(cm(mediana(ciclos.map((c) => c.recorridoM)))),
    troncoGrados: troncos.length ? Math.round(mediana(troncos.map(Math.abs))) : null,
    troncoDispersion: troncos.length > 1 ? Math.round(desviacion(troncos.map(Math.abs))) : null,
    velocidades: velocidadesRep,
    perdidaPct: Math.round(perdidaPct),
    umbralPct: umbralPerdidaPct,
    tempo,
  }
}

/**
 * La frase que compara bajada y tirón. Vive aquí y no en la pantalla porque
 * es una afirmación sobre los datos, y se prueba como tal.
 */
export function proporcionTempo(tempo: TempoMedio): { veces: number; frase: string } | null {
  if (!(tempo.tironS > 0)) return null
  const veces = dec(tempo.bajadaS / tempo.tironS, 1)
  return { veces, frase: `La bajada te dura ${veces.toFixed(1).replace('.', ',')} veces lo que el tirón.` }
}
