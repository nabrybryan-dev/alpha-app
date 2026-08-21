import type { SerieConMedida, SerieSinMedida } from '../../domain/serieMedida'

/**
 * Las dos series del diseño, para poder ver la pantalla antes de que exista la
 * medición real.
 *
 * **Qué es real y qué no**, porque importa: las cifras de la serie fallida
 * salen de un vídeo de verdad —IMG_6434, 16,4 a 18,5 s— pasado por seguimiento
 * de color con la cabeza hexagonal como escala. La serie válida es de ejemplo:
 * esa toma no existe todavía.
 *
 * Este fichero desaparece cuando la tubería de visión entregue
 * `EntradaSerie`. El punto de enganche es `interpretarSerie`, que ya está
 * escrito y probado: lo único que falta es quien le dé las muestras.
 */

/** Reconstruye la traza real del vídeo: un solo gesto de subida y bajada. */
function trazaDeLaToma(): Array<{ t: number; alturaM: number }> {
  const puntos: Array<{ t: number; alturaM: number }> = []
  const fps = 60
  const t0 = 16.42
  const tSuelta = 17.1
  const tPico = 18.15
  for (let i = 0; i <= Math.round((18.5 - t0) * fps); i++) {
    const t = t0 + i / fps
    let alturaM = 0
    if (t > tSuelta && t <= tPico) {
      const u = (t - tSuelta) / (tPico - tSuelta)
      alturaM = Math.sin(u * Math.PI) * 0.232
    }
    // La mano tapa la mancuerna un tercio del tiempo: hay huecos de verdad.
    const visible = !(i % 7 === 3 || i % 11 === 5)
    if (visible) puntos.push({ t: Math.round(t * 1000) / 1000, alturaM })
  }
  return puntos
}

export const SERIE_SIN_MEDIDA: SerieSinMedida = {
  estado: 'sin-medida',
  ejercicio: 'Sin identificar',
  motivos: [
    {
      clave: 'codo-estirado',
      titulo: 'El codo casi no se dobla.',
      cifra: '161° de media',
      detalle: 'el brazo va estirado todo el tramo, así que no hay tirón.',
    },
    {
      clave: 'te-desplazas',
      titulo: 'La mancuerna recorre 80 cm en horizontal.',
      cifra: 'Se desplaza contigo',
      detalle: 'por la habitación, no sube y baja.',
    },
    {
      clave: 'objeto-tapado',
      titulo: 'La mano la tapa un tercio del tiempo.',
      cifra: 'Solo 125 de 193',
      detalle: 'fotogramas con la mancuerna a la vista.',
    },
    {
      clave: 'un-solo-ciclo',
      titulo: 'Un solo gesto de subida y bajada en 2,09 s.',
      cifra: 'Hacen falta al menos dos ciclos',
      detalle: 'seguidos para contar repeticiones.',
    },
  ],
  loQuedoMedido: { verticalCm: 23.2, picoMs: 0.92, reps: null },
  fotogramas: { conObjeto: 125, totales: 193 },
  trazaAltura: trazaDeLaToma(),
}

export const SERIE_CON_MEDIDA: SerieConMedida = {
  estado: 'medida',
  ejercicio: 'Remo',
  lado: 'derecho',
  reps: 8,
  velocidadMediaMs: 0.63,
  recorridoCm: 41,
  troncoGrados: 34,
  troncoDispersion: 3,
  velocidades: [
    { indice: 1, velocidadMs: 0.78 },
    { indice: 2, velocidadMs: 0.76 },
    { indice: 3, velocidadMs: 0.73 },
    { indice: 4, velocidadMs: 0.69 },
    { indice: 5, velocidadMs: 0.65 },
    { indice: 6, velocidadMs: 0.59 },
    { indice: 7, velocidadMs: 0.54 },
    { indice: 8, velocidadMs: 0.54 },
  ],
  perdidaPct: 31,
  umbralPct: 30,
  tempo: { bajadaS: 2.1, pausaS: 0.3, tironS: 0.8 },
}
