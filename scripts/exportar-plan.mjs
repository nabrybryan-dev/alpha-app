/**
 * El plan de medida de un ejercicio, en JSON, para que lo coma el encoder.
 *
 *     node --experimental-strip-types scripts/exportar-plan.mjs "BISAGRA DE CADERA" "peso muerto con barra"
 *
 * Existe por una razón de costura, no de comodidad. La tabla de palancas es el
 * dominio de la app y vive en TypeScript; el encoder de cámara es una
 * herramienta aparte que vive en JavaScript en otro repositorio. Que el segundo
 * importe del primero por una ruta relativa entre repositorios es la clase de
 * atajo que funciona en esta máquina y en ninguna otra.
 *
 * Así que se pasan datos, no código: aquí sale el plan y allí se consume. Es la
 * misma frontera que ya existe entre `camara-sintetica.py`, que renderiza, y
 * `tuberia-sintetica.mjs`, que analiza.
 *
 * Lo que va dentro es exactamente lo que el encoder necesita para decidir si
 * puede medir y qué: el eje que manda, contra qué línea, desde dónde hay que
 * mirar, qué marcas hacen falta, y —lo que más importa— **qué no se puede
 * prometer**.
 */

import { planDeMedida } from '../src/domain/biomecanica/palancas.ts'

const [categoria, nombre = ''] = process.argv.slice(2)
if (!categoria) {
  console.error('Uso: node --experimental-strip-types scripts/exportar-plan.mjs <CATEGORÍA> [nombre del ejercicio]')
  process.exit(2)
}

const plan = planDeMedida(categoria, nombre)
if (!plan) {
  console.error(`Sin modelo de palanca para «${categoria}». No hay plan que exportar, y eso es la respuesta.`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      categoria,
      nombre,
      grupoObjetivo: plan.grupoObjetivo,
      ejeObjetivo: plan.ejeObjetivo,
      // Solo lo que el encoder usa de cada eje: articulación, quién manda y qué
      // músculo genera el momento. El resto de la ficha es para la pantalla.
      ejes: plan.ejes.map((e) => ({
        articulacion: e.articulacion,
        protagonismo: e.protagonismo,
        accion: e.accion,
        motores: e.motores,
        brazoInternoMm: e.brazoInternoMm,
        regla: e.regla ? { tipo: e.regla.tipo, regla: e.regla.regla, toleranciaMm: e.regla.toleranciaMm } : undefined,
      })),
      marcas: plan.marcas,
      linea: plan.linea,
      vista: plan.vista,
      alineacion: plan.alineacion,
      implemento: plan.implemento,
      unilateral: plan.unilateral,
      brazoPorDistanciaHorizontal: plan.brazoPorDistanciaHorizontal,
      necesitaRepartoDeApoyos: plan.necesitaRepartoDeApoyos,
      limites: plan.limites,
      fueraDeVista: plan.fueraDeVista,
    },
    null,
    2,
  ),
)
