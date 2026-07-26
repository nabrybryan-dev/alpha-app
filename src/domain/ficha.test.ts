import { describe, expect, it } from 'vitest'
import { parsearFicha } from './ficha'

// Fixture deliberadamente VÁLIDO: 8 variantes y 81 palabras de cuerpo, dentro
// del rango 70-160. Así `validarFicha(FICHA_MINIMA)` devuelve [] y cada test
// puede afirmar sobre un solo error, sin ruido de fondo.
const FICHA_MINIMA = `---
id: demo-uno
bloque: vocabulario
titulo: ¿Qué es RIR?
variantes:
  - qué es rir
  - que significa rir
  - qué quiere decir rir 2
  - no entiendo lo del rir
  - repeticiones en reserva qué es
  - cómo sé mi rir
  - qué es eso de rir
  - rir 2 qué significa
bandera_salud: false
datos_que_usa: [rir_pautado]
fuentes: [metodo-heracles-anexo]
actualizado: 2026-07-25
---

## respuesta_directa
Son las repeticiones que te quedan en el tanque cuando terminas la serie, sin
llegar al fallo.

## por_que
Sirve para medir cuánto te acercas al fallo sin tener que llegar a él, porque la
cercanía al fallo es lo que determina el estímulo real de la serie.

## tu_caso_hoy
Hoy tienes RIR {{rir_pautado}} en tus series principales.

## que_hago_ahora
Al terminar cada serie, pregúntate cuántas repeticiones más habrías podido hacer
con buena técnica.

## senal_alarma
Si nunca logras estimarlo, avísame y lo calibramos juntos en la próxima sesión.
`

describe('parsearFicha', () => {
  it('extrae el frontmatter tipado', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    expect(ficha.id).toBe('demo-uno')
    expect(ficha.bloque).toBe('vocabulario')
    expect(ficha.titulo).toBe('¿Qué es RIR?')
    expect(ficha.variantes).toHaveLength(8)
    expect(ficha.variantes[0]).toBe('qué es rir')
    expect(ficha.banderaSalud).toBe(false)
    expect(ficha.datosQueUsa).toEqual(['rir_pautado'])
    expect(ficha.fuentes).toEqual(['metodo-heracles-anexo'])
  })

  it('extrae las cinco partes del cuerpo', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    expect(ficha.cuerpo.respuesta_directa).toContain('repeticiones que te quedan')
    expect(ficha.cuerpo.por_que).toContain('medir cuánto te acercas')
    expect(ficha.cuerpo.tu_caso_hoy).toContain('{{rir_pautado}}')
    expect(ficha.cuerpo.que_hago_ahora).toContain('pregúntate')
    expect(ficha.cuerpo.senal_alarma).toContain('calibramos')
  })

  it('lanza si no hay frontmatter', () => {
    expect(() => parsearFicha('## respuesta_directa\nhola')).toThrow(
      /frontmatter/i,
    )
  })
})

import {
  PARTES,
  contarPalabras,
  parsearFicha,
  ranurasUsadas,
  validarFicha,
} from './ficha'

function fichaCon(cambios: Partial<ReturnType<typeof parsearFicha>>) {
  return { ...parsearFicha(FICHA_MINIMA), ...cambios }
}

describe('validarFicha — frontmatter', () => {
  it('una ficha correcta no produce errores', () => {
    expect(validarFicha(parsearFicha(FICHA_MINIMA))).toEqual([])
  })

  it('exige un id en kebab-case', () => {
    const errores = validarFicha(fichaCon({ id: 'Demo Uno' }))
    expect(errores).toContain('id debe ser kebab-case: "Demo Uno"')
  })

  it('exige que el bloque sea uno de los 12', () => {
    const errores = validarFicha(fichaCon({ bloque: 'inventado' }))
    expect(errores).toContain('bloque desconocido: "inventado"')
  })

  it('exige al menos 8 variantes de frase', () => {
    const errores = validarFicha(fichaCon({ variantes: ['una', 'dos'] }))
    expect(errores).toContain('se requieren al menos 8 variantes, hay 2')
  })

  it('exige al menos una fuente', () => {
    const errores = validarFicha(fichaCon({ fuentes: [] }))
    expect(errores).toContain('la ficha debe declarar al menos una fuente')
  })

  it('rechaza ranuras fuera del catálogo', () => {
    const errores = validarFicha(fichaCon({ datosQueUsa: ['peso_ideal'] }))
    expect(errores).toContain('ranura desconocida en datos_que_usa: "peso_ideal"')
  })
})

describe('validarFicha — cuerpo', () => {
  it('exige las cinco partes presentes', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.cuerpo.senal_alarma = ''
    expect(validarFicha(ficha)).toContain('falta la parte "senal_alarma"')
  })

  it('rechaza un cuerpo demasiado largo', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    // 81 palabras del fixture − 29 de por_que + 200 de relleno = 252
    ficha.cuerpo.por_que = 'palabra '.repeat(200)
    expect(validarFicha(ficha)).toContain(
      'el cuerpo tiene 252 palabras, el máximo es 160',
    )
  })

  it('rechaza un cuerpo demasiado corto', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    for (const parte of PARTES) ficha.cuerpo[parte] = 'muy corto'
    expect(validarFicha(ficha)).toContain(
      'el cuerpo tiene 10 palabras, el mínimo es 70',
    )
  })

  it('cuenta palabras con contarPalabras', () => {
    expect(contarPalabras('  hola   mundo  ')).toBe(2)
    expect(contarPalabras('')).toBe(0)
  })
})

describe('validarFicha — ranuras', () => {
  it('detecta ranuras usadas pero no declaradas', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.cuerpo.tu_caso_hoy = 'Hoy tienes {{ejercicio_hoy}} a RIR {{rir_pautado}}.'
    expect(validarFicha(ficha)).toContain(
      'ranura usada en el texto pero no declarada: "ejercicio_hoy"',
    )
  })

  it('detecta ranuras declaradas pero no usadas', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.datosQueUsa = ['rir_pautado', 'medidas']
    expect(validarFicha(ficha)).toContain(
      'ranura declarada pero nunca usada: "medidas"',
    )
  })

  it('extrae las ranuras del texto', () => {
    expect(ranurasUsadas('a {{uno}} b {{dos}} c {{uno}}')).toEqual(['uno', 'dos'])
  })
})

describe('validarFicha — reglas de objetividad', () => {
  it('rechaza plazos de resultado', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.cuerpo.por_que = 'En 4 semanas vas a ver el cambio en el espejo.'
    expect(validarFicha(ficha)).toContain(
      'promesa de plazo prohibida (§7.5): "en 4 semanas"',
    )
  })

  it('rechaza promesas de resultado', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.cuerpo.por_que = 'Esto te garantiza ganar masa muscular rápido.'
    expect(validarFicha(ficha)).toContain(
      'promesa de resultado prohibida (§7.5): "garantiza"',
    )
  })

  it('rechaza lenguaje de diagnóstico', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    ficha.cuerpo.senal_alarma = 'Lo que tienes es una tendinitis rotuliana.'
    expect(validarFicha(ficha)).toContain(
      'lenguaje de diagnóstico prohibido (§7.5): "lo que tienes es"',
    )
  })

  it('no marca texto legítimo', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    const errores = validarFicha(ficha)
    expect(errores.filter((e) => e.includes('§7.5'))).toEqual([])
  })
})
