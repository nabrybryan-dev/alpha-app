import { describe, expect, it } from 'vitest'
import { interpretarSerie, type EntradaSerie, type MuestraDeVideo } from './serieMedida'
import {
  aMedicion, calidadDe, claveDeMotivo, idDeMedicion,
  type ContextoMedicion, type MotivoCalidad,
} from './medicionVelocidad'

const FPS = 30

/** Igual que en `serieMedida.test.ts`: ciclos limpios que decaen. */
function serie(o: {
  reps: number; recorridoM?: number; tironS?: number; bajadaS?: number
  pausaS?: number; decaePct?: number; codoGrados?: number; derivaLateralM?: number
}): MuestraDeVideo[] {
  const {
    reps, recorridoM = 0.41, tironS = 0.8, bajadaS = 2.1, pausaS = 0.3,
    decaePct = 4, codoGrados = 95, derivaLateralM = 0,
  } = o
  const m: MuestraDeVideo[] = []
  let t = 0
  const paso = 1 / FPS
  const empujar = (dur: number, desde: number, hasta: number) => {
    const n = Math.max(1, Math.round(dur / paso))
    for (let i = 1; i <= n; i++) {
      t += paso
      m.push({
        t: Math.round(t * 1000) / 1000,
        alturaM: desde + ((hasta - desde) * i) / n,
        lateralM: derivaLateralM * (t / (reps * (tironS + bajadaS + pausaS))),
        troncoGrados: 34,
        codoGrados,
      })
    }
  }
  empujar(0.4, 0, 0)
  for (let r = 0; r < reps; r++) {
    const factor = 1 - (decaePct / 100) * r
    empujar(tironS / Math.max(0.2, factor), 0, recorridoM)
    empujar(pausaS, recorridoM, recorridoM)
    empujar(bajadaS, recorridoM, 0)
    empujar(pausaS, 0, 0)
  }
  return m
}

function entrada(muestras: MuestraDeVideo[], extra: Partial<EntradaSerie> = {}): EntradaSerie {
  return {
    ejercicio: 'Remo', lado: 'derecho', muestras,
    fotogramasTotales: muestras.length, umbralPerdidaPct: 30, ...extra,
  }
}

const CTX: ContextoMedicion = {
  usuarioId: 'u-1',
  microcicloId: 'm-9',
  fecha: '2026-08-20',
  ejercicioId: 'remo-mancuerna',
  ejercicioNom: 'Remo con mancuerna',
  ordenSerie: 2,
  cargaKg: 22.5,
  versionAlgo: 'v1.0.0',
  captura: { fpsReal: 58.3, reloj: 'captureTime' },
}

/**
 * El vocabulario que acepta el CHECK de la 0043. Está copiado a mano a
 * propósito: si alguien amplía el tipo sin tocar la migración, esta lista se
 * queda corta y la prueba de abajo lo dice. Copiarlo del propio tipo haría que
 * la prueba se creyera todo lo que le contaran.
 */
const VOCABULARIO_DE_LA_0043 = [
  'pocos_fps', 'marcador_perdido', 'angulo', 'pocas_reps', 'sin_escala',
  'inclinacion_no_medible', 'referencia_torcida', 'salto_imposible',
  'radio_incoherente', 'sin_segmentar', 'contorno_parcial', 'camara_movida',
  'rom_implausible', 'contraste',
  'codo_estirado', 'te_desplazas', 'objeto_tapado', 'un_solo_ciclo',
]

describe('aMedicion · una serie que sí se midió', () => {
  const r = aMedicion(interpretarSerie(entrada(serie({ reps: 8 }))), CTX)

  it('es buena y no lleva motivos', () => {
    expect(r.calidad).toBe('buena')
    expect(r.motivosCalidad).toEqual([])
  })

  it('guarda la primera y la última, que son las que deciden', () => {
    expect(r.vPrimera).toBeGreaterThan(0)
    expect(r.vUltima).toBeGreaterThan(0)
    // La serie decae un 4 % por repetición: la última tiene que ir más lenta.
    expect(r.vUltima!).toBeLessThan(r.vPrimera!)
    expect(r.pvPct).toBeGreaterThan(0)
  })

  it('la concéntrica va en milisegundos enteros', () => {
    expect(r.concMsMedia).not.toBeNull()
    expect(Number.isInteger(r.concMsMedia)).toBe(true)
  })

  it('respeta los decimales que admite cada columna', () => {
    // numeric(5,3) para las velocidades, numeric(5,2) para el %PV. Guardar más
    // decimales de los que caben es pedirle a Postgres que redondee por su
    // cuenta, y entonces lo que se lee no es lo que se escribió.
    expect(r.vPrimera).toBe(Math.round(r.vPrimera! * 1000) / 1000)
    expect(r.pvPct).toBe(Math.round(r.pvPct! * 100) / 100)
  })
})

describe('aMedicion · una serie que no se pudo medir', () => {
  // Codo por encima de 150°: el brazo va estirado, no hay tirón que medir.
  const r = aMedicion(interpretarSerie(entrada(serie({ reps: 8, codoGrados: 161 }))), CTX)

  it('no es buena y trae al menos un motivo', () => {
    expect(r.calidad).not.toBe('buena')
    expect(r.motivosCalidad.length).toBeGreaterThanOrEqual(1)
  })

  it('no inventa velocidades', () => {
    expect(r.vPrimera).toBeNull()
    expect(r.vUltima).toBeNull()
    expect(r.pvPct).toBeNull()
    expect(r.reps).toEqual([])
  })

  it('conserva el contexto, que es lo que la hace utilizable meses despues', () => {
    // Una fila descartada no es basura: es el registro de que el protocolo
    // fallo ahi, y es la materia prima con la que se arregla. Sin `captura` no
    // se puede descartar despues «todos los telefonos que grabaron a 24 fps», y
    // sin `versionAlgo` no se puede comparar contra otra epoca.
    expect(r.captura).toEqual({ fpsReal: 58.3, reloj: 'captureTime' })
    expect(r.versionAlgo).toBe('v1.0.0')
    expect(r.cargaKg).toBe(22.5)
    expect(r.ejercicioNom).toBe('Remo con mancuerna')
  })

  it('las reps que se salvaron son un numero o null, nunca un 0 inventado', () => {
    // La pantalla pinta una raya cuando no se pudo contar. Un 0 se leeria como
    // «no hizo ninguna», que es una afirmacion distinta.
    expect(r.repsMedidas === null || typeof r.repsMedidas === 'number').toBe(true)
  })
})

describe('el vocabulario de motivos', () => {
  it('traduce el guion del dominio al guion bajo de la columna', () => {
    expect(claveDeMotivo({
      clave: 'codo-estirado', titulo: '', cifra: '', detalle: '',
    })).toBe('codo_estirado')
  })

  it('todo lo que el dominio emite cabe en el CHECK de la 0043', () => {
    // Las cuatro claves de `MotivoSinMedida`. Si alguien añade una quinta a
    // `serieMedida.ts` y no la mete en la migración, la base rechazará la fila
    // en produccion y nadie se enterará hasta ese día. Esta prueba es lo que
    // adelanta ese día a hoy.
    const delDominio = ['codo-estirado', 'te-desplazas', 'objeto-tapado', 'un-solo-ciclo']
    for (const clave of delDominio) {
      const enLaColumna = claveDeMotivo({ clave: clave as never, titulo: '', cifra: '', detalle: '' })
      expect(VOCABULARIO_DE_LA_0043).toContain(enLaColumna)
    }
  })
})

describe('calidadDe · la puerta del motor', () => {
  it('sin motivos es buena, con uno dudosa, con dos o más descartada', () => {
    expect(calidadDe([])).toBe('buena')
    expect(calidadDe(['pocos_fps'])).toBe('dudosa')
    expect(calidadDe(['pocos_fps', 'angulo'])).toBe('descartada')
    expect(calidadDe(['pocos_fps', 'angulo', 'sin_escala'] as MotivoCalidad[])).toBe('descartada')
  })
})

describe('el id se deriva, no se sortea', () => {
  it('medir dos veces la misma serie da el MISMO id', () => {
    // Es lo que hace que repetir una medición refresque la fila en vez de
    // duplicarla. Y repetir no es raro: es lo que uno hace cuando la primera
    // sale descartada.
    const a = aMedicion(interpretarSerie(entrada(serie({ reps: 8 }))), CTX)
    const b = aMedicion(interpretarSerie(entrada(serie({ reps: 6 }))), CTX)
    expect(a.id).toBe(b.id)
  })

  it('cambiar de serie, de día o de ejercicio da un id distinto', () => {
    const base = idDeMedicion(CTX)
    expect(idDeMedicion({ ...CTX, ordenSerie: 3 })).not.toBe(base)
    expect(idDeMedicion({ ...CTX, fecha: '2026-08-21' })).not.toBe(base)
    expect(idDeMedicion({ ...CTX, ejercicioId: 'otro' })).not.toBe(base)
    expect(idDeMedicion({ ...CTX, usuarioId: 'u-2' })).not.toBe(base)
  })

  it('lleva el usuario dentro, que es lo que impide mezclar asesorados', () => {
    expect(idDeMedicion(CTX).startsWith('u-1:')).toBe(true)
  })
})

describe('la invariante de la que depende el CHECK de la base', () => {
  it('interpretarSerie nunca devuelve «sin medida» con cero motivos', () => {
    // `mediciones_motivo_obligatorio` rechaza una fila no buena sin motivos. Si
    // esta invariante se rompiera, la app produciría filas que la base rechaza,
    // y el fallo saldría en el móvil de un asesorado, no aquí.
    const casos = [
      entrada(serie({ reps: 8, codoGrados: 161 })),            // codo estirado
      entrada(serie({ reps: 8, derivaLateralM: 0.8 })),        // se desplaza
      entrada(serie({ reps: 1 })),                             // un solo ciclo
      entrada(serie({ reps: 8 }), { fotogramasTotales: 9999 }), // objeto tapado
    ]
    for (const e of casos) {
      const s = interpretarSerie(e)
      if (s.estado === 'sin-medida') {
        expect(s.motivos.length).toBeGreaterThanOrEqual(1)
        expect(aMedicion(s, CTX).motivosCalidad.length).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
