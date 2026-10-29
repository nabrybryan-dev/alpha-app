import { describe, expect, it } from 'vitest'
import {
  VENTANA_HAMBRE_DIAS,
  decidirAlertasNutri,
  textoDelAviso,
  type EntradaAlertas,
  type FilaHambre,
} from '../../supabase/functions/avisos-plan/alertasNutri.ts'
import { TRAMOS } from './senales/hambre'

const HOY = '2026-10-28'
const U = 'u-1'

function diaAtras(n: number): string {
  const d = new Date(`${HOY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Hambre `valor` en `dias` días seguidos que terminan `terminaHace` días antes de hoy. */
function racha(valor: number, dias: number, usuario = U, terminaHace = 0): FilaHambre[] {
  return Array.from({ length: dias }, (_, i) => ({
    usuario_id: usuario,
    fecha: diaAtras(terminaHace + i),
    hambre_escala: valor,
  }))
}

const base = (o: Partial<EntradaAlertas> = {}): EntradaAlertas => ({
  hoy: HOY,
  encendidas: ['hambre_sostenida', 'objetivo_insuficiente'],
  hambre: [],
  planes: [],
  abiertas: [],
  ...o,
})

type MacrosPlan = Record<string, { kcal: number; proteinaG: number; carbosG: number; grasaG: number }>
const plan = (macros: MacrosPlan | null, actualizado_en = '2026-10-01T00:00:00Z') => ({
  usuario_id: U,
  actualizado_en,
  macros,
})

describe('interruptor: todo apagado por defecto', () => {
  it('sin ninguna alerta encendida no crea nada, aunque los datos la dispararían', () => {
    const d = decidirAlertasNutri(
      base({
        encendidas: [],
        hambre: racha(10, 5),
        planes: [plan({ ALTO: { kcal: 1000, proteinaG: 200, carbosG: 0, grasaG: 60 } })],
      }),
    )
    expect(d.crear).toEqual([])
  })

  it('al apagar una alerta se retiran las abiertas de esa alerta y solo de esa', () => {
    const d = decidirAlertasNutri(
      base({
        encendidas: ['hambre_sostenida'],
        abiertas: [
          { id: 'a1', asesorado_id: U, clave: 'objetivo_insuficiente' },
          { id: 'a2', asesorado_id: U, clave: 'hambre_sostenida' },
        ],
        hambre: racha(10, 3),
      }),
    )
    expect(d.resolver).toEqual(['a1'])
  })
})

describe('hambre sostenida: los umbrales son los de hambre.ts', () => {
  it('la ventana cubre el tramo más largo con su tolerancia', () => {
    const max = Math.max(...TRAMOS.map((t) => t.diasExigidos))
    expect(VENTANA_HAMBRE_DIAS).toBeGreaterThanOrEqual(max + 2)
  })

  it.each(TRAMOS.map((t) => [t.bajo, t.diasExigidos, t.etiqueta] as const))(
    'hambre %i: avisa con %i días y no con uno menos (%s)',
    (valor, dias, etiqueta) => {
      const justo = decidirAlertasNutri(base({ hambre: racha(valor, dias) }))
      expect(justo.crear).toHaveLength(1)
      expect(justo.crear[0]).toMatchObject({ asesorado_id: U, clave: 'hambre_sostenida' })
      expect(justo.crear[0].detalle).toContain(etiqueta)
      const corto = decidirAlertasNutri(base({ hambre: racha(valor, dias - 1) }))
      expect(corto.crear).toEqual([])
    },
  )

  it('un día sin registrar no rompe la racha, dos seguidos sí', () => {
    // hoy, ayer, (hueco de un día), hace 3, 4 y 5: cinco días de hambre 8 con un hueco
    const conUnHueco = [...racha(8, 2), ...racha(8, 3, U, 3)]
    expect(decidirAlertasNutri(base({ hambre: conUnHueco })).crear).toHaveLength(1)
    const conDos = [...racha(8, 2), ...racha(8, 3, U, 4)]
    expect(decidirAlertasNutri(base({ hambre: conDos })).crear).toEqual([])
  })

  it('una racha que ya terminó no está vigente: se retira la alerta abierta', () => {
    // cinco días de hambre 8 que acabaron hace 3 días; hoy y ayer sin registro
    const d = decidirAlertasNutri(
      base({ hambre: racha(8, 5, U, 3), abiertas: [{ id: 'a1', asesorado_id: U, clave: 'hambre_sostenida' }] }),
    )
    expect(d.crear).toEqual([])
    expect(d.resolver).toEqual(['a1'])
  })

  it('no duplica la alerta que ya está abierta ni la retira mientras sigue vigente', () => {
    const d = decidirAlertasNutri(
      base({ hambre: racha(10, 4), abiertas: [{ id: 'a1', asesorado_id: U, clave: 'hambre_sostenida' }] }),
    )
    expect(d.crear).toEqual([])
    expect(d.resolver).toEqual([])
  })

  it('cada persona se evalúa aparte', () => {
    const d = decidirAlertasNutri(base({ hambre: [...racha(10, 2, 'u-a'), ...racha(10, 1, 'u-b')] }))
    expect(d.crear.map((c) => c.asesorado_id)).toEqual(['u-a'])
  })

  it('un valor que no es entero del 1 al 10 cuenta como día sin registrar y no revienta', () => {
    const raros: FilaHambre[] = [
      { usuario_id: U, fecha: HOY, hambre_escala: 7.5 },
      { usuario_id: U, fecha: diaAtras(1), hambre_escala: 'mucha' },
      { usuario_id: U, fecha: diaAtras(2), hambre_escala: 0 },
      { usuario_id: U, fecha: diaAtras(3), hambre_escala: 11 },
      { usuario_id: U, fecha: diaAtras(4), hambre_escala: null },
    ]
    expect(() => decidirAlertasNutri(base({ hambre: raros }))).not.toThrow()
    expect(decidirAlertasNutri(base({ hambre: raros })).crear).toEqual([])
  })

  it('acepta la escala como texto numérico (viene de un campo JSON)', () => {
    const comoTexto = racha(10, 2).map((f) => ({ ...f, hambre_escala: String(f.hambre_escala) }))
    expect(decidirAlertasNutri(base({ hambre: comoTexto })).crear).toHaveLength(1)
  })

  it('ignora filas fuera de la ventana', () => {
    const viejas = racha(10, 5, U, VENTANA_HAMBRE_DIAS + 3)
    expect(decidirAlertasNutri(base({ hambre: viejas })).crear).toEqual([])
  })
})

describe('objetivo insuficiente: proteína x 4 + grasa x 9 > kcal', () => {
  it('avisa cuando solo proteína y grasa ya pasan del objetivo, y dice en qué días', () => {
    const d = decidirAlertasNutri(
      base({
        planes: [
          plan({
            ALTO: { kcal: 2000, proteinaG: 150, carbosG: 200, grasaG: 60 },
            BAJO: { kcal: 1000, proteinaG: 200, carbosG: 0, grasaG: 60 },
          }),
        ],
      }),
    )
    expect(d.crear).toHaveLength(1)
    expect(d.crear[0]).toMatchObject({ asesorado_id: U, clave: 'objetivo_insuficiente' })
    expect(d.crear[0].detalle).toContain('BAJO')
    expect(d.crear[0].detalle).not.toContain('ALTO')
  })

  it('igual al objetivo no avisa (el umbral es estrictamente mayor)', () => {
    // 100 x 4 + 50 x 9 = 850
    const d = decidirAlertasNutri(base({ planes: [plan({ ALTO: { kcal: 850, proteinaG: 100, carbosG: 0, grasaG: 50 } })] }))
    expect(d.crear).toEqual([])
    const uno = decidirAlertasNutri(base({ planes: [plan({ ALTO: { kcal: 849, proteinaG: 100, carbosG: 0, grasaG: 50 } })] }))
    expect(uno.crear).toHaveLength(1)
  })

  it('solo mira el plan más reciente de cada persona', () => {
    const malo = plan({ ALTO: { kcal: 1000, proteinaG: 200, carbosG: 0, grasaG: 60 } }, '2026-09-01T00:00:00Z')
    const bueno = plan({ ALTO: { kcal: 2200, proteinaG: 150, carbosG: 250, grasaG: 60 } }, '2026-10-01T00:00:00Z')
    expect(decidirAlertasNutri(base({ planes: [malo, bueno] })).crear).toEqual([])
    expect(decidirAlertasNutri(base({ planes: [bueno, malo] })).crear).toEqual([])
  })

  it('un plan con números rotos no avisa ni revienta', () => {
    const roto = plan({ ALTO: { kcal: Number.NaN, proteinaG: 200, carbosG: 0, grasaG: 60 } })
    expect(() => decidirAlertasNutri(base({ planes: [roto, plan(null)] }))).not.toThrow()
    expect(decidirAlertasNutri(base({ planes: [roto] })).crear).toEqual([])
    expect(decidirAlertasNutri(base({ planes: [plan(null)] })).crear).toEqual([])
  })

  it('cuando el plan se corrige, la alerta abierta se retira', () => {
    const bueno = plan({ ALTO: { kcal: 2200, proteinaG: 150, carbosG: 250, grasaG: 60 } })
    const d = decidirAlertasNutri(
      base({ planes: [bueno], abiertas: [{ id: 'a9', asesorado_id: U, clave: 'objetivo_insuficiente' }] }),
    )
    expect(d.resolver).toEqual(['a9'])
  })
})

describe('el aviso del teléfono es neutro', () => {
  it('no lleva datos de salud, nombres ni cifras y lleva a la pantalla del equipo', () => {
    const a = textoDelAviso()
    expect(a.titulo).toBe('Tienes una alerta nueva de un asesorado')
    expect(a.url).toBe('/equipo-nutricion')
    const todo = `${a.titulo} ${a.cuerpo}`.toLowerCase()
    for (const prohibida of ['hambre', 'kcal', 'caloría', 'proteína', 'peso', 'dolor']) {
      expect(todo).not.toContain(prohibida)
    }
    expect(todo).not.toMatch(/\d/)
  })
})
