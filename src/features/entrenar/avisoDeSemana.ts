import { semanaEsAdelantada, semanaEsVencida, ultimoDiaDe } from '../../domain/rutaEntrenamiento'
import type { Microciclo } from '../../domain/types'

/**
 * EL AVISO DE «ESTA SEMANA NO ES LA DE HOY», EN UN SOLO SITIO.
 *
 * Vivía dentro de `PanelInferior`, como el pie del recuadro «La semana» del salón. La
 * lista sencilla (`RutaSimple`) no decía nada, y sin aviso la semana vieja es idéntica a
 * una nueva: un asesorado la vio así trece días seguidos (7-sep-2026). Copiar los dos
 * textos allí habría dejado dos sitios diciendo lo mismo con palabras que se separan al
 * primer arreglo, así que la decisión y los textos suben aquí y las dos pantallas la
 * llaman.
 *
 * Es pura: recibe el microciclo y el día de hoy (`AAAA-MM-DD`) y no lee el reloj, para que
 * se pueda probar con fechas concretas. La decisión de fondo sigue siendo del dominio
 * (`semanaEsAdelantada`, `semanaEsVencida`); esto solo le pone palabras.
 *
 * El tercer caso del pie del salón —«Semana X · Microciclo N», cuando no pasa ninguna de
 * las dos— NO está aquí: depende del bloque de la ruta, que la lista sencilla no usa, y
 * una semana en regla no necesita aviso.
 */
export interface AvisoDeSemana {
  /** `adelantada`: aún no ha empezado. `vencida`: ya terminó y no ha llegado el siguiente. */
  tipo: 'adelantada' | 'vencida'
  texto: string
}

/** «7 sep», para decir cuándo terminó. Sin fecha, nada: no se inventa un día. */
function fechaCorta(fechaIso: string | undefined): string {
  if (!fechaIso) return ''
  return new Date(`${fechaIso}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function avisoDeSemana(microciclo: Microciclo, hoy: string): AvisoDeSemana | undefined {
  // «Próxima semana» cuando el microciclo aún no ha arrancado (#209, de main): la rejilla
  // es la de la semana que VIENE y ningún día está marcado como hoy; sin decirlo, la
  // persona busca el día en el que está y no lo encuentra.
  if (semanaEsAdelantada(microciclo, hoy)) {
    return { tipo: 'adelantada', texto: `Próxima semana · Microciclo ${microciclo.numero}` }
  }
  // Y «terminó el …» cuando ya venció y no ha llegado el siguiente: las sesiones se quedan
  // a propósito —entrenar el plan viejo es mejor que nada—, pero sin decirlo la semana
  // vieja es idéntica a una nueva.
  if (semanaEsVencida(microciclo, hoy)) {
    return {
      tipo: 'vencida',
      texto: `El microciclo ${microciclo.numero} terminó el ${fechaCorta(ultimoDiaDe(microciclo))} · tu coach prepara el siguiente`,
    }
  }
  return undefined
}
