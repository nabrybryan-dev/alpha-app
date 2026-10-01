import { describe, expect, it } from 'vitest'
import type { LoQuePraxisVe } from './plan/listaBlanca'
import { SALUD_SIN_REGISTRO, decidirTurno, pasoTrasProponer, resumenDeGuardado, sinNombres, type RespuestaDelRegistrador } from './conversacion'

/**
 * El orden de un turno de Praxis. Lo que se prueba aquí es el ORDEN, que es la regla de
 * seguridad: primero el filtro de riesgo por reglas, después lo que se contesta sin
 * modelo, y solo al final el registrador (que es el único camino que llega a un modelo).
 */
const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo'] }
const HOY = '2026-10-01'

describe('decidirTurno · seguridad primero', () => {
  it('una frase de riesgo va a la Quieta y NO al modelo', () => {
    const t = decidirTurno('le metí 40 a la sentadilla pero la verdad me quiero morir', ve, HOY)
    expect(t).toEqual({ paso: 'quieta', linea: 'vida', vaAlModelo: false })
  })

  it('lo ambiguo se pregunta y NO va al modelo', () => {
    expect(decidirTurno('ya no puedo más con todo', ve, HOY)).toEqual({ paso: 'cuidado', vaAlModelo: false })
  })

  it('lo clínico no se registra y NO va al modelo', () => {
    const t = decidirTurno('me duele la rodilla, hice 3 series de 10', ve, HOY)
    expect(t.paso).toBe('salud')
    expect(t.vaAlModelo).toBe(false)
  })

  it('el riesgo gana aunque la frase sea una pregunta', () => {
    expect(decidirTurno('¿qué hago si me quiero morir?', ve, HOY).paso).toBe('quieta')
  })
})

describe('decidirTurno · lo que se contesta sin modelo', () => {
  it('una pregunta del plan se contesta con reglas: nunca va al modelo', () => {
    const t = decidirTurno('¿qué me toca hoy?', ve, HOY)
    expect(t.paso).toBe('plan')
    expect(t.vaAlModelo).toBe(false)
  })
})

describe('decidirTurno · solo lo demás llega al registrador', () => {
  it.each(['le metí 40 kilos, 12 en la sentadilla', 'dormí 6 horas y amanecí cansada', 'tomé dos vasos de agua'])('«%s» → registrar', (f) => {
    expect(decidirTurno(f, ve, HOY)).toEqual({ paso: 'registrar', vaAlModelo: true })
  })

  it('una frase vacía no hace nada', () => {
    expect(decidirTurno('   ', ve, HOY)).toEqual({ paso: 'nada', vaAlModelo: false })
  })
})

const base = { propuesta: { accion: 'tarjeta', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] }, meta: {} }
function respuesta(tarjeta: Record<string, unknown>, propuesta: Record<string, unknown> = {}): RespuestaDelRegistrador {
  return { ok: true, propuesta: { ...base.propuesta, ...propuesta }, tarjeta: { lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false, titulo: '', ...tarjeta } } as unknown as RespuestaDelRegistrador
}

describe('pasoTrasProponer · qué se muestra con lo que devolvió el registrador', () => {
  it('una tarjeta guardable se muestra para confirmar con un toque', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'confirmacion', guardable: true, lineas: [{ tarjeta_id: 'm:0', texto: 'SENTADILLA · serie 1 · 40 kg × 12', editable: true }] }), 'tu')
    expect(p.paso).toBe('confirmar')
  })

  it('una tarjeta sin nada que guardar no ofrece «Guardar»', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'confirmacion', guardable: false }), 'tu').paso).toBe('no_se')
  })

  it('una derivación clínica del servidor usa el texto honesto de la pantalla, sin nombres ni promesas de aviso', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'derivacion', mensaje: 'Le paso esto a Bryan para que lo revise.' }, { accion: 'derivar', filtro: 'dolor' }), 'tu')
    expect(p).toEqual({ paso: 'salud', texto: SALUD_SIN_REGISTRO.tu })
  })

  it('una derivación de crisis del servidor va a la Quieta', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'crisis', urgencia: 'alta' }), 'tu')).toEqual({ paso: 'quieta', linea: 'vida' })
  })

  it('una consulta que el registrador no contesta acaba en «pregunta en espera»', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'informativa', mensaje: 'Eso lo decide Bryan con tus números. Le paso la pregunta.' }, { accion: 'nada', motivo: 'consulta' }), 'tu')
    expect(p.paso).toBe('no_se')
    expect(p.paso === 'no_se' && p.texto).not.toMatch(/Bryan/)
  })

  it('la pregunta de aclaración se muestra con sus opciones, sin nombres propios', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'pregunta', pregunta: { texto: '¿Se lo dejo a Bryan como nota?', opciones: ['Sí, nota para Bryan', 'No, olvídalo'] } }, { accion: 'preguntar' }), 'tu')
    expect(p).toEqual({ paso: 'aclarar', texto: '¿Se lo dejo a tu coach como nota?', opciones: ['Sí, nota para tu coach', 'No, olvídalo'] })
  })

  it.each([
    ['no_desplegada', /registrador todavía no está encendido/],
    ['sin_sesion', /sesión/],
    ['red', /conexión/],
    ['limite', /muchos mensajes/],
    ['no_entendi', /No te entendí/],
  ] as const)('si el registrador falla (%s) lo dice y no inventa un registro', (motivo, patron) => {
    const p = pasoTrasProponer({ ok: false, motivo }, 'tu')
    expect(p.paso).toBe('fallo')
    expect(p.paso === 'fallo' && p.texto).toMatch(patron)
  })
})

describe('sinNombres', () => {
  it('cambia los nombres propios por el rol', () => {
    expect(sinNombres('Le aviso a Bryan y a Manuela', 'tu')).toBe('Le aviso a tu coach y a tu nutricionista')
    expect(sinNombres('Nota para Bryan', 'usted')).toBe('Nota para su coach')
  })
})

describe('los textos fijos de salud', () => {
  it('no prometen un aviso que hoy no existe, no nombran a nadie y dan el 123', () => {
    for (const t of Object.values(SALUD_SIN_REGISTRO)) {
      expect(t).not.toMatch(/Bryan|Manuela/)
      expect(t).not.toMatch(/le (aviso|paso|pido)|ya recibi/i)
      expect(t).toContain('123')
    }
  })
})

describe('resumenDeGuardado · lo que de verdad quedó guardado', () => {
  it('dice una línea por registro y no llama «guardado» a lo que no se guardó', () => {
    const r = resumenDeGuardado({ ok: true, resultados: [
      { indice: 0, campo: 'series', estado: 'guardado' },
      { indice: 1, campo: 'checkin', estado: 'pendiente_prerrequisito', motivo: 'P2: hoy una fila parcial cierra el formulario' },
      { indice: 2, campo: 'series', estado: 'rechazado', motivo: 'la serie 5 no existe en la pauta' },
    ] }, 'tu')
    expect(r.todoGuardado).toBe(false)
    expect(r.lineas).toEqual([
      'Guardado: series.',
      'Tu check-in todavía no se puede guardar desde Praxis: anótalo en el formulario.',
      'No se guardó (series): la serie 5 no existe en la pauta.',
    ])
  })

  it('si todo entró, lo dice', () => {
    const r = resumenDeGuardado({ ok: true, resultados: [{ indice: 0, campo: 'adherencia', estado: 'guardado' }] }, 'tu')
    expect(r).toEqual({ todoGuardado: true, lineas: ['Guardado: adherencia.'] })
  })

  it('si la llamada falló, NADA quedó guardado y lo dice', () => {
    const r = resumenDeGuardado({ ok: false, motivo: 'red' }, 'tu')
    expect(r.todoGuardado).toBe(false)
    expect(r.lineas[0]).toMatch(/No se guardó nada/)
  })

  it('una respuesta sin resultados no se da por buena', () => {
    expect(resumenDeGuardado({ ok: true, resultados: [] }, 'tu').todoGuardado).toBe(false)
  })
})

describe('pasoTrasProponer · el resto de salidas del registrador', () => {
  it('un síntoma de urgencia que derive el servidor también va a la Quieta', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'sintoma', urgencia: 'alta' }), 'tu')).toEqual({ paso: 'quieta', linea: 'vida' })
  })

  it('un síntoma sin urgencia es salud, no Quieta', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'sintoma' }), 'usted')).toEqual({ paso: 'salud', texto: SALUD_SIN_REGISTRO.usted })
  })

  it('charla, bloque vencido y ejercicios omitidos se dicen sin prometer avisos', () => {
    const charla = pasoTrasProponer(respuesta({ tipo: 'informativa', mensaje: 'De eso no hablo.' }, { accion: 'nada', motivo: 'charla' }), 'tu')
    const vencido = pasoTrasProponer(respuesta({ tipo: 'informativa', mensaje: 'le aviso a Bryan y lo dejo guardado' }, { accion: 'nada', motivo: 'microciclo_vencido' }), 'tu')
    const omitidos = pasoTrasProponer(respuesta({ tipo: 'informativa', mensaje: 'Listo, no los marco y le aviso a Bryan que faltaron.' }, { accion: 'nada', motivo: 'omitidos' }), 'tu')
    expect(charla.paso === 'dicho' && charla.texto).toContain('Cuéntame qué anoto')
    expect(vencido.paso === 'dicho' && vencido.texto).toBe('Tu bloque de entrenamiento ya venció y el nuevo todavía no está aprobado. No lo anoto en el bloque viejo.')
    expect(omitidos).toEqual({ paso: 'dicho', texto: 'Listo, no los marco.' })
    for (const p of [charla, vencido, omitidos]) expect(JSON.stringify(p)).not.toMatch(/Bryan|le aviso/)
  })

  it('en usted', () => {
    const charla = pasoTrasProponer(respuesta({ tipo: 'informativa' }, { accion: 'nada', motivo: 'charla' }), 'usted')
    const vencido = pasoTrasProponer(respuesta({ tipo: 'informativa' }, { accion: 'nada', motivo: 'microciclo_vencido' }), 'usted')
    expect(charla.paso === 'dicho' && charla.texto).toContain('Cuénteme qué anoto')
    expect(vencido.paso === 'dicho' && vencido.texto).toContain('Su bloque de entrenamiento')
    expect(pasoTrasProponer({ ok: false, motivo: 'frase' }, 'usted')).toEqual({ paso: 'fallo', texto: 'Esa frase es muy larga para anotarla de una vez. Dígamela por partes.' })
  })

  it('otro «nada que guardar» con mensaje se dice con el rol, no con el nombre', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'informativa', mensaje: 'Borrar una serie no lo puedo hacer desde aquí. Díselo a Bryan.' }, { accion: 'nada', motivo: 'no_soportado' }), 'tu')
    expect(p).toEqual({ paso: 'dicho', texto: 'Borrar una serie no lo puedo hacer desde aquí. Díselo a tu coach.' })
  })

  it('sin motivo y sin mensaje, dice que no encontró nada que anotar', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'informativa' }, { accion: 'nada' }), 'tu')
    expect(p).toEqual({ paso: 'no_se', texto: 'No encontré nada que anotar en eso, y no quiero adivinar.', queFalto: 'no_entendido' })
  })

  it('una tarjeta guardable pero sin líneas no se ofrece para guardar a ciegas', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'confirmacion', guardable: true, lineas: [] }), 'tu').paso).toBe('no_se')
  })
})

describe('decidirTurno · en usted', () => {
  it('el texto de salud y la respuesta del plan salen en usted', () => {
    const salud = decidirTurno('me duele la rodilla', ve, HOY, 'usted')
    expect(salud.paso === 'salud' && salud.texto).toBe(SALUD_SIN_REGISTRO.usted)
    const plan = decidirTurno('¿qué me toca hoy?', ve, HOY, 'usted')
    expect(plan.paso === 'plan' && plan.respuesta.texto).toContain('suyo')
  })
})

describe('resumenDeGuardado · lo pendiente se nombra como lo que es', () => {
  it('el agua, la comida, el cardio y la preparación, en tú y en usted', () => {
    const r = (campo: string, trato: 'tu' | 'usted') => resumenDeGuardado({ ok: true, resultados: [{ indice: 0, campo, estado: 'pendiente_prerrequisito' }] }, trato).lineas[0]
    expect(r('hidratacion', 'tu')).toBe('El agua todavía no se puede guardar desde Praxis: anótalo en el formulario.')
    expect(r('comida', 'tu')).toBe('La comida todavía no se puede guardar desde Praxis: anótalo en el formulario.')
    expect(r('bloquesCardio[c1].duracionRealMin', 'tu')).toBe('El cardio todavía no se puede guardar desde Praxis: anótalo en el formulario.')
    expect(r('preparacion[p1].hechoEn', 'tu')).toBe('La preparación todavía no se puede guardar desde Praxis: anótalo en el formulario.')
    expect(r('otra_cosa', 'tu')).toBe('Eso todavía no se puede guardar desde Praxis: anótalo en el formulario.')
    expect(r('checkin', 'usted')).toBe('Su check-in todavía no se puede guardar desde Praxis: anótelo en el formulario.')
  })

  it('un rechazo sin motivo no deja la frase a medias', () => {
    expect(resumenDeGuardado({ ok: true, resultados: [{ indice: 0, campo: 'series', estado: 'rechazado' }] }, 'tu').lineas).toEqual(['No se guardó (series): la base no lo aceptó.'])
  })
})

describe('revisión del PR #331 · la marca de riesgo del servidor se respeta tal cual', () => {
  it('una Quieta de pareja del servidor lleva a la 155, no a la línea genérica', () => {
    const p = pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'crisis', urgencia: 'alta', riesgo: { tipo: 'quieta', linea: 'pareja' } }), 'tu')
    expect(p).toEqual({ paso: 'quieta', linea: 'pareja' })
  })

  it('una Quieta de un niño lleva a la 141', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'crisis', riesgo: { tipo: 'quieta', linea: 'nino' } }), 'tu')).toEqual({ paso: 'quieta', linea: 'nino' })
  })

  it('una frase ambigua marcada por el servidor lleva a la pregunta de cuidado, no a la Quieta', () => {
    expect(pasoTrasProponer(respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'crisis', urgencia: 'alta', riesgo: { tipo: 'cuidado' } }), 'tu')).toEqual({ paso: 'cuidado' })
  })
})
