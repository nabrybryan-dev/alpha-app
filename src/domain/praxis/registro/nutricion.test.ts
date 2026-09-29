import { describe, expect, it } from 'vitest'
import { resolverComida } from './comida.ts'
import { gramosDeMedida, medidaCanonica, MEDIDAS_CASERAS, porcionHabitual } from './medidas.ts'
import { calidadDeSueno, resolverVida } from './vida.ts'
import type { ComidaExtraida, ContextoRegistro, ItemComidaExtraido, VidaExtraida } from './tipos.ts'

const ctx = (ahora = '2026-09-30T14:00:00-05:00', extra: Partial<ContextoRegistro> = {}): ContextoRegistro => ({
  ahora, microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null }, ultimoTocado: null,
  semanaAnterior: {}, perfil: { pesoBarraKg: null }, ...extra,
})
const item = (alimento: string, cantidad: string | null, medida: string | null, senales: ItemComidaExtraido['senales'] = []): ItemComidaExtraido =>
  ({ alimento, cantidad, medida, estado: null, senales })
const comida = (items: ItemComidaExtraido[], extra: Partial<ComidaExtraida> = {}): ComidaExtraida => ({
  comida_cita: null, cuando: null, segun_plan: 'no_dicho', items, plato: null, cocinado_por_ella: 'no_dicho', aceite: null, sal: null, ...extra,
})
const vida = (o: Partial<VidaExtraida>): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [], ...o,
})

describe('medidas caseras', () => {
  it('toda fila declara su fuente', () => {
    for (const f of MEDIDAS_CASERAS) expect(f.fuente.length, f.etiqueta).toBeGreaterThan(3)
  })
  it('una taza y media de arroz son 237 g, no verificados, confianza baja (N01)', () => {
    const r = gramosDeMedida('arroz', medidaCanonica('taza'), 1.5)
    expect(r).toMatchObject({ tipo: 'gramos', gramos: 237, confianza: 'baja' })
  })
  it('8 cucharadas de arroz son 106,7 g con fuente GABAS (N04)', () => {
    const r = gramosDeMedida('arroz', 'cucharada', 8)
    expect(r).toMatchObject({ tipo: 'gramos', gramos: 106.7, confianza: 'media' })
    expect(r.tipo === 'gramos' && r.fila.fuente).toMatch(/GABAS T26/)
  })
  it('«papa criolla» gana sobre «papa» (N18) y dos papas medianas son 166 g (N17)', () => {
    expect(gramosDeMedida('papa criolla', 'unidad', 6)).toMatchObject({ gramos: 216 })
    expect(gramosDeMedida('papas', 'unidad', 2)).toMatchObject({ gramos: 166 })
  })
  it('dos huevos son 100 g, tres huevos 150 g', () => {
    expect(gramosDeMedida('huevos', 'unidad', 2)).toMatchObject({ gramos: 100 })
    expect(gramosDeMedida('huevo', 'unidad', 3)).toMatchObject({ gramos: 150 })
  })
  it('«arepa» sola es ambigua y pregunta; la delgada son 56 g (N09, N10)', () => {
    const a = gramosDeMedida('arepa', 'unidad', 1)
    expect(a.tipo).toBe('ambigua')
    expect(gramosDeMedida('arepita delgada', 'unidad', 1)).toMatchObject({ tipo: 'gramos', gramos: 56 })
  })
  it('«pan» solo pregunta (N11); dos tajadas de pan blanco son 44 g (N12)', () => {
    expect(gramosDeMedida('pan', 'unidad', 1).tipo).toBe('ambigua')
    expect(gramosDeMedida('pan blanco', 'tajada', 2)).toMatchObject({ gramos: 44 })
  })
  it('plato, pedazo y presa NO tienen equivalencia', () => {
    for (const m of ['plato', 'pedazo', 'presa'] as const) expect(gramosDeMedida('pollo', m, 1).tipo).toBe('sin_equivalencia')
  })
  it('la porción habitual existe solo para lo validado por el coach', () => {
    expect(porcionHabitual('arroz')?.gramos).toBe(150)
    expect(porcionHabitual('lentejas')).toBeNull()
  })
  it('las medidas se canonizan', () => {
    expect(medidaCanonica('cucharadas')).toBe('cucharada')
    expect(medidaCanonica('cucharadita')).toBe('cucharadita')
    expect(medidaCanonica('pocillo chocolatero')).toBe('pocillo chocolatero')
    expect(medidaCanonica(null)).toBe('unidad')
    expect(medidaCanonica('chorrito')).toBeNull()
  })
})

describe('registro de comida', () => {
  it('una taza y media de arroz: 237 g, estimado, editable (N01)', () => {
    const r = resolverComida(comida([item('arroz', 'una y media', 'taza')], { comida_cita: 'almuerzo' }), ctx()).registro!
    expect(r.comida).toBe('almuerzo')
    expect(r.items[0]).toMatchObject({ gramos: 237, editable: true, confianza: 'baja' })
    expect(r.confianza_registro).toBe('estimado')
  })
  it('pesado en gramos: la cifra es la de la persona (N41, N66)', () => {
    const r = resolverComida(comida([{ ...item('pechuga', '180', 'gramos', ['pesado']), estado: 'cocido' }]), ctx()).registro!
    expect(r.items[0]).toMatchObject({ gramos: 180, confianza: 'alta', fuente_medida: 'pesado' })
    expect(r.confianza_registro).toBe('pesado')
  })
  it('200 g de arroz sin decir crudo o cocido: se asume cocido, se avisa y se pregunta (N42)', () => {
    const r = resolverComida(comida([item('arroz', '200', 'gramos')]), ctx())
    expect(r.registro!.items[0].estado_asumido).toBe('cocido')
    expect(r.seguimiento?.texto).toMatch(/cocido o crudo/)
    expect(r.avisos.join(' ')).toMatch(/cocido/)
  })
  it('un pedazo de pollo no se convierte y pregunta por el tamaño (N03)', () => {
    const r = resolverComida(comida([item('pollo', 'un', 'pedazo')]), ctx())
    expect(r.registro!.items[0].gramos).toBeNull()
    expect(r.seguimiento?.opciones).toEqual(['Palma sin dedos', 'Media palma', 'Dos palmas'])
  })
  it('medio plato de arroz usa la porción habitual, con confianza baja (N02)', () => {
    const r = resolverComida(comida([], { plato: [{ alimento: 'arroz', fraccion: 'medio' }] }), ctx()).registro!
    expect(r.items[0]).toMatchObject({ gramos: 75, confianza: 'baja' })
    expect(r.items[0].fuente_medida).toMatch(/porciones\.py/)
  })
  it('sin cantidad no se inventa: hueco editable y pregunta', () => {
    const r = resolverComida(comida([item('galletas', null, null)]), ctx())
    expect(r.registro!.items[0].gramos).toBeNull()
    expect(r.seguimiento).toBeDefined()
  })
  it('aceite: una cucharada son 14 g; «un chorrito» no se convierte (N68, N69)', () => {
    expect(resolverComida(comida([], { aceite: 'una cucharada de aceite' }), ctx()).registro!.aceite_g).toBe(14)
    const r = resolverComida(comida([], { aceite: 'un chorrito de aceite' }), ctx())
    expect(r.registro!.aceite_g).toBeNull()
    expect(r.seguimiento?.texto).toMatch(/cucharadita o una cucharada/)
  })
  it('sal: una pizca son 0,4 g (N70)', () => {
    expect(resolverComida(comida([], { sal: 'una pizca de sal' }), ctx()).registro!.sal_g).toBe(0.4)
  })
  it('comer donde la mamá es ajeno (N65); la hora decide la comida', () => {
    expect(resolverComida(comida([item('arroz', '2', 'cucharadas')], { cocinado_por_ella: 'no' }), ctx()).registro!.confianza_registro).toBe('ajeno')
    expect(resolverComida(comida([item('huevo', '2', null)]), ctx('2026-09-30T07:10:00-05:00')).registro!.comida).toBe('desayuno')
    expect(resolverComida(comida([item('huevo', '2', null)]), ctx('2026-09-30T20:00:00-05:00')).registro!.comida).toBe('cena')
  })
})

describe('vida diaria', () => {
  it('dormí como 5 horas: 5, confianza media (V01)', () => {
    const r = resolverVida(vida({ sueno_horas: 'como 5 horas' }), ctx())
    expect(r.registros[0]).toMatchObject({ campo: 'checkin', parche: { horasSueno: 5 }, confianza_por_campo: { horasSueno: 'media' } })
  })
  it('las horas de acostarse y levantarse derivan 6,5 h (V02)', () => {
    const r = resolverVida(vida({ hora_acostarse: 'a las once', hora_levantarse: 'a las cinco y media' }), ctx())
    expect(r.registros[0]).toMatchObject({ parche: { horaAcostarse: '23:00', horaLevantarse: '05:30', horasSueno: 6.5 } })
  })
  it('«dormí fatal» no rellena las horas con el 7 del formulario (V03)', () => {
    const r = resolverVida(vida({ calidad_sueno: 'dormí fatal' }), ctx())
    expect(r.registros[0]).toMatchObject({ parche: { calidadSueno: 'MALA' } })
    expect((r.registros[0] as { parche: Record<string, unknown> }).parche.horasSueno).toBeUndefined()
  })
  it('«no dormí mal» no es BUENA (D07)', () => expect(calidadDeSueno('no dormí mal, dormí normal')).toBe('REGULAR'))
  it('30 horas de sueño: pregunta, no trunca (D10)', () => {
    expect(resolverVida(vida({ sueno_horas: 'treinta horas' }), ctx()).pregunta?.texto).toMatch(/no me cuadra/)
  })
  it('doscientos cincuenta mil pasos: pregunta (D11); nueve mil, de noche, van al check-in de mañana (V08)', () => {
    expect(resolverVida(vida({ pasos: 'doscientos cincuenta mil pasos' }), ctx()).pregunta).toBeDefined()
    const r = resolverVida(vida({ pasos: 'nueve mil pasos', senales: ['aproximado'] }), ctx('2026-10-02T22:30:00-05:00'))
    expect(r.registros[0]).toMatchObject({ fecha: '2026-10-03', diferido: true, parche: { pasos: 9000 } })
  })
  it('«caminé bastante» no se convierte en número (V07)', () => {
    const r = resolverVida(vida({ actividad_sin_numero: 'caminé bastante' }), ctx())
    expect(r.registros).toEqual([])
    expect(r.descartado[0].motivo).toMatch(/bastante/)
    expect(r.seguimiento?.texto).toMatch(/pasos/)
  })
  it('12.350 pasos: el punto es de miles (V09)', () => {
    expect(resolverVida(vida({ pasos: '12.350 pasos' }), ctx()).registros[0]).toMatchObject({ parche: { pasos: 12350 } })
  })
  it('agua: vasos × 200 mL, litros, botella con tamaño; botella sin tamaño pregunta (V12, V11)', () => {
    expect(resolverVida(vida({ agua: { cantidad: 'dos', medida: 'vasos' } }), ctx()).registros[0]).toMatchObject({ campo: 'hidratacion', delta_ml: 400 })
    expect(resolverVida(vida({ agua: { cantidad: 'dos', medida: 'litros' } }), ctx()).registros[0]).toMatchObject({ delta_ml: 2000 })
    expect(resolverVida(vida({ agua: { cantidad: 'una', medida: 'botella de 600' } }), ctx()).registros[0]).toMatchObject({ delta_ml: 600 })
    const s = resolverVida(vida({ agua: { cantidad: 'dos', medida: 'botellas de agua' } }), ctx())
    expect(s.registros).toEqual([])
    expect(s.seguimiento?.texto).toMatch(/cuántos ml/)
  })
  it('escalas de tabla cerrada; lo que no está queda descartado', () => {
    const r = resolverVida(vida({ escalas: [
      { campo: 'cansancio', cita: 'muerto de cansancio' },
      { campo: 'estres', cita: 'tranquilo, cero estrés' },
      { campo: 'animo', cita: 'medio de bajón' },
      { campo: 'hambre', cita: 'un 8' },
      { campo: 'estres', cita: 'como está la cosa' },
    ] }), ctx())
    expect(r.registros[0]).toMatchObject({ parche: { cansancio: 'MUCHO', estres: 'POCO', animo: 'POCO', hambreEscala: 8 } })
    expect(r.descartado).toHaveLength(1)
  })
  it('ánimo ≠ ganas de entrenar: «sin ganas de entrenar» va a motivación, nunca a ánimo (V14, D20)', () => {
    const r = resolverVida(vida({ escalas: [{ campo: 'ganas_de_entrenar', cita: 'no tengo ganas de entrenar' }] }), ctx())
    expect(r.registros[0]).toMatchObject({ parche: { motivacion: 'POCO' } })
    const s = resolverVida(vida({ escalas: [{ campo: 'ganas_de_entrenar', cita: 'no tengo ganas' }] }), ctx())
    expect(s.registros).toEqual([])
  })
  it('«el hambre normal» no se convierte en 5 (V22)', () => {
    const r = resolverVida(vida({ escalas: [{ campo: 'hambre', cita: 'normal, ni mucha ni poca' }] }), ctx())
    expect(r.registros).toEqual([])
    expect(r.seguimiento?.texto).toMatch(/escala de 1 a 10/)
  })
  it('muestra lo que ya había en el check-in: «antes 5, ahora 6» (D04)', () => {
    const r = resolverVida(vida({ sueno_horas: '6' }), ctx('2026-10-01T21:00:00-05:00', { checkinHoy: { horasSueno: 5 } }))
    expect(r.registros[0]).toMatchObject({ antes: { horasSueno: 5 }, parche: { horasSueno: 6 } })
  })
})
