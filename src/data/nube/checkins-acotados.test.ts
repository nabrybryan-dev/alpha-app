import { describe, expect, it } from 'vitest'
import { fusionarCheckins, type FilaCheckinNutricion } from './hidratar'
import type { CheckinDiario } from '../../domain/types'

// La nutricionista se bajaba el check-in ENTERO de todos: ánimo, estrés, horas y
// calidad de sueño y comentarios de texto libre. La migración 0013 se escribió en
// julio de 2026 para impedirlo y dejó la vista `checkins_nutricion` con lo
// nutricional y nada más — pero nadie la consultó nunca, así que la app siguió
// pidiendo la tabla y la RLS siguió dejándosela.
//
// `fusionarCheckins` es el punto donde eso se decide. Lo que se prueba aquí es la
// propiedad, no el camino feliz: quien puede ver la fila entera la ve entera, y
// quien no, ve solo las cuatro columnas nutricionales.

const entero = (id: string, usuarioId: string): CheckinDiario => ({
  id,
  usuarioId,
  fecha: '2026-08-15',
  pesoKg: 61.2,
  hambreEscala: 8,
  alimentacion: 'BUENA',
  estres: 'MUCHO',
  horasSueno: 5,
  comentarios: 'texto libre que no es asunto de nutrición',
})

const recortado = (id: string, usuarioId: string): FilaCheckinNutricion => ({
  id,
  usuario_id: usuarioId,
  fecha: '2026-08-15',
  peso_kg: '61.2',
  hambre: null,
  hambre_escala: '8',
  alimentacion: 'BUENA',
})

describe('fusionarCheckins', () => {
  it('deja pasar lo nutricional del recorte y nada más', () => {
    const [c] = fusionarCheckins([], [recortado('ck-1', 'u-otra')])

    expect(c.pesoKg).toBe(61.2)
    expect(c.hambreEscala).toBe(8)
    expect(c.alimentacion).toBe('BUENA')

    // Lo que la vista no trae no llega, y no llega como `undefined` explícito:
    // no está la clave. Un `estres: undefined` en el objeto ya sería una promesa
    // de que el dato existe y salió vacío.
    expect('estres' in c).toBe(false)
    expect('horasSueno' in c).toBe(false)
    expect('comentarios' in c).toBe(false)
    expect('cansancio' in c).toBe(false)
  })

  it('la fila entera gana, venga en el orden que venga', () => {
    // El bug fácil: aplicar el recorte DESPUÉS. Dejaría a todo el mundo -coach y
    // asesorado incluidos- sin ánimo, sueño ni comentarios, porque la vista les
    // devuelve las mismas filas que la tabla.
    const [c] = fusionarCheckins([entero('ck-1', 'u-1')], [recortado('ck-1', 'u-1')])

    expect(c.comentarios).toBe('texto libre que no es asunto de nutrición')
    expect(c.estres).toBe('MUCHO')
    expect(c.horasSueno).toBe(5)
  })

  it('para el coach es un no-op: mismas filas por los dos lados', () => {
    const enteros = [entero('ck-1', 'u-1'), entero('ck-2', 'u-2')]
    const vista = [recortado('ck-1', 'u-1'), recortado('ck-2', 'u-2')]

    expect(fusionarCheckins(enteros, vista)).toEqual(enteros)
  })

  it('mezcla los propios enteros con los ajenos recortados', () => {
    // El caso de la nutricionista una vez cerrada la RLS: de la tabla bajan solo
    // los suyos, de la vista bajan los de todos.
    const fusionados = fusionarCheckins(
      [entero('ck-mio', 'u-manuela')],
      [recortado('ck-mio', 'u-manuela'), recortado('ck-ajeno', 'u-otra')],
    )

    expect(fusionados).toHaveLength(2)

    const mio = fusionados.find((c) => c.id === 'ck-mio')
    const ajeno = fusionados.find((c) => c.id === 'ck-ajeno')

    expect(mio?.comentarios).toBe('texto libre que no es asunto de nutrición')
    expect('comentarios' in (ajeno as object)).toBe(false)
    expect(ajeno?.hambreEscala).toBe(8)
  })

  it('un nulo de la vista no se vuelve cero', () => {
    // «No me lo dieron» no es «lo respondió y salió cero». La columna `hambre`
    // vieja está en null para los 24 check-ins recientes, que usan `hambreEscala`.
    const [c] = fusionarCheckins(
      [],
      [{ ...recortado('ck-1', 'u-1'), peso_kg: null, hambre: null, hambre_escala: null }],
    )

    expect('pesoKg' in c).toBe(false)
    expect('hambre' in c).toBe(false)
    expect('hambreEscala' in c).toBe(false)
    expect(c.alimentacion).toBe('BUENA')
  })

  it('conserva las dos escalas de hambre, que conviven', () => {
    // 23 check-ins guardan `hambre` (POCO/REGULAR/MUCHO) y 24 `hambreEscala`
    // (1-10). Los viejos se leen como se respondieron: «MUCHO» no es un 8.
    const [viejo] = fusionarCheckins(
      [],
      [{ ...recortado('ck-viejo', 'u-1'), hambre: 'MUCHO', hambre_escala: null }],
    )

    expect(viejo.hambre).toBe('MUCHO')
    expect('hambreEscala' in viejo).toBe(false)
  })
})
