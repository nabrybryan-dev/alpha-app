import { describe, expect, it } from 'vitest'
import type { CheckinDiario, Microciclo, Perfil, PlanNutricional, VisibilidadAsesorado } from '../../types'
import { CAMPOS_PERMITIDOS, DIAS_DE_REGISTRO, loQuePraxisVe, type CrudoDePersona } from './listaBlanca'

/**
 * La lista blanca de «Praxis conoce tu plan» (DISENO §1). La RLS no distingue columnas y
 * deja leer a la persona cosas que no son para ella (su plan `propuesto`, notas del staff):
 * lo que Praxis puede ver se decide AQUÍ, campo por campo.
 *
 * La segunda mitad de este archivo es la guarda: recorre lo que sale y falla si aparece una
 * clave que nadie apuntó en `CAMPOS_PERMITIDOS`. Añadir un campo exige pasar por la lista.
 */
const HOY = '2026-10-01'

function ejercicio(extra: Record<string, unknown> = {}) {
  return {
    id: 'e1', categoria: 'PIERNA', nombre: 'SENTADILLA TRASERA', cues: 'Rodillas afuera', prescripcion: '40KG A 8 REPS; 3 SERIES',
    cargaKg: 40, unidadCarga: 'kg', notaCoach: 'Baja lento', descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2,
    seriesPrescritas: [{ orden: 1, reps: 8, rir: 2, cargaKg: 40 }], etiquetasSeries: ['tope'],
    escenarios: { rojo: { deltaRir: 1, sueloRir: 3, quitarUltimaSerie: true }, verde: { deltaCargaKg: 2.5, techoCargaKg: 45 } },
    pvObjetivo: 0.5, contenidoDemoId: 'demo-1',
    series: [{ orden: 1, cargaKg: 40, reps: 8, rir: 2, velocidad: { media: 0.4 } }],
    ...extra,
  }
}

function microciclo(estado: Microciclo['estado'], numero: number, extra: Record<string, unknown> = {}): Microciclo {
  return {
    id: `m-${numero}`, usuarioId: 'u1', numero, cadenciaDias: 7, estado, fechaInicio: '2026-09-28',
    sesiones: [{
      id: 's1', nombre: 'PIERNA A', orden: 1, dia: 'lunes', fecha: '2026-09-28', empezadaEn: '2026-09-28T10:00:00Z', tipo: 'fuerza',
      preparacion: [{ id: 'p1', tipo: 'movilidad', titulo: 'LEE ESTO: cadera', indicaciones: '2 vueltas', duracionMin: 5, hechoEn: '2026-09-28T10:01:00Z' }],
      bloquesCardio: [{ id: 'c1', titulo: 'Caminata', indicaciones: 'Zona 2', duracionMin: 20, fcMedia: 130 }],
      ejercicios: [ejercicio()],
      testPost: { duracionMin: 60, rpeSesion: 7, prsEntrada: 6 },
    }],
    ...extra,
  } as unknown as Microciclo
}

const perfil = {
  usuarioId: 'u1', objetivos: 'Ganar fuerza', edad: 31, diasEntrenamiento: 4, diasDisponibles: ['lunes', 'miercoles'],
  tiempoSesionMin: 60, somatotipo: 'meso', volumenSemanal: { pierna: 'Alto' }, faseEnergetica: 'mantenimiento', proteinaGkg: 2, pasosObjetivo: 8000,
  medidas: [{ fecha: '2026-09-01', pesoKg: 64.2, alturaCm: 165, perimetros: { cintura: 70 } }],
} as unknown as Perfil

function checkin(fecha: string, extra: Partial<CheckinDiario> = {}): CheckinDiario {
  return {
    id: `ck-${fecha}`, usuarioId: 'u1', fecha, horasSueno: 7, calidadSueno: 'BUENA', cansancio: 'POCO', entreno: 'PIERNA A',
    rendimiento: 'BUENA', motivacion: 'MUCHO', dolor: 0, hambreEscala: 5, alimentacion: 'BUENA', estres: 'POCO', pasos: 9000,
    pesoKg: 64.2, comentarios: 'bien', ...extra,
  }
}

const plan: PlanNutricional = {
  id: 'pn1', usuarioId: 'u1', analisis: 'NOTA INTERNA de la nutricionista',
  macrosPorDia: { ALTO: { kcal: 2200, proteinaG: 130, carbosG: 250, grasaG: 70 }, BAJO: { kcal: 1800, proteinaG: 130, carbosG: 150, grasaG: 70 }, CHEAT: { kcal: 2500, proteinaG: 120, carbosG: 300, grasaG: 80 } },
  menus: [{ nombre: 'Día alto', tipoDia: 'ALTO', comidas: [{ hora: '07:00', titulo: 'Desayuno', alimentos: ['2 huevos', 'arepa'], nota: 'con agua' }] }],
  equivalencias: [{ grupo: 'Harinas', base: 'arepa', opciones: ['pan'] }],
  listaCompras: ['huevos'], suplementacion: ['creatina 3 g'], seccionesEspeciales: [{ titulo: 'Fuera de casa', contenido: 'Elige proteína' }],
}

const visibilidad: VisibilidadAsesorado = { usuarioId: 'u1', verComposicion: false, verObjetivoCalorico: false, verContadorKcal: false, estado: 'decidido', nota: 'riesgo de TCA, no enseñar cifras' }

function crudo(extra: Partial<CrudoDePersona> = {}): CrudoDePersona {
  return {
    usuarioId: 'u1',
    microciclos: [microciclo('cerrado', 5), microciclo('activo', 6), microciclo('propuesto', 7)],
    perfil,
    checkins: [checkin('2026-10-01'), checkin('2026-09-30'), checkin('2026-09-10')],
    planNutricional: plan,
    visibilidad,
    adherencias: [{ id: 'a1', usuarioId: 'u1', fecha: '2026-09-30', estado: 'si', comentario: 'todo' }],
    hidratacionHoyMl: 750,
    ...extra,
  }
}

describe('loQuePraxisVe · qué entra', () => {
  it('el microciclo activo con su prescripción, y los cerrados como historia', () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    expect(ve.activo?.numero).toBe(6)
    expect(ve.cerrados.map((m) => m.numero)).toEqual([5])
    const ej = ve.activo?.sesiones[0].ejercicios[0]
    expect(ej).toMatchObject({ nombre: 'SENTADILLA TRASERA', prescripcion: '40KG A 8 REPS; 3 SERIES', cargaKg: 40, sets: 3, rirObjetivo: 2, notaCoach: 'Baja lento' })
    expect(ej?.series).toEqual([{ orden: 1, cargaKg: 40, reps: 8, rir: 2 }])
  })

  it('del perfil, solo lo de entreno', () => {
    expect(loQuePraxisVe(crudo(), HOY).perfil).toEqual({
      objetivos: 'Ganar fuerza', diasDisponibles: ['lunes', 'miercoles'], tiempoSesionMin: 60, faseEnergetica: 'mantenimiento', pasosObjetivo: 8000,
    })
  })

  it(`los check-ins de los últimos ${DIAS_DE_REGISTRO} días, sin el peso`, () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    expect(ve.checkins.map((c) => c.fecha)).toEqual(['2026-09-30', '2026-10-01'])
    expect(ve.checkins[0]).not.toHaveProperty('pesoKg')
  })

  it('del plan de comida, las comidas y las equivalencias', () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    expect(ve.comida?.menus[0].comidas[0]).toEqual({ hora: '07:00', titulo: 'Desayuno', alimentos: ['2 huevos', 'arepa'], nota: 'con agua' })
    expect(ve.comida?.equivalencias).toHaveLength(1)
  })
})

describe('loQuePraxisVe · qué NO entra nunca', () => {
  it('el plan `propuesto` sin firmar no llega, aunque la base se lo deje leer a la persona', () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    const numeros = [ve.activo?.numero, ...ve.cerrados.map((m) => m.numero)]
    expect(numeros).not.toContain(7)
    expect(JSON.stringify(ve)).not.toContain('m-7')
  })

  it('si solo hay un plan propuesto, Praxis no ve ningún plan', () => {
    const ve = loQuePraxisVe(crudo({ microciclos: [microciclo('propuesto', 1)] }), HOY)
    expect(ve.activo).toBeNull()
    expect(ve.cerrados).toEqual([])
  })

  it('un estado desconocido se trata como no aprobado', () => {
    const raro = microciclo('activo', 9, { estado: 'borrador' })
    expect(loQuePraxisVe(crudo({ microciclos: [raro] }), HOY).activo).toBeNull()
  })

  it('las notas internas del staff no pasan: ni el análisis del plan ni la nota de visibilidad', () => {
    const texto = JSON.stringify(loQuePraxisVe(crudo(), HOY))
    expect(texto).not.toContain('NOTA INTERNA')
    expect(texto).not.toContain('riesgo de TCA')
  })

  it('campos que alguien cuelgue de un ejercicio o de un microciclo no pasan', () => {
    const conExtras = microciclo('activo', 6, { origenAgentes: { corrida: 'c-1' }, avisos: ['para el coach'], porqueInterno: 'no decir' })
    conExtras.sesiones[0].ejercicios[0] = ejercicio({ notaInterna: 'ojo con la rodilla', motivo: 'delta_series' }) as never
    const texto = JSON.stringify(loQuePraxisVe(crudo({ microciclos: [conExtras] }), HOY))
    for (const fuga of ['origenAgentes', 'para el coach', 'porqueInterno', 'ojo con la rodilla', 'delta_series']) expect(texto).not.toContain(fuga)
  })

  it('las medidas corporales no viajan', () => {
    const texto = JSON.stringify(loQuePraxisVe(crudo(), HOY))
    expect(texto).not.toContain('perimetros')
    expect(texto).not.toContain('64.2')
  })

  it('con las cifras de comida ocultas para la persona, Praxis tampoco las ve', () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    expect(JSON.stringify(ve.comida)).not.toMatch(/kcal|proteinaG|2200/)
    expect(ve.comida?.verCifras).toBe(false)
  })

  it('lo de otra persona se descarta aunque venga en la misma lista', () => {
    const ajeno = microciclo('activo', 3, { usuarioId: 'otro' })
    const ve = loQuePraxisVe(crudo({ microciclos: [ajeno], checkins: [checkin('2026-10-01', { usuarioId: 'otro' })] }), HOY)
    expect(ve.activo).toBeNull()
    expect(ve.checkins).toEqual([])
  })
})

describe('loQuePraxisVe · cuando falta un dato, lo dice', () => {
  it('sin nada cargado, todo queda vacío y `falta` lo nombra', () => {
    const ve = loQuePraxisVe({ usuarioId: 'u1', microciclos: [], checkins: [], adherencias: [] }, HOY)
    expect(ve.activo).toBeNull()
    expect(ve.perfil).toBeNull()
    expect(ve.comida).toBeNull()
    expect(ve.falta).toEqual(expect.arrayContaining(['plan_activo', 'perfil', 'checkins', 'plan_de_comida']))
  })

  it('con todo cargado no falta nada', () => {
    expect(loQuePraxisVe(crudo(), HOY).falta).toEqual([])
  })
})

/** Todas las claves de un valor, con la ruta sin índices: `activo.sesiones.ejercicios.nombre`. */
function claves(valor: unknown, ruta = ''): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v) => claves(v, ruta))
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => {
      const r = ruta ? `${ruta}.${k}` : k
      return [r, ...claves(v, r)]
    })
  }
  return []
}

describe('la guarda de la lista blanca', () => {
  it('todo lo que sale está apuntado en CAMPOS_PERMITIDOS', () => {
    const salen = new Set(claves(loQuePraxisVe(crudo(), HOY)))
    const fuera = [...salen].filter((c) => !CAMPOS_PERMITIDOS.includes(c))
    expect(fuera, `campos que salen sin estar en la lista blanca: ${fuera.join(', ')}`).toEqual([])
  })

  it('la lista no nombra nada prohibido por el diseño', () => {
    for (const prohibido of ['propuesto', 'avisos', 'resumen', 'preguntas_pendientes', 'motivo', 'cribado', 'justificacion', 'supuestos', 'analisis', 'nota', 'medidas', 'pesoKg', 'macrosPorDia', 'suplementacion']) {
      expect(CAMPOS_PERMITIDOS.filter((c) => c.split('.').pop() === prohibido && !c.startsWith('comida.menus.comidas')), prohibido).toEqual([])
    }
  })
})

describe('loQuePraxisVe · datos a medias', () => {
  // Los microciclos viejos y las cargas hechas a mano no traen todos los campos. La lista
  // blanca no puede romperse con ellos ni rellenar lo que falta.
  it('un microciclo sin sesiones, una sesión sin ejercicios y un ejercicio sin series', () => {
    const sinSesiones = { ...microciclo('cerrado', 3), sesiones: undefined } as unknown as Microciclo
    const pelado = microciclo('activo', 4)
    pelado.sesiones = [
      { id: 's1', nombre: 'CARDIO', orden: 1 } as never,
      { id: 's2', nombre: 'PIERNA', orden: 2, ejercicios: [{ id: 'e9', nombre: 'PRENSA', categoria: 'PIERNA', prescripcion: '3 SERIES', cues: '', descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2 }] } as never,
    ]
    const ve = loQuePraxisVe(crudo({ microciclos: [sinSesiones, pelado] }), HOY)
    expect(ve.cerrados[0].sesiones).toEqual([])
    expect(ve.activo?.sesiones[0]).toEqual({ id: 's1', nombre: 'CARDIO', ejercicios: [], preparacion: [], bloquesCardio: [] })
    expect(ve.activo?.sesiones[1].ejercicios[0]).toEqual({ id: 'e9', nombre: 'PRENSA', categoria: 'PIERNA', prescripcion: '3 SERIES', cues: '', descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, series: [] })
  })

  it('lo que el ejercicio sí trae —etiquetas, escenario rojo, test de la sesión— pasa completo', () => {
    const ve = loQuePraxisVe(crudo(), HOY)
    const s = ve.activo?.sesiones[0]
    expect(s?.ejercicios[0].etiquetasSeries).toEqual(['tope'])
    expect(s?.ejercicios[0].escenarioRojo).toEqual({ deltaRir: 1, sueloRir: 3, quitarUltimaSerie: true })
    expect(s?.testPost).toEqual({ duracionMin: 60, rpeSesion: 7 })
    expect(s?.preparacion).toEqual([{ titulo: 'LEE ESTO: cadera', indicaciones: '2 vueltas', duracionMin: 5 }])
    expect(s?.bloquesCardio).toEqual([{ titulo: 'Caminata', indicaciones: 'Zona 2', duracionMin: 20 }])
  })

  it('el escenario verde (subir carga) no pasa: Praxis no lo propone', () => {
    expect(JSON.stringify(loQuePraxisVe(crudo(), HOY))).not.toMatch(/techoCargaKg|deltaCargaKg|verde/)
  })

  it('un plan de comida con secciones que faltan sale con listas vacías', () => {
    const corto = { id: 'pn2', usuarioId: 'u1', analisis: 'interno', menus: [{ nombre: 'Único', tipoDia: 'ALTO' }] } as unknown as PlanNutricional
    expect(loQuePraxisVe(crudo({ planNutricional: corto }), HOY).comida).toEqual({ verCifras: false, menus: [{ nombre: 'Único', comidas: [] }], equivalencias: [], seccionesEspeciales: [], listaCompras: [] })
    const sinNada = { id: 'pn3', usuarioId: 'u1' } as unknown as PlanNutricional
    expect(loQuePraxisVe(crudo({ planNutricional: sinNada }), HOY).comida?.menus).toEqual([])
    const sinAlimentos = { id: 'pn4', usuarioId: 'u1', menus: [{ nombre: 'M', tipoDia: 'ALTO', comidas: [{ hora: '07:00', titulo: 'Desayuno' }] }], equivalencias: [{ grupo: 'G', base: 'b' }] } as unknown as PlanNutricional
    const comida = loQuePraxisVe(crudo({ planNutricional: sinAlimentos }), HOY).comida
    expect(comida?.menus[0].comidas[0]).toEqual({ hora: '07:00', titulo: 'Desayuno', alimentos: [] })
    expect(comida?.equivalencias[0]).toEqual({ grupo: 'G', base: 'b', opciones: [] })
  })

  it('las cifras de comida solo cuentan como visibles con los TRES interruptores encendidos', () => {
    const v = (o: Partial<VisibilidadAsesorado>) => loQuePraxisVe(crudo({ visibilidad: { ...visibilidad, verComposicion: true, verObjetivoCalorico: true, verContadorKcal: true, ...o } }), HOY).comida?.verCifras
    expect(v({})).toBe(true)
    expect(v({ verComposicion: false })).toBe(false)
    expect(v({ verObjetivoCalorico: false })).toBe(false)
    expect(v({ verContadorKcal: false })).toBe(false)
    expect(loQuePraxisVe(crudo({ visibilidad: undefined }), HOY).comida?.verCifras).toBe(false)
  })

  it('la visibilidad de otra persona no enciende las cifras', () => {
    const ajena: VisibilidadAsesorado = { usuarioId: 'otro', verComposicion: true, verObjetivoCalorico: true, verContadorKcal: true, estado: 'decidido' }
    expect(loQuePraxisVe(crudo({ visibilidad: ajena }), HOY).comida?.verCifras).toBe(false)
  })

  it('un perfil sin objetivo escrito no inventa uno, y el de otra persona no cuenta', () => {
    const sinObjetivo = { ...perfil, objetivos: '', diasDisponibles: undefined } as unknown as Perfil
    const ve = loQuePraxisVe(crudo({ perfil: sinObjetivo }), HOY)
    expect(ve.perfil).toEqual({ tiempoSesionMin: 60, faseEnergetica: 'mantenimiento', pasosObjetivo: 8000 })
    expect(loQuePraxisVe(crudo({ perfil: { ...perfil, usuarioId: 'otro' } }), HOY).perfil).toBeNull()
  })

  it('el plan de comida de otra persona tampoco', () => {
    expect(loQuePraxisVe(crudo({ planNutricional: { ...plan, usuarioId: 'otro' } }), HOY).comida).toBeNull()
  })

  it('con dos microciclos activos a la vez (estado roto), toma el de número más alto', () => {
    const ve = loQuePraxisVe(crudo({ microciclos: [microciclo('activo', 5), microciclo('activo', 6)] }), HOY)
    expect(ve.activo?.numero).toBe(6)
  })

  it('una hidratación negativa o ausente es cero', () => {
    expect(loQuePraxisVe(crudo({ hidratacionHoyMl: -200 }), HOY).hidratacionHoyMl).toBe(0)
    expect(loQuePraxisVe(crudo({ hidratacionHoyMl: undefined }), HOY).hidratacionHoyMl).toBe(0)
  })
})
