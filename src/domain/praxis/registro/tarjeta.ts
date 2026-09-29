/**
 * El constructor de la tarjeta de confirmación.
 *
 * La tarjeta le dice a la persona, en términos de la app y no del modelo, lo que
 * Praxis entendió («SENTADILLA TRASERA · serie 1 · 40 kg × 12»). Es PURA y sin
 * interfaz: devuelve datos (líneas, avisos, botones) que la pantalla pinta.
 * Nada se guarda hasta que se toque «Guardar».
 *
 * Reglas de presentación que importan:
 *  - Las conversiones se ven: «135 lb = 61,2 kg», «20 + 40 = 60 kg»,
 *    «barra sola = 20 kg».
 *  - Un reemplazo se ve como reemplazo («40 → 45»), porque `registrarSerie` pisa
 *    por `orden` sin avisar.
 *  - Lo copiado (pauta, semana pasada) se marca como copiado.
 *  - Lo estimado se marca editable; lo descartado se muestra, no se esconde.
 *  - Un ejercicio de otra sesión avisa que se sellará la fecha de esa sesión.
 */
import { etiquetaDeFecha } from './fecha.ts'
import type {
  Confianza, Propuesta, RegistroCheckin, RegistroComida, RegistroHidratacion, RegistroPropuesto, RegistroSesionCampo,
  RegistroSeries, SerieDictada,
} from './tipos.ts'

export interface LineaTarjeta {
  /** Identificador estable del registro: `mensaje_id:i`. Evita el doble toque. */
  tarjeta_id: string
  texto: string
  detalle?: string
  editable: boolean
  confianza?: Confianza
  origen?: string
}

export interface BotonTarjeta {
  id: 'guardar' | 'descartar' | 'opcion' | 'otro' | 'abrir_formulario'
  texto: string
  valor?: string
  primario?: boolean
  /** Guardar exige que la persona confirme la sesión (fecha sellada). */
  confirma_sesion?: boolean
}

export interface Tarjeta {
  tipo: 'confirmacion' | 'pregunta' | 'derivacion' | 'informativa'
  titulo: string
  lineas: LineaTarjeta[]
  avisos: string[]
  /** Lo que se oyó y NO se guarda, con el motivo. */
  descartado: string[]
  botones: BotonTarjeta[]
  pregunta?: { texto: string; opciones: string[] }
  /** Lo que Praxis responde en texto (derivación, consulta...). */
  mensaje?: string
  /** Una duda que no bloquea. */
  seguimiento?: { texto: string; opciones: string[] }
  requiereConfirmarSesion: boolean
  guardable: boolean
}

/** 61.2 → «61,2»; 40 → «40». */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

export function idDeTarjeta(mensajeId: string, i: number): string {
  return `${mensajeId}:${i}`
}

function cargaTexto(r: RegistroSeries, s: SerieDictada): string {
  if (r.unidad === 'corporal') {
    return s.cargaKg > 0 ? `peso corporal +${fmt(s.cargaKg)} kg de lastre` : 'peso corporal'
  }
  if (r.unidad === 'banda') return r.detalle ? `con ${r.detalle}` : 'con banda'
  const sufijo = r.unidad === 'por_mano' ? ' por mano' : r.unidad === 'por_lado' ? ' por lado' : ''
  return `${fmt(s.cargaKg)} kg${sufijo}`
}

function lineasDeSeries(r: RegistroSeries, base: string): LineaTarjeta[] {
  const origen =
    r.origen === 'copiado_de_pauta' ? 'copiado de tu pauta'
    : r.origen === 'copiado_de_semana_anterior' ? 'copiado de la semana pasada'
    : r.origen === 'copiado_de_serie_anterior' ? 'igual que la serie anterior'
    : undefined
  return r.valor.map((s, i) => {
    const partes = [`${r.ejercicio_nombre} · serie ${s.orden} · ${cargaTexto(r, s)}${s.reps !== undefined ? ` × ${s.reps}` : ''}`]
    if (s.rir !== undefined) partes.push(`RIR ${s.rir}`)
    let texto = partes.join(' · ')
    if (s.extra?.length) texto += ` + ${s.extra.map((x) => `${x.reps} × ${fmt(x.cargaKg)} kg`).join(' + ')} (extra, no cuenta como serie)`
    const detalles: string[] = []
    if (i === 0 && r.desglose) detalles.push(r.desglose)
    if (i === 0 && r.detalle && r.unidad === 'corporal') detalles.push(r.detalle)
    if (r.reemplaza && r.reemplaza.orden === s.orden) {
      const a = r.reemplaza.antes
      detalles.push(
        `Reemplaza la serie ${s.orden}: ${fmt(a.cargaKg)}${a.reps !== undefined ? ` × ${a.reps}` : ''} → ${fmt(s.cargaKg)}${s.reps !== undefined ? ` × ${s.reps}` : ''}`,
      )
    }
    if (r.confianza === 'baja') detalles.push('Estimado: revísalo antes de guardar')
    return {
      tarjeta_id: base,
      texto,
      detalle: detalles.length ? detalles.join(' · ') : undefined,
      editable: true,
      confianza: r.confianza,
      origen,
    }
  })
}

const ETIQUETA_CHECKIN: Record<string, string> = {
  horasSueno: 'Horas de sueño', calidadSueno: 'Calidad del sueño', horaAcostarse: 'Hora de acostarse',
  horaLevantarse: 'Hora de levantarse', pasos: 'Pasos', cansancio: 'Cansancio', estres: 'Estrés', animo: 'Ánimo',
  motivacion: 'Ganas de entrenar', hambreEscala: 'Hambre (1-10)', rendimiento: 'Rendimiento', alimentacion: 'Alimentación',
}

function lineasDeCheckin(r: RegistroCheckin, base: string): LineaTarjeta[] {
  return Object.entries(r.parche).map(([campo, valor]) => {
    const antes = r.antes?.[campo]
    const etiqueta = ETIQUETA_CHECKIN[campo] ?? campo
    return {
      tarjeta_id: base,
      texto: `${etiqueta}: ${typeof valor === 'number' ? fmt(valor) : valor}`,
      detalle: antes !== undefined && antes !== null
        ? `antes ${antes}, ahora ${valor}`
        : r.diferido ? 'Se lo dijiste a Praxis hoy; queda para tu check-in de mañana' : undefined,
      editable: true,
      confianza: r.confianza_por_campo[campo],
    }
  })
}

function lineasDeComida(r: RegistroComida, base: string): LineaTarjeta[] {
  const l: LineaTarjeta[] = r.items.map((it) => ({
    tarjeta_id: base,
    texto: it.gramos !== null
      ? `${it.alimento}: ${it.medida_cantidad !== null && it.medida_nombre ? `${fmt(it.medida_cantidad)} ${it.medida_nombre} ≈ ` : ''}${fmt(it.gramos)} g`
      : `${it.alimento}: sin cantidad`,
    detalle: [it.fuente_medida ? `Fuente: ${it.fuente_medida}` : null, it.nota].filter(Boolean).join(' · ') || undefined,
    editable: true,
    confianza: it.confianza,
  }))
  if (r.aceite_g !== undefined) l.push({ tarjeta_id: base, texto: r.aceite_g === null ? 'Aceite: sin cantidad' : `Aceite: ${fmt(r.aceite_g)} g`, editable: true })
  if (r.sal_g !== undefined) l.push({ tarjeta_id: base, texto: r.sal_g === null ? 'Sal: sin cantidad' : `Sal: ${fmt(r.sal_g)} g`, editable: true })
  return l
}

function lineasDeRegistro(r: RegistroPropuesto, base: string): LineaTarjeta[] {
  switch (r.campo) {
    case 'series':
      return lineasDeSeries(r, base)
    case 'testPost.rpeSesion':
      return [{ tarjeta_id: base, texto: `Esfuerzo de la sesión: ${r.valor} (escala 6-10)`, editable: true, confianza: r.confianza }]
    case 'testPost.duracionMin':
      return [{ tarjeta_id: base, texto: `Duración de la sesión: ${r.valor} min`, detalle: 'Dicha por ti (sin cronómetro)', editable: true, confianza: r.confianza }]
    case 'adherencia':
      return [{
        tarjeta_id: base,
        texto: `Seguiste el plan: ${r.estado === 'si' ? 'sí' : r.estado === 'parcial' ? 'en parte' : 'no'}`,
        editable: true,
        confianza: r.confianza,
      }]
    case 'checkin':
      return lineasDeCheckin(r, base)
    case 'hidratacion':
      return [{ tarjeta_id: base, texto: `Agua: +${fmt(r.delta_ml)} mL`, detalle: (r as RegistroHidratacion).detalle, editable: true, confianza: r.confianza }]
    case 'comida':
      return lineasDeComida(r, base)
    default:
      if (r.campo.startsWith('bloquesCardio[') && 'bloque_nombre' in r) {
        return [{ tarjeta_id: base, texto: `${r.bloque_nombre}: ${r.valor} min`, detalle: 'Cardio hecho', editable: true, confianza: r.confianza }]
      }
      if (r.campo.startsWith('preparacion[') && 'parte_nombre' in r) {
        return [{ tarjeta_id: base, texto: `${r.parte_nombre}: hecha`, detalle: 'Se marca como hecha ahora', editable: false, confianza: r.confianza }]
      }
      return []
  }
}

function tituloDe(r: RegistroPropuesto): string {
  switch (r.campo) {
    case 'series': return r.ejercicio_nombre
    case 'comida': return `Comida (${r.comida})`
    default: return ''
  }
}

const BOTON_DESCARTAR: BotonTarjeta = { id: 'descartar', texto: 'Descartar' }

export function construirTarjeta(p: Propuesta, mensajeId = 'm'): Tarjeta {
  const avisos = [...(p.aviso ? [p.aviso] : [])]
  const descartado = p.descartado.map((d) => `${d.cita}: ${d.motivo}`)

  if (p.accion === 'derivar') {
    return {
      tipo: 'derivacion',
      titulo: 'Se lo paso a Bryan',
      lineas: [],
      avisos,
      descartado,
      mensaje: p.respuesta,
      botones: p.filtro === 'crisis' || p.filtro === 'conducta_alimentaria' || p.filtro === 'animo'
        ? []
        : [{ id: 'abrir_formulario', texto: 'Anótalo en el formulario' }],
      requiereConfirmarSesion: false,
      guardable: false,
    }
  }

  if (p.accion === 'preguntar' && p.pregunta) {
    return {
      tipo: 'pregunta',
      titulo: 'Una pregunta',
      lineas: [],
      avisos,
      descartado,
      pregunta: { texto: p.pregunta.texto, opciones: p.pregunta.opciones },
      botones: [
        ...p.pregunta.opciones.slice(0, 3).map((o): BotonTarjeta => ({ id: 'opcion', texto: o, valor: o })),
        ...(p.pregunta.opciones.length > 0 ? [{ id: 'otro', texto: 'Otro' } as BotonTarjeta] : []),
        BOTON_DESCARTAR,
      ],
      requiereConfirmarSesion: false,
      guardable: false,
    }
  }

  if (p.accion === 'nada') {
    return {
      tipo: 'informativa',
      titulo: 'Nada que guardar',
      lineas: [],
      avisos,
      descartado,
      mensaje: p.respuesta,
      botones: [],
      requiereConfirmarSesion: false,
      guardable: false,
    }
  }

  // tarjeta de confirmación
  const lineas: LineaTarjeta[] = []
  p.registros.forEach((r, i) => lineas.push(...lineasDeRegistro(r, idDeTarjeta(mensajeId, i))))
  if (p.fecha_real) avisos.push(`Fecha del registro: ${etiquetaDeFecha(p.fecha_real)}`)
  for (const r of p.registros) {
    if (r.campo === 'series') {
      avisos.push(...r.avisos)
      if (r.quedan === 0) avisos.push(`${r.ejercicio_nombre} queda completo`)
      else if (r.quedan !== undefined) avisos.push(`Queda${r.quedan === 1 ? '' : 'n'} ${r.quedan} serie${r.quedan === 1 ? '' : 's'} de ${r.ejercicio_nombre}`)
    }
  }
  const titulos = [...new Set(p.registros.map(tituloDe).filter(Boolean))]
  const confirma = p.requiere_confirmacion_de_sesion === true
  return {
    tipo: 'confirmacion',
    titulo: titulos.length ? titulos.join(' + ') : 'Esto entendí',
    lineas,
    avisos: [...new Set(avisos)],
    descartado,
    seguimiento: p.seguimiento ? { texto: p.seguimiento.texto, opciones: p.seguimiento.opciones } : undefined,
    botones: [
      { id: 'guardar', texto: confirma ? 'Sí, anótalo ahí' : 'Guardar', primario: true, confirma_sesion: confirma },
      BOTON_DESCARTAR,
    ],
    requiereConfirmarSesion: confirma,
    guardable: p.registros.length > 0,
  }
}

/** Tipos auxiliares que la pantalla puede necesitar. */
export type { RegistroSesionCampo }
