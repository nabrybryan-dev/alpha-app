import { describe, expect, it } from 'vitest'
import { interpretarPedidoDeshacer } from '../domain/praxis/deshacer/pedido'
import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS, type PiezaDeLaApp } from './catalogoDePiezas'
import { decidirOrganizacion, type DecisionDeOrganizacion, type EstadoDeOrganizacion } from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'
import { FRASE_QUITAR_REGISTRO, escondePesoOMedidas, preguntarSentido, tarjetaDeOrganizacion, type PasoDeOrganizar, type TarjetaDeOrganizacion } from './tarjetaDeOrganizacion'

const perfil: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const libre: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }
const ctx = { trato: 'tu' as const, perfil, estado: libre }
const TODAS = [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS]
const pieza = (id: string): PiezaDeLaApp => TODAS.find((p) => p.id === id)!
const unaLibre = TODAS.find((p) => p.nivel === 'libre' && p.tipo === 'tarjeta' && !escondePesoOMedidas(p))!
const unaFija = TODAS.find((p) => p.nivel === 'fija')!

function laTarjeta(p: PasoDeOrganizar): TarjetaDeOrganizacion {
  if (p.tipo !== 'tarjeta') throw new Error(`esperaba tarjeta, llegó ${p.tipo}`)
  return p.tarjeta
}
const de = (d: DecisionDeOrganizacion) => laTarjeta(tarjetaDeOrganizacion(d, ctx))

/** Una muestra de todas las decisiones posibles (los 27 casos del diseño, con sus variaciones). */
function todas(): DecisionDeOrganizacion[] {
  const motivos = ['fija', 'asignada', 'nucleo_de_la_barra', 'tope_de_ocultas', 'ya_oculta', 'equipo_sin_organizacion', 'contiene_piezas_protegidas', 'sin_acceso', 'no_existe'] as const
  return [
    { tipo: 'traer', pieza: unaLibre, confirmar: true },
    ...(['ocultar', 'fijar', 'mover_arriba', 'mover_abajo'] as const).map((accion): DecisionDeOrganizacion => ({ tipo: 'propone', accion, pieza: unaLibre })),
    { tipo: 'propone', accion: 'ocultar', pieza: unaLibre, quisoBorrar: true },
    { tipo: 'propone', accion: 'ocultar', pieza: pieza('progreso.medidas') },
    { tipo: 'propone_deshacer' }, { tipo: 'nada_que_deshacer' }, { tipo: 'propone_restablecer' },
    { tipo: 'propone_solo_lo_importante', esconderia: [unaLibre, unaLibre] }, { tipo: 'propone_solo_lo_importante', esconderia: [] },
    { tipo: 'lista', libres: [unaLibre] }, { tipo: 'lista_ocultas', piezas: [unaLibre] }, { tipo: 'lista_ocultas', piezas: [] },
    { tipo: 'sugiere_ocultar', pieza: unaLibre }, { tipo: 'pregunta_que_quitar' },
    { tipo: 'pregunta_cual', verbo: 'ocultar', opciones: [unaLibre, unaFija], hayMas: false },
    { tipo: 'pregunta_cual', verbo: 'ocultar', opciones: [unaLibre, unaFija], hayMas: true },
    ...motivos.map((motivo): DecisionDeOrganizacion => ({ tipo: 'rechaza', motivo, pieza: motivo === 'fija' ? unaFija : unaLibre })),
  ]
}

describe('de la decisión a la tarjeta', () => {
  it('riesgo o salud y frases que no son de organizar: NO hay tarjeta', () => {
    expect(tarjetaDeOrganizacion({ tipo: 'seguridad' }, ctx)).toEqual({ tipo: 'nada' })
    expect(tarjetaDeOrganizacion({ tipo: 'no_es_organizacion' }, ctx)).toEqual({ tipo: 'nada' })
  })

  it('«traer» de la gramática abre sin tarjeta; el del modelo pregunta antes (nunca abre solo)', () => {
    expect(tarjetaDeOrganizacion({ tipo: 'traer', pieza: unaLibre }, ctx)).toEqual({ tipo: 'abrir', pieza: unaLibre })
    const t = de({ tipo: 'traer', pieza: unaLibre, confirmar: true })
    expect(t.botones.map((b) => b.etiqueta)).toEqual(['Sí, llévame', 'No'])
    expect(t.botones[0]!.siguiente).toEqual({ tipo: 'abrir', pieza: unaLibre })
  })

  it('solo el botón principal de una confirmación cambia lo guardado; ningún otro botón aplica nada', () => {
    for (const d of todas()) {
      for (const b of de(d).botones) {
        if (b.siguiente.tipo === 'aplicar') expect(b.principal, `${d.tipo}: ${b.etiqueta}`).toBe(true)
      }
    }
  })

  it('toda tarjeta tiene una salida que no cambia nada', () => {
    for (const d of todas()) {
      const t = de(d)
      expect(t.botones.some((b) => b.siguiente.tipo === 'cerrar'), d.tipo).toBe(true)
    }
  })

  it('ningún texto enseña un id ni un nombre técnico', () => {
    for (const d of todas()) {
      const t = de(d)
      for (const s of [t.texto, t.nota ?? '', ...t.botones.map((b) => b.etiqueta)]) expect(s, s).not.toMatch(/pantalla:|hoy\.|progreso\.|organizaci[oó]n guardada|undefined/)
    }
  })

  it('P1 ocultar: «Sí, esconder» / «No, dejarlo», y el «Sí» lleva el cambio exacto', () => {
    const t = de({ tipo: 'propone', accion: 'ocultar', pieza: unaLibre })
    expect(t.texto).toContain('¿Escondo «')
    expect(t.botones.map((b) => b.etiqueta)).toEqual(['Sí, esconder', 'No, dejarlo'])
    expect(t.botones[0]!.siguiente).toEqual({ tipo: 'aplicar', cambio: { tipo: 'pieza', accion: 'ocultar', pieza: unaLibre, avisaAlCoach: false } })
    expect(t.botones[1]!.siguiente).toEqual({ tipo: 'cerrar', frase: 'Listo, no cambié nada.' })
    expect(t.nota).toBeNull()
  })

  it('P1b esconder peso o medidas lo dice de frente y marca el aviso al coach (decisión 6)', () => {
    for (const id of ['progreso.medidas', 'bienestar.medidas']) {
      const t = de({ tipo: 'propone', accion: 'ocultar', pieza: pieza(id) })
      expect(t.nota).toBe('Tu coach verá que lo escondiste, sin ver lo que dijiste.')
      expect(t.botones[0]!.siguiente).toMatchObject({ tipo: 'aplicar', cambio: { avisaAlCoach: true } })
    }
    // Moverla no esconde nada: no se avisa.
    expect(de({ tipo: 'propone', accion: 'mover_arriba', pieza: pieza('progreso.medidas') }).nota).toBeNull()
  })

  it('P2 «borra» dice que solo esconde y que los datos quedan', () => {
    expect(de({ tipo: 'propone', accion: 'ocultar', pieza: unaLibre, quisoBorrar: true }).texto).toMatch(/no borrarlo: tus datos quedan guardados/)
  })

  it('P8 «solo lo importante» muestra solo el número real y P8b avisa si no hay nada', () => {
    const t = de({ tipo: 'propone_solo_lo_importante', esconderia: [unaLibre, unaLibre, unaLibre] })
    expect(t.texto).toBe('Esto esconde 3 cosas y deja solo lo esencial. ¿Seguimos?')
    expect(t.botones[0]!.etiqueta).toBe('Sí, esconder 3')
    expect(de({ tipo: 'propone_solo_lo_importante', esconderia: [] }).botones).toHaveLength(1)
  })

  it('rechazos con razón llevan un botón útil (decisión 4); los de un dato, solo «Entendido»', () => {
    const r = (motivo: Extract<DecisionDeOrganizacion, { tipo: 'rechaza' }>['motivo'], p = unaLibre) => de({ tipo: 'rechaza', motivo, pieza: p }).botones.map((b) => b.etiqueta)
    expect(r('fija', unaFija)).toEqual(['Entendido', 'Muévelo'])
    expect(r('asignada')).toEqual(['Sí, avísale', 'No'])
    expect(r('tope_de_ocultas')).toEqual(['Ver lo escondido', 'Entendido'])
    expect(r('contiene_piezas_protegidas')).toEqual(['Entendido', 'Ver qué trae'])
    expect(r('nucleo_de_la_barra')).toEqual(['Entendido'])
    expect(r('equipo_sin_organizacion')).toEqual(['Entendido'])
    expect(r('sin_acceso')).toEqual(['Entendido'])
  })

  it('«Muévelo» sobre algo fijo pregunta el sentido y propone moverlo (lo fijo se mueve, no se esconde)', () => {
    const t = laTarjeta(preguntarSentido(unaFija, libre))
    expect(t.botones[0]!.siguiente).toMatchObject({ tipo: 'decidir', decision: { tipo: 'propone', accion: 'mover_arriba' } })
    expect(t.botones[1]!.siguiente).toMatchObject({ tipo: 'decidir', decision: { tipo: 'propone', accion: 'mover_abajo' } })
  })

  it('«¿cuál?» da un botón por opción (máximo 3) más «Ninguna», y elegir vuelve a decidir con los candados', () => {
    const t = de({ tipo: 'pregunta_cual', verbo: 'ocultar', opciones: [unaLibre, unaFija], hayMas: false })
    expect(t.botones.map((b) => b.etiqueta)).toEqual([unaLibre.nombreHablado, unaFija.nombreHablado, 'Ninguna'])
    expect(t.botones[0]!.siguiente).toMatchObject({ tipo: 'decidir', decision: { tipo: 'propone', accion: 'ocultar' } })
    expect(t.botones[1]!.siguiente).toMatchObject({ tipo: 'decidir', decision: { tipo: 'rechaza', motivo: 'fija' } })
  })

  it('«Un registro» en «¿quitar qué?» lleva al deshacer de registros y NO vuelve a organizar (sin bucle)', () => {
    const t = de({ tipo: 'pregunta_que_quitar' })
    expect(t.botones[0]!.siguiente).toEqual({ tipo: 'frase', txt: FRASE_QUITAR_REGISTRO })
    expect(decidirOrganizacion(FRASE_QUITAR_REGISTRO, perfil, libre).tipo).toBe('no_es_organizacion')
    expect(interpretarPedidoDeshacer(FRASE_QUITAR_REGISTRO)).not.toBeNull()
  })

  it('con «usted» la tarjeta no tutea', () => {
    const t = laTarjeta(tarjetaDeOrganizacion({ tipo: 'propone', accion: 'ocultar', pieza: pieza('progreso.medidas') }, { ...ctx, trato: 'usted' }))
    expect(`${t.texto} ${t.nota}`).not.toMatch(/\b(tu|puedes|escondiste)\b/)
  })
})
