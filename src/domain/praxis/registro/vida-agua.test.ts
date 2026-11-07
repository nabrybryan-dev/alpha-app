/**
 * El agua dictada a Praxis, medida contra lo que una persona espera (Claude, 7-nov-2026).
 *
 * POR QUÉ EXISTE. Desde el 7-nov el agua que Praxis entiende se anota sola (PRAXIS_AGUA_POR_RPC encendido). Una
 * batería de 27 formas habituales de decirlo dio 7 errores en `resolverVida`:
 *  - «1,5 litros» (coma decimal, la de Colombia) se partía en «1» y «5 litros» = 5.000 mL y se descartaba entera;
 *  - «3 vasos, 1 litro» daba 3.000: `normalizarTexto` borra la coma de lista y quedaba un solo trozo;
 *  - «vaso y medio» y «un vasito» no anotaban NADA y tampoco preguntaban: el agua se perdía en silencio;
 *  - «dos litros y medio» daba 2.000 y «2 botellas de 1.5 litros», 2.000;
 *  - «250 cc» no se entendía.
 * ARREGLADO el 7-nov (segmentosDeAgua en vida.ts); estas pruebas quedan como regresión.
 * Regla que se mantiene: una botella sin tamaño se pregunta, no se inventa. Regla nueva: si se nombró agua y no se
 * entiende cuánta, se pregunta en vez de callar, salvo que haya dicho cero o nada.
 */
import { describe, expect, it } from 'vitest'
import { resolverVida } from './vida.ts'
import type { ContextoRegistro, VidaExtraida } from './tipos.ts'

const ctx = (extra: Partial<ContextoRegistro> = {}): ContextoRegistro => ({
  ahora: '2026-11-07T12:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null }, ...extra,
})
const vida = (cantidad: string, medida: string | null): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: { cantidad, medida }, escalas: [], senales: [],
})
const mlDe = (cantidad: string, medida: string | null = null): number | 'pregunta' | 'nada' | 'descartado' => {
  const r = resolverVida(vida(cantidad, medida), ctx())
  if (r.seguimiento) return 'pregunta'
  const reg = r.registros.find((x) => x.campo === 'hidratacion') as { delta_ml?: number } | undefined
  if (reg?.delta_ml !== undefined) return reg.delta_ml
  return r.descartado.length ? 'descartado' : 'nada'
}

describe('agua: lo que ya funcionaba sigue igual', () => {
  it.each([
    ['2', 'vasos', 400], ['dos', 'vasos', 400], ['un', 'vaso', 200], ['medio', 'vaso', 100],
    ['litro y medio', null, 1500], ['medio litro', null, 500], ['1.5', 'litros', 1500], ['un litro', null, 1000],
    ['como 2 litros', null, 2000], ['tres vasos y una botella de 600', null, 1200], ['2', 'botellas de 500', 1000],
    ['500', 'ml', 500], ['800 mililitros', null, 800], ['1.000', 'ml', 1000], ['una botella de 1 litro', null, 1000],
    ['una taza', null, 200], ['4', 'vasos grandes', 800], ['doce', 'vasos', 2400],
  ] as const)('%s %s = %d mL', (c, m, esperado) => {
    expect(mlDe(c, m)).toBe(esperado)
  })
  it('una botella o un termo sin tamaño se preguntan', () => {
    expect(mlDe('una botella')).toBe('pregunta')
    expect(mlDe('un termo')).toBe('pregunta')
  })
})

describe('agua: los 7 errores de la medición del 7-nov (arreglados)', () => {
  it('«1,5 litros» con coma decimal son 1.500 mL, no 5.000 descartados', () => {
    expect(mlDe('1,5', 'litros')).toBe(1500)
    expect(mlDe('2,5 litros')).toBe(2500)
  })
  it('la coma de lista separa cosas: «3 vasos, 1 litro» = 1.600', () => {
    expect(mlDe('3 vasos, 1 litro')).toBe(1600)
  })
  it('«y medio» suma la mitad de la unidad', () => {
    expect(mlDe('vaso y medio')).toBe(300)
    expect(mlDe('dos litros y medio')).toBe(2500)
    expect(mlDe('dos vasos y medio')).toBe(500)
  })
  it('botellas de litro y medio: 2 × 1,5 L = 3.000', () => {
    expect(mlDe('2 botellas de 1.5 litros')).toBe(3000)
  })
  it('«vasito» es un vaso y «cc» son mL', () => {
    expect(mlDe('un vasito')).toBe(200)
    expect(mlDe('250 cc')).toBe(250)
  })
  it('si nombró agua y no se entiende cuánta, pregunta en vez de callar', () => {
    const r = resolverVida(vida('harta', null), ctx())
    expect(r.registros.some((x) => x.campo === 'hidratacion')).toBe(false)
    expect(r.seguimiento?.campo_bloqueante).toBe('agua_cantidad')
  })
  it('si dijo cero o nada, no se anota ni se le pregunta cuánta (sonaría a no haberla oído)', () => {
    for (const [c, m] of [['0', 'vasos'], ['cero', 'vasos'], ['nada', null], ['ninguno', null], ['no tome', null]] as const) {
      const r = resolverVida(vida(c, m), ctx())
      expect(r.seguimiento, `${c} ${m ?? ''}`).toBeUndefined()
      expect(r.registros.some((x) => x.campo === 'hidratacion'), `${c} ${m ?? ''}`).toBe(false)
    }
  })
})
