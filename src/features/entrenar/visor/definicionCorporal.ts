import { construirHuesos } from '../../../domain/patrones/huesos'
import { juegoConProporciones } from '../../../domain/patrones/estatura'
import { esqueletoConJuego, esqueletoDe, JUEGOS, type Sexo } from '../../../domain/patrones/juegoDeHuesos'
import type { ProporcionesDelCuerpo } from '../../../domain/patrones/huellaArticular'
import type { DefinicionHueso } from '../../../domain/patrones/esqueleto'
import { resolver } from '../../../domain/patrones/esqueleto'
import { longitudesEnReposo } from '../../../domain/patrones/musculos'
import type { Malla } from '../../../domain/patrones/malla'

/**
 * CON QUÉ CUERPO SE DIBUJA A ESTA PERSONA, y sus cachés.
 *
 * Salió de `VisorPatron.tsx` el 2026-09-08 tal cual, sin cambiarle una línea. Es la
 * respuesta a una sola pregunta —¿qué huesos, y de qué medidas, para este sexo, esta
 * estatura y estas proporciones?— y no tenía nada que ver con montar un contexto WebGL:
 * dentro del componente solo se podía probar levantando el visor entero, y en jsdom no
 * hay WebGL. Aquí se prueba llamando a una función.
 *
 * `esqueletoDe` se reexporta a propósito: el visor pide el juego del atlas por ese mismo
 * nombre en el efecto que monta la escena, y quien lee este archivo tiene entonces las
 * dos puertas —la de siempre y la de la persona medida— una al lado de la otra.
 */

export { esqueletoDe }

/**
 * Se calculan una sola vez POR JUEGO DE HUESOS para toda la vida de la app: el esqueleto
 * es geometría fija —la mueve el shader— y las longitudes en reposo son la línea base
 * contra la que se mide cuánto se acorta cada músculo. Un juego es un sexo (ver
 * `juegoDeHuesos.ts`); el neutro es el de siempre y es el único que se calcula si nadie
 * elige otro.
 */
/**
 * Las cachés van por SEXO Y ESTATURA, no por sexo. Desde el 2026-09-06 el sujeto se dibuja
 * con la talla del asesorado, así que dos personas del mismo sexo y distinta altura son dos
 * esqueletos distintos y no pueden compartir malla. La clave la arma `claveDelSujeto`.
 */
const sujetoCache = new Map<string, { huesos: Malla; reposo: Record<string, number> }>()

/**
 * EL FANTASMA TIENE SUS PROPIOS HUESOS. Comparte `construirHuesos()` como fábrica pero no
 * la instancia: el alfa es de la malla, y una malla no puede ser opaca para el sujeto y
 * translúcida para el fantasma a la vez. También por juego: el fantasma es el mismo
 * cuerpo en otro tiempo, no otro cuerpo.
 */
const fantasmaCache = new Map<string, Malla>()

export const claveDelSujeto = (
  sexo: Sexo,
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): string => {
  if (estaturaCm === undefined && !proporciones) return sexo
  // Las proporciones entran por sus tres razones que levantan del suelo, redondeadas: dos
  // lecturas que difieran en una milésima son el mismo cuerpo y no merecen otra malla.
  const forma = proporciones
    ? `|${proporciones.femur.toFixed(3)},${proporciones.tibia.toFixed(3)},${proporciones.torso.toFixed(3)}`
    : ''
  return `${sexo}|${estaturaCm ?? '-'}${forma}`
}

/**
 * Los huesos con los que se dibuja a ESTA persona: su sexo y su estatura.
 *
 * Sin estatura devuelve el juego del atlas tal cual —`esqueletoDe`, el camino de siempre—,
 * y eso importa: no medido no es cero ni «lo que suele medir la gente». Con estatura, el
 * juego se escala entero (ver `domain/patrones/estatura.ts`, que también explica lo que un
 * escalado por estatura NO puede hacer: individualizar las proporciones).
 */
export function definicionDelSujeto(
  sexo: Sexo,
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): readonly DefinicionHueso[] {
  if (estaturaCm === undefined && !proporciones) return esqueletoDe(sexo)
  const juego = juegoConProporciones(JUEGOS[sexo], proporciones, estaturaCm)
  return juego === JUEGOS[sexo] ? esqueletoDe(sexo) : esqueletoConJuego(juego)
}

export function precalculado(sexo: Sexo, estaturaCm?: number, proporciones?: ProporcionesDelCuerpo) {
  const clave = claveDelSujeto(sexo, estaturaCm, proporciones)
  let sujeto = sujetoCache.get(clave)
  if (!sujeto) {
    const definicion = definicionDelSujeto(sexo, estaturaCm, proporciones)
    sujeto = {
      huesos: construirHuesos(definicion),
      reposo: longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0], definicion)),
    }
    sujetoCache.set(clave, sujeto)
  }
  return sujeto
}

export function huesosDelFantasma(sexo: Sexo, estaturaCm?: number, proporciones?: ProporcionesDelCuerpo): Malla {
  const clave = claveDelSujeto(sexo, estaturaCm, proporciones)
  let malla = fantasmaCache.get(clave)
  if (!malla) {
    malla = construirHuesos(definicionDelSujeto(sexo, estaturaCm, proporciones))
    fantasmaCache.set(clave, malla)
  }
  return malla
}
