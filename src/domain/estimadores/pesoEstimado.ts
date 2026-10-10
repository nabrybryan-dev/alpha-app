/**
 * PESO DE HOY, ESTIMADO CON UN RANGO HONESTO.
 *
 * Por qué existe: cuando un asesorado anota pocos pesajes, la consola no debe dar un
 * número suelto (que aparenta una precisión que no hay) ni un hueco (que no ayuda al
 * coach). Da un RANGO y dice con cuántos datos lo calculó. Si hay pocos datos el rango es
 * ancho y así se ve; si hay muchos, se estrecha solo.
 *
 * De dónde sale el algoritmo: lo diseñó y validó Bryan (coach) a mano, en una prueba a
 * ciegas con el PESO de dos personas reales: se escondían los datos recientes y se
 * comprobaba si el peso real caía dentro del rango. Resultado: 12 de 12 intentos dentro
 * del rango. Con 1 pesaje el rango fue de 6-10 kg; con 8, de 3-4 kg (error < 1 kg); con
 * 11-14, de 1,5 kg. Esta función es ESE algoritmo tal cual: las constantes (ruido de
 * 0,6 kg, multiplicadores 2,0 / 2,4 / 3,2, umbral de 3 kg para datos raros, 7 días para
 * hablar de tendencia) son las de la prueba. Cambiarlas invalida las cifras de arriba.
 *
 * OJO CON ESAS CIFRAS (9-oct-2026): la prueba se hizo sobre los pesos tal como estaban guardados, y
 * después se vio que el check-in arrastra el peso del reporte anterior. En la serie de la prueba,
 * 11 de 18 pesos eran repeticiones seguidas. Acertar sobre datos copiados es más fácil, así que el
 * «12 de 12» vale menos de lo que parece. Hay que repetir la prueba con pesos anotados de verdad
 * (`datoAnotado.ts`); hasta entonces las constantes son las de la prueba, no una verdad medida.
 *
 * Qué NO se estima nunca aquí ni con este patrón: dolor, medicación, visto bueno médico
 * y la regla (la menstruación). Son datos que una persona o un profesional dicen; una
 * curva no puede inventarlos. Esta pieza es SOLO el peso, y SOLO para la consola del coach.
 *
 * Pura y sin reloj: `hoyIso` entra como argumento. Los días se cuentan con `Date.UTC`
 * sobre año/mes/día para que la zona horaria del navegador no corra un día.
 */

/** Variación normal de un día a otro (agua, comida, báscula), en kg. */
const RUIDO_KG = 0.6

/** Un pesaje a más de esto de TODOS sus vecinos inmediatos se aparta como dato raro. */
const SALTO_RARO_KG = 3

/** Con menos días que estos entre el primer y el último pesaje no hay tendencia medible. */
const DIAS_MINIMOS_PARA_TENDENCIA = 7

const MS_POR_DIA = 86_400_000

export type MetodoPeso = 'ultimo_dato' | 'tendencia'
export type ConfianzaPeso = 'alta' | 'media' | 'baja'

export interface PesajeEntrada {
  fecha: string
  pesoKg: number
}

export interface PesoEstimado {
  centroKg: number
  bajoKg: number
  altoKg: number
  anchoKg: number
  /** Pesajes que de verdad entraron al cálculo (sin los apartados). */
  n: number
  metodo: MetodoPeso
  /** Solo con `metodo: 'tendencia'`: pendiente de la recta × 7. */
  kgPorSemana?: number
  /** Pesajes que se dejaron fuera por raros. No se borran de ningún sitio: se avisan. */
  apartados: PesajeEntrada[]
  ultimoPesaje: PesajeEntrada
  diasDesdeElUltimo: number
  confianza: ConfianzaPeso
}

interface Pesaje extends PesajeEntrada {
  /** Días enteros desde 1970-01-01 (calendario, sin zona horaria). */
  dia: number
}

/** `2026-09-28` → días enteros desde 1970; `undefined` si no es una fecha real. */
function diaDe(iso: unknown): number | undefined {
  if (typeof iso !== 'string') return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return undefined
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(anio, mes - 1, dia)
  const f = new Date(ms)
  // `Date.UTC` «arregla» el 31 de febrero en vez de rechazarlo: se comprueba que vuelve igual.
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return undefined
  return ms / MS_POR_DIA
}

/** Redondeo a 1 decimal, solo al devolver; evita el `-0`. */
function r1(x: number): number {
  const r = Math.round(x * 10) / 10
  return r === 0 ? 0 : r
}

/** Ordena por fecha, descarta basura y deja un pesaje por día (el último que llegó). */
function limpiar(pesajes: readonly PesajeEntrada[]): Pesaje[] {
  const porDia = new Map<number, Pesaje>()
  for (const p of pesajes) {
    const dia = diaDe(p?.fecha)
    if (dia === undefined) continue
    if (typeof p.pesoKg !== 'number' || !Number.isFinite(p.pesoKg) || p.pesoKg <= 0) continue
    // Mismo día: manda el último de la lista de entrada (el que se anotó después).
    porDia.set(dia, { fecha: p.fecha.slice(0, 10), pesoKg: p.pesoKg, dia })
  }
  return [...porDia.values()].sort((a, b) => a.dia - b.dia)
}

/**
 * Aparta los datos raros: un pesaje que difiere en MÁS de 3 kg de TODOS sus vecinos
 * inmediatos (el anterior y el siguiente; si solo tiene uno, de ese). Se evalúa sobre la
 * serie completa a la vez, no uno por uno, para que el orden no cambie el resultado. Con
 * menos de 3 pesajes no hay con qué contrastar y no se aparta ninguno.
 *
 * Un caso que la regla literal no resuelve (decisión mía, a revisar por Bryan): con una
 * serie MUY corta como 88,35 · 83,35 · 87,75, los dos extremos también quedan a más de
 * 3 kg de su único vecino (el raro) y la regla los apartaba a los tres. Si pasa eso, es
 * decir, si los candidatos serían más que lo que queda, se aparta SOLO el más lejano de
 * la mediana de la serie. En series largas la regla literal ya da un único candidato y
 * este desempate no se activa.
 */
function separarRaros(ordenados: readonly Pesaje[]): { buenos: Pesaje[]; raros: Pesaje[] } {
  if (ordenados.length < 3) return { buenos: [...ordenados], raros: [] }
  const candidatos = ordenados.filter((p, i) => {
    // En los extremos solo hay vecinos de un lado: se miran los DOS más cercanos de ese lado. Con
    // uno solo, el último pesaje se iba por raro cuando su único vecino era el raro de verdad.
    const ultimo = ordenados.length - 1
    const indices = i === 0 ? [1, 2] : i === ultimo ? [ultimo - 1, ultimo - 2] : [i - 1, i + 1]
    const vecinos = indices.map((j) => ordenados[j]).filter((v): v is Pesaje => v !== undefined)
    return vecinos.every((v) => Math.abs(p.pesoKg - v.pesoKg) > SALTO_RARO_KG)
  })
  let raros = candidatos
  if (candidatos.length > ordenados.length - candidatos.length) {
    const pesos = ordenados.map((p) => p.pesoKg).sort((a, b) => a - b)
    const mediana = pesos[Math.floor(pesos.length / 2)]
    const masLejano = [...candidatos].sort((a, b) => Math.abs(b.pesoKg - mediana) - Math.abs(a.pesoKg - mediana))[0]
    raros = [masLejano]
  }
  return { buenos: ordenados.filter((p) => !raros.includes(p)), raros }
}

function confianzaDe(ancho: number): ConfianzaPeso {
  if (ancho <= 2) return 'alta'
  if (ancho <= 5) return 'media'
  return 'baja'
}

export function pesoEstimado(pesajes: readonly PesajeEntrada[], hoyIso: string): PesoEstimado | undefined {
  const hoy = diaDe(hoyIso)
  if (hoy === undefined) return undefined
  const { buenos, raros } = separarRaros(limpiar(pesajes))
  const n = buenos.length
  if (n === 0) return undefined

  const ultimo = buenos[n - 1]
  const primero = buenos[0]
  const diasDesdeElUltimo = Math.max(0, hoy - ultimo.dia)
  const apartados = raros.map(({ fecha, pesoKg }) => ({ fecha, pesoKg }))

  let centro: number
  let bajo: number
  let alto: number
  let metodo: MetodoPeso
  let kgPorSemana: number | undefined

  if (n < 3 || ultimo.dia - primero.dia < DIAS_MINIMOS_PARA_TENDENCIA) {
    // Sin tendencia medible: se parte del último dato y el rango solo se abre con los días
    // que pasan. El rango es asimétrico a propósito (baja 1 % por semana, sube 0,5 %),
    // como en la prueba a ciegas.
    const w0 = ultimo.pesoKg
    const sem = diasDesdeElUltimo / 7
    centro = w0 - 0.0025 * w0 * sem
    bajo = w0 - 0.01 * w0 * sem - RUIDO_KG
    alto = w0 + 0.005 * w0 * sem + RUIDO_KG
    metodo = 'ultimo_dato'
  } else {
    // Mínimos cuadrados de peso contra día; el rango es el de una predicción (no el de la
    // recta), por eso el «1 +» bajo la raíz: un pesaje suelto de hoy tiene su propio ruido.
    const xs = buenos.map((p) => p.dia)
    const ys = buenos.map((p) => p.pesoKg)
    const xm = xs.reduce((a, b) => a + b, 0) / n
    const ym = ys.reduce((a, b) => a + b, 0) / n
    const sxx = xs.reduce((a, x) => a + (x - xm) ** 2, 0)
    const sxy = xs.reduce((a, x, i) => a + (x - xm) * (ys[i] - ym), 0)
    const pendiente = sxy / sxx
    const origen = ym - pendiente * xm
    const residuos2 = xs.reduce((a, x, i) => a + (ys[i] - (origen + pendiente * x)) ** 2, 0)
    // Suelo de RUIDO/2: una serie plana perfecta no puede decir «error cero».
    const s = Math.max(RUIDO_KG / 2, Math.sqrt(residuos2 / Math.max(1, n - 2)))
    const se = s * Math.sqrt(1 + 1 / n + (hoy - xm) ** 2 / sxx)
    const k = n >= 10 ? 2.0 : n >= 6 ? 2.4 : 3.2
    centro = origen + pendiente * hoy
    bajo = centro - k * se
    alto = centro + k * se
    metodo = 'tendencia'
    kgPorSemana = pendiente * 7
  }

  const anchoKg = r1(alto - bajo)
  const resultado: PesoEstimado = {
    centroKg: r1(centro),
    bajoKg: r1(bajo),
    altoKg: r1(alto),
    anchoKg,
    n,
    metodo,
    apartados,
    ultimoPesaje: { fecha: ultimo.fecha, pesoKg: ultimo.pesoKg },
    diasDesdeElUltimo,
    confianza: confianzaDe(anchoKg),
  }
  if (kgPorSemana !== undefined) resultado.kgPorSemana = r1(kgPorSemana)
  return resultado
}
