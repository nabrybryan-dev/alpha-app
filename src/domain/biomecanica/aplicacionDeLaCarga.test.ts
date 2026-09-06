import { describe, expect, it } from 'vitest'
import { aplicacionDeLaCarga, porQueSeApoya } from './aplicacionDeLaCarga'
import { IMPLEMENTOS, implementoDe } from './implementos'

/**
 * DÓNDE ENTRA LA CARGA, probado ejercicio a ejercicio.
 *
 * El fallo que esto arregla: la barra se colocaba SIEMPRE en las manos porque `aplicacion`
 * colgaba del implemento y no del ejercicio. Una sentadilla salía con la barra a la altura
 * de las caderas en vez de sobre el trapecio. Lo vio Bryan navegando por el salón el
 * 2026-09-05.
 *
 * La prueba entra por el mismo sitio que la app: el NOMBRE del ejercicio, que es donde esta
 * casa declara la ejecución. Así, si alguien cambia la detección de implementos, esto se
 * pone rojo también.
 */

const donde = (categoria: string, nombre: string) => {
  const implemento = implementoDe(nombre)
  return aplicacionDeLaCarga(categoria, implemento, implemento ? IMPLEMENTOS[implemento] : undefined)
}

describe('la sentadilla', () => {
  it('con barra, la carga va sobre el trapecio y no en las manos', () => {
    expect(donde('SENTADILLA', 'Sentadilla con barra')).toBe('hombros')
    expect(donde('SENTADILLA', 'SENTADILLA TRASERA CON BARRA')).toBe('hombros')
  })

  it('en Smith también se apoya: el raíl no cambia dónde descansa la barra', () => {
    expect(donde('SENTADILLA', 'Sentadilla en Smith')).toBe('hombros')
  })

  it('con mancuernas o con disco SÍ va en las manos', () => {
    // Una goblet se sostiene contra el pecho y una búlgara con mancuernas cuelga de las
    // manos: son ejercicios distintos y la escena tiene que distinguirlos.
    expect(donde('SENTADILLA', 'Sentadilla goblet con disco')).toBe('manos')
    expect(donde('SENTADILLA UNILATERAL', 'Sentadilla búlgara con mancuernas')).toBe('manos')
  })

  it('la búlgara con barra se apoya, como la bilateral', () => {
    expect(donde('SENTADILLA UNILATERAL', 'Búlgara con barra')).toBe('hombros')
  })

  it('la prensa empuja con los pies, y eso ya lo decía su perfil', () => {
    expect(donde('SENTADILLA', 'Prensa de piernas a 45°')).toBe('pies')
  })
})

describe('el empuje de cadera', () => {
  it('con barra, la carga descansa en la pelvis', () => {
    expect(donde('EXTENSIÓN DE CADERA', 'Hip thrust con barra')).toBe('pelvis')
  })

  it('con mancuerna también: lo que decide es el ejercicio, no el implemento', () => {
    expect(donde('EXTENSIÓN DE CADERA', 'Empuje de cadera con mancuerna')).toBe('pelvis')
  })

  it('la patada de glúteo en polea sigue tirando del tobillo', () => {
    expect(donde('EXTENSIÓN DE CADERA', 'Patada de glúteo en polea con tobillera')).toBe('tobillo')
  })
})

describe('lo que no cambia', () => {
  it('el press y el peso muerto siguen llevando la barra en las manos', () => {
    expect(donde('EMPUJE HORIZONTAL', 'Press de banca con barra')).toBe('manos')
    expect(donde('BISAGRA DE CADERA', 'Peso muerto rumano con barra')).toBe('manos')
    expect(donde('TRACCIÓN HORIZONTAL', 'Remo con barra torso inclinado')).toBe('manos')
  })

  it('el peso corporal entra por el cuerpo entero', () => {
    expect(donde('TRACCIÓN VERTICAL', 'Dominada a peso corporal')).toBe('cuerpo')
  })

  it('sin implemento declarado devuelve el defecto y no inventa un apoyo', () => {
    expect(donde('SENTADILLA', 'Curl femoral sentado')).toBe('manos')
    expect(porQueSeApoya('SENTADILLA', undefined)).toBeUndefined()
  })

  it('una categoría desconocida no rompe: cae en el defecto del implemento', () => {
    expect(donde('LO QUE SEA', 'Press con barra')).toBe('manos')
  })
})

describe('el motivo', () => {
  it('cada excepción explica por qué, y solo las excepciones lo tienen', () => {
    expect(porQueSeApoya('SENTADILLA', 'barra')).toMatch(/trapecio/)
    expect(porQueSeApoya('EXTENSIÓN DE CADERA', 'barra')).toMatch(/pliegue de la cadera/)
    expect(porQueSeApoya('EMPUJE HORIZONTAL', 'barra')).toBeUndefined()
  })
})
