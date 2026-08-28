import { describe, expect, it } from 'vitest'
import { planExportable } from './planExportable'

describe('el plan que cruza a la herramienta', () => {
  it('lleva el eje que manda y desde dónde se ve, sin que nadie lo elija a mano', () => {
    const plan = planExportable('BISAGRA DE CADERA', 'peso muerto rumano con barra')
    expect(plan?.ejeObjetivo).toBe('cadera')
    expect(plan?.grupoObjetivo).toBe('Isquios')
    expect(plan?.vista).toBe('lateral')
    expect(plan?.linea.origen).toBe('carga-externa')
  })

  /**
   * El patrón sin modelo no es un fallo del que haya que recuperarse con un
   * plan por defecto: es la respuesta. Con uno genérico, el encoder mediría una
   * movilidad de hombro con el modelo del press y devolvería un número.
   */
  it('un patrón sin palanca no devuelve plan, y eso es la respuesta', () => {
    expect(planExportable('MOVILIDAD')).toBeUndefined()
    expect(planExportable('PREV/REHAB')).toBeUndefined()
    expect(planExportable('ACONDICIONAMIENTO')).toBeUndefined()
    expect(planExportable('GLÚTEO FINISHER')).toBeUndefined()
  })

  it('el implemento manda sobre el patrón y viaja con el plan', () => {
    const conBarra = planExportable('SENTADILLA', 'sentadilla con barra')
    const enSmith = planExportable('SENTADILLA', 'sentadilla en multipower')

    expect(conBarra?.brazoPorDistanciaHorizontal).toBe(true)
    // Con un raíl de por medio el número sale igual, varía entre repeticiones y
    // ya no habla del atleta. El encoder lo lee y calla los momentos.
    expect(enSmith?.brazoPorDistanciaHorizontal).toBe(false)
    expect(enSmith?.limites.length).toBeGreaterThan(0)
  })

  it('los límites del patrón cruzan la frontera, no solo los del implemento', () => {
    // La muñeca advierte por sí sola, sin implemento que la delate: su brazo
    // externo es tan corto que el ruido de la mejor medida del proyecto sería
    // aquí un 17 %. Es la pantalla la que lo enseña, arriba y antes del número.
    const plan = planExportable('FLEXIÓN DE MUÑECA', 'curl de muñeca con barra')
    expect(plan?.limites.some((t) => t.includes('70 mm'))).toBe(true)
  })

  it('el eje cuyo músculo no tiene grupo lo dice por su nombre', () => {
    const muñeca = planExportable('FLEXIÓN DE MUÑECA')
    expect(muñeca?.ejes[0]?.motores).toEqual([])
    expect(muñeca?.ejes[0]?.motorSinGrupo).toBe('flexores del antebrazo')

    const tobillo = planExportable('DORSIFLEXIÓN')
    expect(tobillo?.ejes[0]?.motorSinGrupo).toBe('tibial anterior')
  })

  /**
   * El contrato de la costura, escrito una vez.
   *
   * Al otro lado hay JavaScript en otro repositorio que lee estas claves
   * (`brazo-por-fotograma.mjs`, `medirBrazos`). Añadir una aquí no rompe nada
   * hasta que alguien allí la use, y quitarla no rompe nada hasta que se corre
   * un vídeo. Este test obliga a que el cambio sea deliberado: si la lista se
   * mueve, hay que ir a mirar el otro lado antes de actualizarla.
   */
  it('cruzan estas claves y no otras', () => {
    const plan = planExportable('BISAGRA DE CADERA', 'peso muerto con barra')
    expect(Object.keys(plan ?? {}).sort()).toEqual(
      [
        'alineacion',
        'brazoPorDistanciaHorizontal',
        'categoria',
        'ejeObjetivo',
        'ejes',
        'fueraDeVista',
        'grupoObjetivo',
        'implemento',
        'limites',
        'linea',
        'marcas',
        'necesitaRepartoDeApoyos',
        'nombre',
        'unilateral',
        'vista',
      ].sort(),
    )
  })
})
