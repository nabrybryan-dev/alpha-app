import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EL SALÓN Y LA SESIÓN SIGUEN EL TEMA DE LA PERSONA (zona 8, decisión de Bryan 28-oct).
 *
 * Hasta hoy cuatro sitios clavaban `data-theme="dark"` y la persona que eligió el tema
 * claro entraba a un salón negro. Una prueba por pantalla: si alguien vuelve a forzar el
 * tema en el JSX, se pone roja aquí. Se lee la fuente y no el DOM porque el atributo
 * forzado solo se nota montando el salón entero con WebGL, que jsdom no tiene.
 */
const PANTALLAS = [
  ['el salón (SalonEntrenar)', 'salon/SalonEntrenar.tsx'],
  ['la sesión (SesionPage)', 'SesionPage.tsx'],
  ['el resumen (SesionCerrada)', 'SesionCerrada.tsx'],
  ['el pintado del sujeto (pintura)', 'sujeto/pintura.ts'],
] as const

describe.each(PANTALLAS)('%s', (_nombre, ruta) => {
  const fuente = readFileSync(join(__dirname, ruta), 'utf8')
  // Se quitan los comentarios: explicar por qué ya no se fuerza no es forzarlo.
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('no fuerza el tema: sigue el de la persona', () => {
    expect(sinComentarios).not.toMatch(/data-theme\s*=\s*["'{]/)
    expect(sinComentarios).not.toMatch(/setAttribute\(\s*['"]data-theme/)
  })
})
