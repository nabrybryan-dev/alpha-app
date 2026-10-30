import { describe, expect, it } from 'vitest'
import { TODAS_LAS_RECETAS } from '../../data/recetas'
import { seedDb } from '../../data/seed'
import { sinCifrasDeKcal } from './textoSinKcal'

/**
 * LA PRUEBA QUE MIRABA SOLO LA PALABRA NO VEÍA LA CIFRA.
 *
 * El filtro anterior pasaba las pruebas con textos inventados, pero sobre los
 * textos reales de la app seguía dejando «380» en la nota del canje de los
 * rollitos: la frase siguiente a la de las kcal continuaba hablando de energía
 * sin repetir la unidad. Esta prueba recorre TODOS los textos fijos con kcal
 * —las notas de las seis recetas, el análisis del plan del seed, las notas de
 * sus comidas y sus secciones especiales— y comprueba dos cosas a la vez:
 *
 *   1. no queda ninguna cifra de energía en la salida;
 *   2. un texto que no habla de energía sale exactamente igual que entró.
 *
 * Lo segundo es la mitad que impide arreglar lo primero borrando de más.
 */
const PALABRA_ENERGIA = /\b(kcal|kilocalor[ií]as?|calor[ií]as?|cal|TDEE|energ[ií]a|energ[ée]tic[oa]s?|d[ée]ficit|super[áa]vit)\b/i

/** Unidad que convierte un número en una cantidad que NO son kcal. */
const UNIDAD_SEGURA =
  /^(?:\s*(?:g|gr|gramos?|kg|kilos?|mg|ml|l|litros?|min|mins|minutos?|h|horas?|series?|reps?|repeticiones?|pasos?|porciones?|porci[oó]n|cucharadas?|cucharaditas?|vasos?|tazas?|unidades?|semanas?|d[ií]as?|meses?|años?|%|mm|cm|m|km)\b|\s*k\s*(?:pasos|m|km)\b)/i

/** ¿El número va seguido de una unidad que lo convierte en otra cantidad? */
function seguidaDeUnidad(resto: string): boolean {
  if (UNIDAD_SEGURA.test(resto)) return true
  // «8-12 reps», «9-10k pasos», «0.5-1 kg»: la unidad va tras el segundo número.
  const rango = /^\s*[-–]\s*\d[\d.,]*\s*(.*)$/.exec(resto)
  return rango ? UNIDAD_SEGURA.test(rango[1] ?? '') : false
}

/** Las cifras que el filtro tiene que hacer desaparecer de un texto real. */
function cifrasDeKcal(texto: string): string[] {
  const cifras: string[] = []
  for (const encontrada of texto.matchAll(/\d[\d.,]*/g)) {
    const numero = encontrada[0]
    const pos = encontrada.index ?? 0
    const resto = texto.slice(pos + numero.length)
    const pegado = /^\s*(?:kcal|kilocalor[ií]as?|calor[ií]as?|\bcal\b)/i.test(resto)
    if (pegado) {
      cifras.push(numero)
      continue
    }
    if (!PALABRA_ENERGIA.test(texto)) continue
    if (seguidaDeUnidad(resto)) continue
    if (texto[pos - 1] === '/' || resto.startsWith('/')) continue
    if (/\p{L}/u.test(texto[pos - 1] ?? '')) continue
    // Un «3» de «3 bajas» no es una cifra de energía; una ración sí empieza
    // alrededor de 50. El umbral evita que la prueba confunda porciones con kcal.
    if (Number(numero.replace(/\./g, '')) < 50) continue
    cifras.push(numero)
  }
  return cifras
}

interface TextoReal {
  donde: string
  texto: string
}

const TEXTOS: TextoReal[] = [
  ...TODAS_LAS_RECETAS.flatMap((receta) =>
    receta.ajuste.notas.map((nota) => ({
      donde: `receta ${receta.id} · ${nota.label}`,
      texto: nota.texto,
    })),
  ),
  ...seedDb.planes.flatMap((plan) => [
    { donde: `plan ${plan.id} · análisis`, texto: plan.analisis },
    ...plan.menus.flatMap((menu) =>
      menu.comidas
        .filter((comida) => Boolean(comida.nota))
        .map((comida) => ({ donde: `plan ${plan.id} · ${comida.titulo}`, texto: comida.nota! })),
    ),
    ...plan.seccionesEspeciales.map((especial) => ({
      donde: `plan ${plan.id} · ${especial.titulo}`,
      texto: especial.contenido,
    })),
  ]),
]

describe('sinCifrasDeKcal sobre los textos reales de la app', () => {
  it('hay textos con kcal que probar: si no, la prueba no prueba nada', () => {
    expect(TEXTOS.filter(({ texto }) => cifrasDeKcal(texto).length > 0).length).toBeGreaterThan(0)
  })

  it.each(TEXTOS)('$donde: no deja ni una cifra de energía', ({ texto }) => {
    const salida = sinCifrasDeKcal(texto)
    expect(salida).not.toMatch(/(kcal|kilocalor[ií]as?|calor[ií]as?|\bcal\b)/i)
    for (const cifra of cifrasDeKcal(texto)) {
      expect(salida, `se coló ${cifra}`).not.toContain(cifra)
    }
  })

  it.each(TEXTOS.filter(({ texto }) => !PALABRA_ENERGIA.test(texto)))(
    '$donde: lo que no habla de energía queda igual',
    ({ texto }) => {
      expect(sinCifrasDeKcal(texto)).toBe(texto)
    },
  )
})
