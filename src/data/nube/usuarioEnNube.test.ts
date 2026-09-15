import { describe, expect, it } from 'vitest'
import { esquemaDeLasMigraciones, sqlDeLasMigraciones } from '../../test/leerMigraciones'
import { SELECCION_USUARIOS, TABLA_USUARIOS, usuarioDeFila } from './usuarioEnNube'

/**
 * EL SLUG LLEGA A LA APP, Y SU AUSENCIA NO TUMBA LA DESCARGA.
 *
 * `usuarios_app.slug` lo crea la migración 0081, y el orden de despliegue es primero la
 * app y después la migración. En `hidratarDesdeNube` un error en CUALQUIER tabla tumba la
 * descarga entera, y un `.select('...,slug')` contra una base sin la columna es un error:
 * nadie podría abrir la app entre el despliegue y la migración. Por eso la selección no
 * nombra columnas.
 */

describe('la fila de usuarios_app', () => {
  const FILA = { id: 'u-valentina', nombre: 'Valentina Cruz', rol: 'asesorado' as const, avatar_iniciales: 'VC' }

  it('con la 0081 aplicada, el slug llega al usuario', () => {
    expect(usuarioDeFila({ ...FILA, slug: 'valentina-cruz' }).slug).toBe('valentina-cruz')
  })

  it('sin la columna —la app desplegada antes que la migración— no hay slug y no falla', () => {
    const usuario = usuarioDeFila(FILA)
    expect(usuario).toEqual({ id: 'u-valentina', nombre: 'Valentina Cruz', rol: 'asesorado', avatarIniciales: 'VC' })
    expect('slug' in usuario).toBe(false)
  })

  it('un slug nulo en la base no se convierte en texto', () => {
    expect('slug' in usuarioDeFila({ ...FILA, slug: null })).toBe(false)
  })

  it('sin iniciales guardadas, salen del nombre', () => {
    expect(usuarioDeFila({ ...FILA, avatar_iniciales: '' }).avatarIniciales).toBe('VA')
  })

  it('la selección no nombra columnas: una que aún no exista no puede tumbar la descarga', () => {
    expect(SELECCION_USUARIOS).toBe('*')
  })

  it('la columna que se lee la crea una migración', () => {
    const columnas = esquemaDeLasMigraciones(sqlDeLasMigraciones()).get(TABLA_USUARIOS)
    expect(columnas?.size ?? 0).toBeGreaterThan(1)
    expect(columnas?.has('slug'), 'usuarios_app.slug no la crea ninguna migración').toBe(true)
  })
})
