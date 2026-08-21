/**
 * De qué campo sacar el instante de captura de cada fotograma.
 *
 * `requestVideoFrameCallback` entrega varias marcas de tiempo y **no todas
 * funcionan en todos los aparatos**. Medido en un iPhone con iOS 26.5:
 *
 *     mediaTime            recorre 0,000 s en 20 s de grabación
 *     captureTime          recorre 20,005 s en 20 s
 *     presentationTime     recorre 20,005 s en 20 s
 *     expectedDisplayTime  recorre 20,005 s en 20 s
 *
 * `mediaTime` existe, es un número finito y perfectamente válido — y **nunca
 * cambia**. Un `Number.isFinite(meta.mediaTime)` lo da por bueno, y entonces
 * las 1.085 muestras de una tanda salen todas con la misma hora. No falla con
 * un error: falla con un resultado sin sentido, que es peor.
 *
 * Así que el reloj no se elige por fe, se elige mirando cuál avanza.
 *
 * Aviso sobre la resolución: en WebKit las marcas vienen **redondeadas a 1 ms**
 * para dificultar el rastreo por huella digital, y eso no se puede desactivar.
 * Medido con el análisis real, ese redondeo cuesta muy poco: a 58,8 fps y con
 * un 10 % de fotogramas perdidos, el 99,6 % de las tomas siguen cayendo dentro
 * del ±2 % (contra el 100 % con reloj perfecto).
 */

// Los candidatos, en orden de preferencia. `escala` lleva cada uno a segundos:
// `mediaTime` ya viene en segundos; los demás son DOMHighResTimeStamp, en ms.
const CANDIDATOS = [
  { nombre: 'mediaTime', campo: 'mediaTime', escala: 1 },
  { nombre: 'captureTime', campo: 'captureTime', escala: 1e-3 },
  { nombre: 'presentationTime', campo: 'presentationTime', escala: 1e-3 },
  { nombre: 'expectedDisplayTime', campo: 'expectedDisplayTime', escala: 1e-3 },
]

/**
 * Observa los primeros fotogramas y se queda con el primer reloj que avance.
 *
 *   const reloj = nuevoReloj()
 *   ...dentro de requestVideoFrameCallback:
 *   const t = reloj.instante(meta, ahora)
 *
 * Mientras decide devuelve el mejor candidato disponible, así que nunca deja
 * al llamante sin un número. La decisión se toma con la vista previa en marcha,
 * mucho antes de que nadie pulse «grabar».
 */
export function nuevoReloj(opciones = {}) {
  const minMuestras = opciones.minMuestras ?? 8
  const vistos = new Map()      // campo -> {primero, cambió}
  let elegido = null
  let resuelto = false   // ya se decidió, aunque la decisión sea «ninguno sirve»
  let n = 0

  return {
    /** Nombre del reloj en uso, o null mientras decide. */
    get nombre() { return elegido ? elegido.nombre : (resuelto ? 'hora de llegada' : null) },
    get decidido() { return resuelto },

    /** Qué candidatos hay y cuáles se han movido. Para enseñarlo en pantalla. */
    diagnostico() {
      return CANDIDATOS.map((c) => {
        const v = vistos.get(c.campo)
        return {
          nombre: c.nombre,
          presente: v !== undefined,
          avanza: v ? v.cambio : false,
          enUso: elegido ? elegido.campo === c.campo : false,
        }
      })
    },

    instante(meta, ahora) {
      const respaldo = ahora / 1000     // el reloj de llegada: peor, pero siempre avanza
      if (!meta) return respaldo

      if (!elegido) {
        n++
        for (const c of CANDIDATOS) {
          const bruto = meta[c.campo]
          if (!Number.isFinite(bruto)) continue
          const v = bruto * c.escala
          const visto = vistos.get(c.campo)
          if (!visto) vistos.set(c.campo, { primero: v, cambio: false })
          else if (!visto.cambio && Math.abs(v - visto.primero) > 1e-9) visto.cambio = true
        }
        if (n >= minMuestras) {
          // El primero de la lista que se haya movido.
          elegido = CANDIDATOS.find((c) => {
            const v = vistos.get(c.campo)
            return v && v.cambio
          }) || null
          // Y si NINGUNO se mueve, hay que quedarse con la hora de llegada.
          // Sin esta marca se seguia devolviendo el primer candidato presente
          // —congelado— para siempre: exactamente el fallo que este modulo
          // existe para evitar, reproducido dentro del modulo.
          resuelto = true
        }
      }

      if (elegido) {
        const bruto = meta[elegido.campo]
        if (Number.isFinite(bruto)) return bruto * elegido.escala
        return respaldo
      }
      if (resuelto) return respaldo     // ningún reloj del fotograma avanza
      // Mientras decide: el primer candidato presente, o la hora de llegada.
      for (const c of CANDIDATOS) {
        const bruto = meta[c.campo]
        if (Number.isFinite(bruto)) return bruto * c.escala
      }
      return respaldo
    },
  }
}
