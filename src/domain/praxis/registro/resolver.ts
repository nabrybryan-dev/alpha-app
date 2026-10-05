/**
 * El resolutor: de la `Extraccion` del modelo (citas) + el contexto local a una
 * `Propuesta` (números, ejercicios, órdenes). PURO: sin red, sin reloj, sin
 * escritura. La propuesta se muestra en una tarjeta y solo se guarda cuando la
 * persona toca «Guardar».
 *
 * Reglas que este archivo hace cumplir (DISENO §3):
 *  - El código manda: la `ref_sugerida` del modelo nunca desempata.
 *  - Una pregunta por mensaje, con opciones de un toque; si algo decide el
 *    DESTINO o el VALOR y falta, se pregunta y no se guarda nada todavía.
 *  - Lo no dicho queda AUSENTE: sin RIR de la pauta, sin 20 kg de arranque.
 *  - Todo número de la propuesta viene de una cita, del perfil, de la pauta que
 *    la persona pidió copiar, de una serie anterior o de la tabla de medidas.
 */
import { confianzaDe, minConfianza, type SenalConfianza } from './confianza.ts'
import { resolverComida } from './comida.ts'
import { emparejarEjercicio, tokensDeNombre, type ResultadoEjercicio } from './ejercicio.ts'
import { derivarPorFiltro } from './filtroClinico.ts'
import { fechaLocal, resolverFecha } from './fecha.ts'
import { revisarCarga, revisarHorasSueno, revisarReps, revisarRpeSesion } from './limites.ts'
import { minutosDeCita, normalizarTexto, numeroDeCita, ordinalDeCita, valorDeCita } from './numeros.ts'
import { planificarOrdenes, quedanDespues, siguienteOrden } from './orden.ts'
import { resolverReserva } from './rir.ts'
import { dichoEnLibras, librasAKg, porDeCita, resolverUnidad } from './unidad.ts'
import { resolverVida } from './vida.ts'
import type {
  BloqueExtraido, Confianza, ContextoRegistro, EjercicioCtx, EjercicioExtraido, Extraccion, OrigenCopia,
  Pregunta, Propuesta, RegistroPropuesto, RegistroSeries, SerieDictada, SerieHecha, SesionCtx, UnidadSerie,
} from './tipos.ts'

export const VERSION_RESOLUTORES = 'registro-resolutores-2026-09-29.1'

const fmt = (n: number): string => String(n).replace('.', ',')

/** Lo que devuelve resolver UN ejercicio del mensaje. */
type ResEntreno =
  | { tipo: 'registro'; registro: RegistroSeries; sesion: SesionCtx | null; aviso?: string; confirmarSesion?: boolean; notasCoach: string[]; descartado?: { cita: string; motivo: string }[] }
  | { tipo: 'pregunta'; pregunta: Pregunta; borrador: Record<string, unknown> }
  | { tipo: 'nada'; descartado: { cita: string; motivo: string }[] }

const sesionDe = (ctx: ContextoRegistro, id: string): SesionCtx | null => ctx.sesiones.find((s) => s.id === id) ?? null
function ultimaSerie(series: readonly SerieHecha[]): SerieHecha | null {
  return series.length ? [...series].sort((a, b) => a.orden - b.orden)[series.length - 1] : null
}

function borradorDe(item: EjercicioExtraido): Record<string, unknown> {
  const b = item.bloques[0]
  if (!b) return {}
  const series = numeroDeCita(b.n_series)?.valor
  const reps = valorDeCita(b.reps)
  const carga = valorDeCita(b.carga.valor)
  return {
    ...(series !== undefined ? { series } : {}),
    ...(reps !== null ? { reps } : {}),
    ...(carga !== null ? { carga_dicha: carga } : {}),
  }
}

// ---------------------------------------------------------------------------
// Un ejercicio del mensaje
// ---------------------------------------------------------------------------

function resolverEjercicioDelMensaje(item: EjercicioExtraido, ctx: ContextoRegistro, frase: string): ResEntreno {
  // Ni el nombre ni una cifra («ya entrené pierna»): no hay nada que registrar ni de qué ejercicio preguntar.
  if (!item.ejercicio.cita && item.bloques.length === 0) return { tipo: 'nada', descartado: [] }
  const modoAnterior =
    !item.ejercicio.cita &&
    item.bloques.some((b) => b.carga.tipo === 'copiar_serie_anterior' || b.carga.tipo === 'relativa' || b.ordinal !== null)
  const emparejado: ResultadoEjercicio = emparejarEjercicio(item.ejercicio.cita, ctx, { modoAnterior })

  if (emparejado.tipo === 'pregunta') {
    return { tipo: 'pregunta', pregunta: emparejado.pregunta, borrador: borradorDe(item) }
  }

  const ej = emparejado.ejercicio
  let aviso: string | undefined
  let confirmarSesion = false
  let sesion: SesionCtx | null = sesionDe(ctx, ej.sesionId)
  const senalesEj: SenalConfianza[] = []
  if (emparejado.tipo === 'ok' && emparejado.confianza === 'media') senalesEj.push('ejercicio_inferido')
  if (emparejado.tipo === 'otra_sesion') {
    sesion = emparejado.sesion
    confirmarSesion = true
    aviso = `${ej.nombre} no está en la sesión de hoy${emparejado.hoy ? ` (${emparejado.hoy.nombre})` : ''}: es de ${emparejado.sesion.nombre}. Guardar allí sellaría la fecha de esa sesión con hoy (${fechaLocal(ctx.ahora)}).`
  }

  // Nombró el ejercicio pero no dio ni una cifra: nada que guardar. Se pregunta y no se copia la pauta.
  if (item.bloques.length === 0) {
    return {
      tipo: 'pregunta',
      pregunta: pregunta(`¿Con cuánto peso y cuántas repeticiones hiciste ${ej.nombre.toLowerCase()}?`, [], 'carga'),
      borrador: { ejercicio_id: ej.id },
    }
  }

  const fechaDicha = resolverFecha(item.cuando, ctx.ahora)
  const avisos: string[] = []
  const notasCoach: string[] = []
  const descartado: { cita: string; motivo: string }[] = []
  const acumuladas: SerieDictada[] = []
  const visto = (orden: number): SerieHecha | SerieDictada | undefined =>
    acumuladas.find((s) => s.orden === orden) ?? ej.series.find((s) => s.orden === orden)
  let origen: OrigenCopia | undefined
  let dicho: RegistroSeries['dicho']
  let desglose: string | undefined
  let detalle: string | undefined
  let unidadFinal: UnidadSerie = resolverUnidad(ej, 'no_dicho', 0).unidad
  const confs: Confianza[] = []
  let sigOrden = siguienteOrden(ej)

  for (const b of item.bloques) {
    if (b.es_calentamiento) {
      descartado.push({ cita: b.reps ?? b.carga.valor ?? 'calentamiento', motivo: 'calentamiento: no cuenta como serie ni volumen' })
      continue
    }
    const r = resolverBloque({ b, ej, ctx, frase, visto, sigOrden, acumuladas })
    if (r.tipo === 'pregunta') return { tipo: 'pregunta', pregunta: r.pregunta, borrador: { ejercicio_id: ej.id, ...borradorDe(item), ...r.borrador } }
    if (r.tipo === 'nada') { descartado.push(...r.descartado); continue }
    acumuladas.push(...r.series)
    sigOrden = Math.max(sigOrden, ...r.series.map((s) => s.orden + 1))
    origen = origen ?? r.origen
    dicho = dicho ?? r.dicho
    desglose = desglose ?? r.desglose
    detalle = detalle ?? r.detalle
    unidadFinal = r.unidad
    confs.push(r.confianza)
    avisos.push(...r.avisos)
    notasCoach.push(...r.notasCoach)
  }

  if (acumuladas.length === 0) return { tipo: 'nada', descartado }

  // Tope de series: nunca se crean por encima de `sets` sin preguntar (CE-045).
  const ordenes = acumuladas.map((s) => s.orden)
  const exceso = ordenes.filter((o) => o > ej.sets)
  if (exceso.length > 0) {
    const primera = acumuladas.find((s) => s.orden > ej.sets)!
    return {
      tipo: 'pregunta',
      pregunta: {
        texto: `Tu pauta de ${ej.nombre} era de ${ej.sets} series. ¿Anoto esta como la serie ${primera.orden}, extra?`,
        opciones: [`Sí, como serie ${primera.orden}`, 'No, no la anotes'],
        campo_bloqueante: 'series_de_mas',
      },
      borrador: { ejercicio_id: ej.id, orden: primera.orden, cargaKg: primera.cargaKg, reps: primera.reps },
    }
  }

  // Reenvío: mismo mensaje que la serie recién guardada (CE-046).
  if (
    acumuladas.length === 1 && !origen && ctx.ultimoTocado?.ejercicioId === ej.id && ctx.ultimoTocado.minutosAtras <= 10 &&
    !item.bloques.some((b) => b.ordinal !== null || b.carga.tipo === 'copiar_serie_anterior')
  ) {
    const previa = ultimaSerie(ej.series)
    const nueva = acumuladas[0]
    if (previa && previa.cargaKg === nueva.cargaKg && previa.reps === nueva.reps && nueva.orden === previa.orden + 1) {
      return {
        tipo: 'pregunta',
        pregunta: {
          texto: `Ya anoté ${fmt(previa.cargaKg)} kilos por ${previa.reps} en ${ej.nombre.toLowerCase()}. ¿Esta es la serie ${nueva.orden} o es la misma?`,
          opciones: [`Es la serie ${nueva.orden}`, 'Es la misma, no la repitas'],
          campo_bloqueante: 'serie_repetida',
        },
        borrador: { ejercicio_id: ej.id, orden: nueva.orden, cargaKg: nueva.cargaKg, reps: nueva.reps },
      }
    }
  }

  const reemplazadas = acumuladas.map((s) => ej.series.find((h) => h.orden === s.orden)).filter((s): s is SerieHecha => !!s)
  const primeraReemplazo = reemplazadas[0]
  const conf = minConfianza(...confs, confianzaDe(senalesEj))
  const quedan = quedanDespues(ej, acumuladas.map((s) => s.orden))
  if (fechaDicha && !fechaDicha.esHoy) avisos.push(`Fecha del registro: ${fechaDicha.etiqueta}`)

  const registro: RegistroSeries = {
    campo: 'series',
    ejercicio_id: ej.id,
    ejercicio_nombre: ej.nombre,
    sesion_id: ej.sesionId,
    valor: [...acumuladas].sort((a, b) => a.orden - b.orden),
    unidad: unidadFinal,
    confianza: conf,
    ...(origen ? { origen } : {}),
    ...(primeraReemplazo
      ? { reemplaza: { orden: primeraReemplazo.orden, antes: { cargaKg: primeraReemplazo.cargaKg, ...(primeraReemplazo.reps !== undefined ? { reps: primeraReemplazo.reps } : {}) } } }
      : {}),
    ...(dicho ? { dicho } : {}),
    ...(desglose ? { desglose } : {}),
    ...(detalle ? { detalle } : {}),
    quedan,
    avisos: [...new Set(avisos)],
  }
  return { tipo: 'registro', registro, sesion, aviso, confirmarSesion, notasCoach: [...new Set(notasCoach)], descartado }
}

// ---------------------------------------------------------------------------
// Un bloque
// ---------------------------------------------------------------------------

interface EntradaBloque {
  b: BloqueExtraido
  ej: EjercicioCtx
  ctx: ContextoRegistro
  frase: string
  visto: (orden: number) => SerieHecha | SerieDictada | undefined
  sigOrden: number
  acumuladas: SerieDictada[]
}

type ResBloque =
  | {
      tipo: 'series'
      series: SerieDictada[]
      unidad: UnidadSerie
      confianza: Confianza
      origen?: OrigenCopia
      dicho?: RegistroSeries['dicho']
      desglose?: string
      detalle?: string
      avisos: string[]
      notasCoach: string[]
    }
  | { tipo: 'pregunta'; pregunta: Pregunta; borrador: Record<string, unknown> }
  | { tipo: 'nada'; descartado: { cita: string; motivo: string }[] }

const pregunta = (texto: string, opciones: string[], campo_bloqueante: string): Pregunta => ({ texto, opciones, campo_bloqueante })

function resolverBloque(e: EntradaBloque): ResBloque {
  const { b, ej, ctx, frase, visto } = e
  const avisos: string[] = []
  const notasCoach: string[] = []
  const senales: SenalConfianza[] = []
  if (b.senales.includes('aproximado')) senales.push('aproximado')
  if (b.senales.includes('no_recuerda')) senales.push('no_recuerda')
  if (b.senales.includes('maximo_o_minimo') && b.reserva.tipo !== 'reserva_dicha') senales.push('maximo_o_minimo')

  const ord = ordinalDeCita(b.ordinal)
  // Un ordinal («la tercera») señala UNA serie: si el modelo repitió el «las tres» de la frase en cada
  // bloque ordinal, tres bloques × tres series darían nueve. El ordinal manda; la cuenta solo cuenta sin él.
  const nSeries = typeof ord === 'number' ? 1 : Math.max(1, Math.round(valorDeCita(b.n_series) ?? 1))
  const repsN = numeroDeCita(b.reps)
  const rir = resolverReserva(b.reserva, b.senales)
  if (rir.aviso) avisos.push(rir.aviso)
  if (rir.notaCoach) notasCoach.push(rir.notaCoach)
  const ultimaKg = ultimaSerie(ej.series)?.cargaKg ?? null

  // ---- Copias: la persona pidió repetir algo, no dijo números ----
  const tipo = b.carga.tipo
  if (tipo === 'copiar_pauta' || tipo === 'copiar_semana_anterior') {
    let fuente: { orden: number; cargaKg: number; reps: number }[]
    let origen: OrigenCopia
    if (tipo === 'copiar_pauta') {
      origen = 'copiado_de_pauta'
      fuente = ej.seriesPrescritas
        ? ej.seriesPrescritas.map((p) => ({ orden: p.orden, cargaKg: p.cargaKg, reps: p.reps }))
        : ej.cargaKg !== undefined && ej.repsDiana !== undefined
          ? Array.from({ length: ej.sets }, (_, i) => ({ orden: i + 1, cargaKg: ej.cargaKg as number, reps: ej.repsDiana as number }))
          : []
    } else {
      origen = 'copiado_de_semana_anterior'
      const previas = ctx.semanaAnterior[ej.id] ?? []
      fuente = previas.filter((s) => s.reps !== undefined).map((s, i) => ({ orden: i + 1, cargaKg: s.cargaKg, reps: s.reps as number }))
    }
    const hechas = new Set(ej.series.map((s) => s.orden))
    const nuevas = fuente.filter((s) => !hechas.has(s.orden))
    if (nuevas.length === 0) {
      if (fuente.length === 0) {
        return {
          tipo: 'pregunta',
          pregunta: pregunta(
            tipo === 'copiar_pauta'
              ? `No tengo una pauta con kilos para ${ej.nombre}. ¿Con cuánto peso y cuántas repeticiones fue?`
              : `No encuentro ${ej.nombre} en la semana pasada. ¿Con cuánto peso y cuántas repeticiones fue?`,
            [],
            'carga',
          ),
          borrador: {},
        }
      }
      return { tipo: 'nada', descartado: [{ cita: ej.nombre, motivo: 'ya tiene todas las series anotadas' }] }
    }
    const series = nuevas.map((s) => ({ orden: s.orden, cargaKg: s.cargaKg, reps: s.reps }))
    const unidad = resolverUnidad(ej, 'no_dicho', 0).unidad
    return { tipo: 'series', series, unidad, confianza: confianzaDe(['copiado']), origen, avisos, notasCoach }
  }

  // ---- Cuántas series y en qué orden ----
  const plan = planificarOrdenes(ej, nSeries, ord, e.sigOrden)
  const ordenes = plan.ordenes

  // ---- La carga ----
  let cargaKg: number | null = null
  let unidad: UnidadSerie = resolverUnidad(ej, 'no_dicho', 0).unidad
  let dicho: RegistroSeries['dicho']
  let desglose: string | undefined
  let detalle: string | undefined

  const pregCarga = (texto?: string): ResBloque => ({
    tipo: 'pregunta',
    pregunta: pregunta(
      texto ??
        (repsN
          ? `¿Con cuánto peso hiciste ${ej.nombre.toLowerCase()}?`
          : `¿Con cuánto peso y cuántas repeticiones hiciste ${ej.nombre.toLowerCase()}?`),
      [],
      'carga',
    ),
    borrador: {},
  })

  // En un ejercicio de peso corporal o de banda no hay kilos que copiar ni inventar: lo único que
  // cuenta es un lastre dicho con número. «Banda roja» no es una carga.
  const sinKilos = ej.unidad === 'corporal' || ej.unidad === 'banda'
  const tipoEf = sinKilos && !(tipo === 'absoluta' && numeroDeCita(b.carga.valor)) ? 'corporal' : tipo

  if (tipoEf === 'copiar_serie_anterior') {
    const previa = ultimaSerie([...ej.series, ...e.acumuladas.map((s) => ({ ...s }))])
    if (!previa) return pregCarga(`No veo una serie anterior de ${ej.nombre.toLowerCase()}. ¿Con cuánto peso y cuántas repeticiones fue?`)
    const orden = ord === null || typeof ord !== 'number' ? e.sigOrden : ord
    const serie: SerieDictada = { orden, cargaKg: previa.cargaKg, ...(previa.reps !== undefined ? { reps: previa.reps } : {}) }
    const unidadCopia = resolverUnidad(ej, 'no_dicho', 0).unidad
    return { tipo: 'series', series: [serie], unidad: unidadCopia, confianza: 'alta', origen: 'copiado_de_serie_anterior', avisos, notasCoach }
  }

  if (tipoEf === 'absoluta') {
    const n = numeroDeCita(b.carga.valor)
    if (!n) return pregCarga()
    if (n.aproximado) senales.push('aproximado')
    const libras = dichoEnLibras(b.carga.unidad_cita, b.carga.valor)
    let kg = libras ? librasAKg(n.valor) : n.valor
    if (libras) dicho = { valor: n.valor, unidad: 'libras' }
    const por = b.carga.por !== 'no_dicho' ? b.carga.por : porDeCita(b.carga.unidad_cita)
    if (ej.unidad === 'corporal') {
      // Lastre añadido al peso del cuerpo; la convención la confirma el coach.
      detalle = `+${fmt(kg)} kg de lastre`
      senales.push('aproximado')
      unidad = 'corporal'
    } else if (ej.unidad === 'banda') {
      kg = 0
      unidad = 'banda'
    } else {
      const u = resolverUnidad(ej, por, kg)
      if (u.pregunta) return { tipo: 'pregunta', pregunta: u.pregunta, borrador: { cargaKg: kg, reps: repsN?.valor } }
      unidad = u.unidad
    }
    cargaKg = kg
    if (libras) desglose = `${fmt(dicho!.valor)} lb = ${fmt(kg)} kg`
  } else if (tipoEf === 'barra_sola') {
    const barra = ctx.perfil.pesoBarraKg
    if (barra === null || barra === undefined) {
      return {
        tipo: 'pregunta',
        pregunta: pregunta('¿La barra que usaste pesa 20 kg?', ['Sí, 20 kg', 'No, pesa 15 kg', 'Otro peso'], 'peso_barra'),
        borrador: { ejercicio_id: ej.id, series: nSeries, reps: repsN?.valor },
      }
    }
    cargaKg = barra
    senales.push('del_perfil')
    desglose = `barra sola = ${fmt(barra)} kg`
  } else if (tipoEf === 'discos') {
    const barra = ctx.perfil.pesoBarraKg
    if (barra === null || barra === undefined) {
      return {
        tipo: 'pregunta',
        pregunta: pregunta('¿La barra que usaste pesa 20 kg?', ['Sí, 20 kg', 'No, pesa 15 kg', 'Otro peso'], 'peso_barra'),
        borrador: { ejercicio_id: ej.id, series: nSeries, reps: repsN?.valor },
      }
    }
    const discos = b.carga.discos ?? []
    let suma = 0
    for (const d of discos) {
      const c = valorDeCita(d.cantidad)
      const p = valorDeCita(d.peso)
      if (c === null || p === null) return pregCarga('No entendí los discos. ¿Cuántos kilos llevaba la barra en total?')
      suma += c * p
    }
    if (suma <= 0) return pregCarga('No entendí los discos. ¿Cuántos kilos llevaba la barra en total?')
    const lados = b.carga.por === 'total' ? 1 : 2
    cargaKg = barra + lados * suma
    senales.push('del_perfil')
    desglose = `${fmt(barra)} + ${fmt(lados * suma)} = ${fmt(cargaKg)} kg`
  } else if (tipoEf === 'relativa') {
    const previa = visto(ordenes[0] - 1) ?? ultimaSerie(ej.series)
    const d = numeroDeCita(b.carga.delta)
    if (!previa || !d) return pregCarga(`¿Con cuánto peso hiciste la serie ${ordenes[0]}?`)
    const baja = /\b(baj|quit|menos|rest)/.test((b.carga.delta ?? '').toLowerCase())
    cargaKg = Math.round((previa.cargaKg + (baja ? -d.valor : d.valor)) * 10) / 10
    desglose = `${fmt(previa.cargaKg)} ${baja ? '−' : '+'} ${fmt(d.valor)} = ${fmt(cargaKg)} kg`
  } else if (tipoEf === 'corporal') {
    cargaKg = 0
    unidad = ej.unidad === 'banda' ? 'banda' : 'corporal'
  } else {
    // no_dicha
    if (ej.unidad === 'corporal' || ej.unidad === 'banda') {
      cargaKg = 0
      unidad = ej.unidad
    } else {
      return pregCarga()
    }
  }

  // Banda: se ve cuál era, no se convierte a kilos.
  if (ej.unidad === 'banda') {
    const m = frase.toLowerCase().match(/banda\s+(\w+)/)
    if (m) detalle = `banda ${m[1]}`
    cargaKg = 0
    unidad = 'banda'
    senales.push('aproximado')
  }
  if (ej.unidad === 'corporal' && cargaKg === 0) unidad = 'corporal'

  // ---- Reps ----
  if (!repsN) {
    return {
      tipo: 'pregunta',
      pregunta: pregunta(`¿Cuántas repeticiones hiciste en ${ej.nombre.toLowerCase()}?`, [], 'reps'),
      borrador: { ejercicio_id: ej.id, cargaKg },
    }
  }
  if (repsN.aproximado) senales.push('aproximado')
  const reps = repsN.valor
  const verReps = revisarReps(reps, ej.rango)
  if (verReps.tipo === 'imposible') {
    return { tipo: 'pregunta', pregunta: pregunta(`Esas repeticiones no me cuadran, ¿cuántas fueron?`, [], 'reps'), borrador: { ejercicio_id: ej.id, cargaKg } }
  }
  if (verReps.tipo === 'aviso') avisos.push(`Repeticiones ${verReps.aviso}`)
  const verCarga = revisarCarga(cargaKg ?? 0, ultimaKg)
  if (verCarga.tipo === 'imposible') {
    return {
      tipo: 'pregunta',
      pregunta: pregunta('Esos kilos no parecen posibles, ¿con cuánto peso fue?', [], 'carga'),
      borrador: { ejercicio_id: ej.id, reps },
    }
  }
  if (verCarga.tipo === 'aviso') avisos.push(verCarga.aviso)

  // ---- Extras (drop set, rest-pause) ----
  const extras: { reps: number; cargaKg: number }[] = []
  for (const x of b.extra) {
    const r = valorDeCita(x.reps)
    if (r === null) continue
    const c = x.carga ? valorDeCita(x.carga) : cargaKg
    if (c === null) continue
    extras.push({ reps: r, cargaKg: dichoEnLibras(x.carga) ? librasAKg(c) : c })
  }

  const series: SerieDictada[] = ordenes.map((orden, i) => ({
    orden,
    cargaKg: cargaKg ?? 0,
    reps,
    ...(rir.rir !== undefined ? { rir: rir.rir } : {}),
    ...(extras.length && i === ordenes.length - 1 ? { extra: extras } : {}),
  }))
  // La confianza del registro es la mínima entre la carga/reps y el RIR dicho.
  const confianza = minConfianza(confianzaDe(senales), rir.rir !== undefined ? rir.confianza : undefined)
  return {
    tipo: 'series',
    series,
    unidad,
    confianza,
    dicho,
    desglose,
    detalle,
    avisos,
    notasCoach,
  }
}

// ---------------------------------------------------------------------------
// Correcciones habladas («no, eran 45», «la segunda fue con 12»)
// ---------------------------------------------------------------------------

function resolverCorreccion(ext: Extraccion, ctx: ContextoRegistro, frase: string): ResEntreno | null {
  const c = ext.correccion
  if (!c || (c.objetivo !== 'ultimo_registro' && c.objetivo !== 'serie_ordinal')) return null
  const nuevo = numeroDeCita(c.nuevo_valor)
  if (!nuevo) return null
  const cita = ext.entreno[0]?.ejercicio.cita ?? null
  const emp = emparejarEjercicio(cita, ctx, { modoAnterior: true })
  if (emp.tipo !== 'ok') return emp.tipo === 'pregunta' ? { tipo: 'pregunta', pregunta: emp.pregunta, borrador: {} } : null
  const ej = emp.ejercicio
  const ord = ordinalDeCita(c.ordinal)
  const objetivo = typeof ord === 'number' ? ej.series.find((s) => s.orden === ord) : ultimaSerie(ej.series)
  if (!objetivo) {
    return { tipo: 'pregunta', pregunta: pregunta('¿Cuál serie quieres corregir?', [], 'serie'), borrador: { ejercicio_id: ej.id } }
  }
  const campoTxt = `${c.campo ?? ''}`.toLowerCase()
  const f = frase.toLowerCase()
  const campo = /carga|peso|kilo|kg/.test(campoTxt) ? 'carga'
    : /rep/.test(campoTxt) ? 'reps'
    : /rir|reserva/.test(campoTxt) ? 'rir'
    : /\breps?\b|repeticion/.test(f) ? 'reps'
    : /kilo|\bkg\b|libra/.test(f) ? 'carga'
    : null
  if (!campo) {
    return { tipo: 'pregunta', pregunta: pregunta('¿Corriges los kilos o las repeticiones?', ['Los kilos', 'Las repeticiones'], 'campo'), borrador: { ejercicio_id: ej.id, orden: objetivo.orden } }
  }
  const serie: SerieDictada = { orden: objetivo.orden, cargaKg: objetivo.cargaKg, ...(objetivo.reps !== undefined ? { reps: objetivo.reps } : {}), ...(objetivo.rir !== undefined ? { rir: objetivo.rir } : {}) }
  if (campo === 'carga') serie.cargaKg = dichoEnLibras(c.nuevo_valor) ? librasAKg(nuevo.valor) : nuevo.valor
  else if (campo === 'reps') serie.reps = nuevo.valor
  else serie.rir = Math.min(5, nuevo.valor)
  const registro: RegistroSeries = {
    campo: 'series',
    ejercicio_id: ej.id,
    ejercicio_nombre: ej.nombre,
    sesion_id: ej.sesionId,
    valor: [serie],
    unidad: resolverUnidad(ej, 'no_dicho', 0).unidad,
    confianza: 'alta',
    reemplaza: { orden: objetivo.orden, antes: { cargaKg: objetivo.cargaKg, ...(objetivo.reps !== undefined ? { reps: objetivo.reps } : {}) } },
    avisos: [],
    quedan: quedanDespues(ej, [serie.orden]),
  }
  return { tipo: 'registro', registro, sesion: sesionDe(ctx, ej.sesionId), notasCoach: [] }
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

const vacia = (citas: string[]): Propuesta => ({ accion: 'nada', registros: [], descartado: [], notas_coach: [], citas_invalidas: citas })

export function resolverPropuesta(frase: string, ext: Extraccion, ctx: ContextoRegistro, citasInvalidas: string[] = []): Propuesta {
  // Segunda red clínica: si el modelo vio algo, se descarta todo.
  if (ext.clinico.hay) {
    const p = derivarPorFiltro({ filtro: 'sintoma', marca: ext.clinico.cita ?? 'clinico' })
    p.notas_coach.push('Falso negativo del filtro de palabras: ampliar la lista')
    p.citas_invalidas = citasInvalidas
    return p
  }

  const corSueno =
    ext.correccion !== null && ext.entreno.length === 0 &&
    (ext.correccion.objetivo === 'sueno' || /sue|hora/.test(normalizarTexto(ext.correccion.campo ?? '')))
  const tocaEntreno = ext.entreno.length > 0 || !!ext.sesion || (!!ext.correccion && !corSueno)

  // El bloque venció: nada cae en él ni en el nuevo (CE-051).
  if (tocaEntreno && ctx.microciclo?.vencido) {
    return {
      ...vacia(citasInvalidas),
      motivo: 'microciclo_vencido',
      respuesta: 'Tu bloque de entrenamiento ya venció y el nuevo está pendiente de aprobación. No lo anoto en el bloque viejo; le aviso a Bryan y lo dejo guardado para cuando esté listo.',
      borrador_pendiente: { texto: frase },
      notas_coach: ['Mensaje de entreno sobre un microciclo vencido: guardado sin escribir'],
    }
  }

  if (ext.intencion.includes('deshacer')) {
    return {
      ...vacia(citasInvalidas),
      motivo: 'no_soportado',
      respuesta: 'Borrar una serie no lo puedo hacer desde aquí. Si me dices el valor correcto de esa serie, la corrijo con tu confirmación; o quítala en la pantalla de la sesión.',
    }
  }

  const registros: RegistroPropuesto[] = []
  const descartado: Propuesta['descartado'] = []
  const notas: string[] = []
  const avisos: string[] = []
  let sesionId: string | undefined
  let aviso: string | undefined
  let confirmarSesion = false
  let seguimiento: Pregunta | undefined
  let fechaReal: string | undefined

  // ---- Corrección de las horas de sueño: «no dormí 5 sino 6» ----
  if (corSueno && ext.correccion) {
    const n = numeroDeCita(ext.correccion.nuevo_valor)
    if (n) {
      const ver = revisarHorasSueno(n.valor)
      if (ver.tipo === 'imposible') {
        return {
          accion: 'preguntar', registros: [], descartado, notas_coach: notas, citas_invalidas: citasInvalidas,
          pregunta: pregunta('Ese número no me cuadra. ¿Cuántas horas fueron?', [], 'horasSueno'),
        }
      }
      const previo = ctx.checkinHoy?.horasSueno
      registros.push({
        campo: 'checkin', fecha: fechaLocal(ctx.ahora), parche: { horasSueno: n.valor }, confianza_por_campo: { horasSueno: 'alta' },
        ...(typeof previo === 'number' ? { antes: { horasSueno: previo } } : {}),
      })
    }
  }

  // ---- Entreno ----
  const correccion = ext.entreno.length === 0 && !corSueno ? resolverCorreccion(ext, ctx, frase) : null
  const resultados: ResEntreno[] = correccion ? [correccion] : ext.entreno.map((it) => resolverEjercicioDelMensaje(it, ctx, frase))
  for (const [i, r] of resultados.entries()) {
    if (r.tipo === 'pregunta') {
      return {
        accion: 'preguntar',
        sesion_id: ctx.sesionHoyId ?? undefined,
        registros: [],
        pregunta: r.pregunta,
        borrador_pendiente: r.borrador,
        descartado,
        notas_coach: notas,
        citas_invalidas: citasInvalidas,
      }
    }
    if (r.tipo === 'nada') { descartado.push(...r.descartado); continue }
    registros.push(r.registro)
    descartado.push(...(r.descartado ?? []))
    sesionId = sesionId ?? r.registro.sesion_id
    if (r.aviso) aviso = r.aviso
    if (r.confirmarSesion) confirmarSesion = true
    notas.push(...r.notasCoach)
    if (r.registro.avisos.some((a) => a.startsWith('Repeticiones'))) notas.push(`Repeticiones fuera de rango en ${r.registro.ejercicio_nombre}`)
    const f = resolverFecha(ext.entreno[i]?.cuando ?? null, ctx.ahora)
    if (f && !f.esHoy) fechaReal = f.fecha
  }

  // ---- Sesión entera: esfuerzo, duración, lo que no hizo ----
  if (ext.sesion) {
    const s = ext.sesion
    const sid = ctx.sesionHoyId ?? ctx.sesiones[0]?.id
    if (sid && s.rpe) {
      const v = valorDeCita(s.rpe)
      if (v !== null) {
        const ver = revisarRpeSesion(v)
        if (ver.tipo === 'imposible') {
          const opciones = v < 1 ? ['1', '2'] : ['9', '10']
          return {
            accion: 'preguntar', sesion_id: sid, registros: [], descartado, notas_coach: notas, citas_invalidas: citasInvalidas,
            pregunta: pregunta('La escala de la app va de 1 a 10. ¿Cuál se acerca más a lo que sentiste?', opciones, 'rpeSesion'),
            borrador_pendiente: { rpe_dicho: v },
          }
        }
        registros.push({ campo: 'testPost.rpeSesion', sesion_id: sid, valor: v, unidad: 'rpe', confianza: 'alta' })
        sesionId = sesionId ?? sid
      }
    }
    if (sid && s.duracion) {
      const m = minutosDeCita(s.duracion)
      if (m !== null && ctx.cronometroMin == null) {
        registros.push({ campo: 'testPost.duracionMin', sesion_id: sid, valor: m, unidad: 'min', confianza: 'media', fuente: 'dicho' })
        sesionId = sesionId ?? sid
      } else if (m !== null) {
        descartado.push({ cita: s.duracion, motivo: `ya hay cronómetro local (${ctx.cronometroMin} min): no se pisa` })
      }
    }
    if (sid && s.cardio) {
      const m = minutosDeCita(s.cardio)
      const sesionCtx = sesionDe(ctx, sid)
      const bloques = sesionCtx?.bloquesCardio ?? []
      if (m !== null && bloques.length > 0) {
        const norm = normalizarTexto(frase)
        const porNombre = bloques.filter((b) => tokensDeNombre(b.nombre).some((t) => t.length > 3 && norm.includes(t.slice(0, 6).toLowerCase())))
        const elegido = bloques.length === 1 ? bloques[0] : porNombre.length === 1 ? porNombre[0] : null
        if (elegido) {
          registros.push({
            campo: `bloquesCardio[${elegido.id}].duracionRealMin`, sesion_id: sid, bloque_id: elegido.id,
            bloque_nombre: elegido.nombre, valor: m, unidad: 'min', confianza: 'alta',
          })
          sesionId = sesionId ?? sid
          notas.push('Cardio: hoy registrarEjecucionCardio no sincroniza con la nube (P7); no prometer que el coach lo ve')
        } else {
          return {
            accion: 'preguntar', sesion_id: sid, registros: [], descartado, notas_coach: notas, citas_invalidas: citasInvalidas,
            pregunta: pregunta('¿Cuál bloque de cardio fue?', bloques.slice(0, 3).map((b) => b.nombre), 'bloque_cardio'),
          }
        }
      } else if (m !== null) {
        descartado.push({ cita: s.cardio, motivo: 'no hay un bloque de cardio en la sesión' })
      }
    }
    if (sid && s.preparacion.length > 0) {
      const partes = sesionDe(ctx, sid)?.preparacion ?? []
      for (const cita of s.preparacion) {
        const toks = tokensDeNombre(cita)
        const hit = partes.filter((pt) => toks.length > 0 && toks.every((t) => tokensDeNombre(pt.nombre).some((n) => n.startsWith(t.slice(0, 5)))))
        if (hit.length !== 1) {
          descartado.push({ cita, motivo: hit.length === 0 ? 'no encuentro esa parte de la preparación' : 'encaja con más de una parte' })
          continue
        }
        if (hit[0].hecha) {
          descartado.push({ cita, motivo: 'ya estaba marcada (la marca alterna: no se vuelve a enviar)' })
          continue
        }
        registros.push({
          campo: `preparacion[${hit[0].id}].hechoEn`, sesion_id: sid, parte_id: hit[0].id, parte_nombre: hit[0].nombre,
          valor: ctx.ahora, unidad: 'iso', confianza: 'alta',
        })
        sesionId = sesionId ?? sid
      }
    }
    if (s.omitidos.length > 0) {
      const ids: string[] = []
      for (const cita of s.omitidos) {
        const emp = emparejarEjercicio(cita, ctx)
        if (emp.tipo === 'ok') ids.push(emp.ejercicio.id)
      }
      if (ids.length) notas.push(`Ejercicios omitidos: ${ids.join(', ')}`)
      if (registros.length === 0) {
        return {
          ...vacia(citasInvalidas),
          motivo: 'omitidos',
          sesion_id: ctx.sesionHoyId ?? undefined,
          respuesta: 'Listo, no los marco y le aviso a Bryan que faltaron.',
          notas_coach: notas,
          descartado,
        }
      }
    }
  }

  // ---- Vida ----
  if (ext.vida) {
    const v = resolverVida(ext.vida, ctx, frase, { hizoEntreno: ext.entreno.length > 0 })
    if (v.pregunta) {
      return { accion: 'preguntar', registros: [], pregunta: v.pregunta, descartado, notas_coach: notas, citas_invalidas: citasInvalidas }
    }
    registros.push(...v.registros)
    descartado.push(...v.descartado)
    avisos.push(...v.avisos)
    seguimiento = seguimiento ?? v.seguimiento
  }

  // ---- Comida ----
  if (ext.comida) {
    const c = resolverComida(ext.comida, ctx)
    if (c.registro) registros.push(c.registro)
    if (c.adherencia) registros.push(c.adherencia)
    descartado.push(...c.descartado)
    avisos.push(...c.avisos)
    seguimiento = seguimiento ?? c.seguimiento
  }

  // Sin nada que guardar pero con una duda: se pregunta (botella sin tamaño, hambre sin número...).
  if (registros.length === 0 && seguimiento) {
    return { accion: 'preguntar', registros: [], pregunta: seguimiento, descartado, notas_coach: notas, citas_invalidas: citasInvalidas }
  }

  // ---- Consultas y charla: no son registro ----
  if (registros.length === 0 && descartado.length === 0) {
    if (ext.intencion.includes('consulta') || ext.fuera_de_alcance) {
      return {
        ...vacia(citasInvalidas),
        motivo: 'consulta',
        respuesta: 'Eso lo decide Bryan con tus números. Le paso la pregunta.',
        notas_coach: [...notas, 'Consulta de programación, nutrición o suplementos: va al canal de dudas del coach'],
      }
    }
    if (ext.intencion.includes('charla')) {
      return { ...vacia(citasInvalidas), motivo: 'charla', respuesta: 'De eso no hablo; estoy para tu entreno, tu comida y tu día a día.' }
    }
    return { ...vacia(citasInvalidas), motivo: 'sin_datos', notas_coach: notas }
  }

  // La comida se registra SIEMPRE (R2): un hueco de cantidad no la bloquea. Solo se pregunta
  // primero cuando no se sabe QUÉ era (un alimento suelto y ambiguo: «un pan»).
  const unSoloAlimentoAmbiguo =
    registros.length > 0 &&
    registros.every(
      (r) =>
        r.campo === 'comida' && r.items.every((i) => i.gramos === null) && r.aceite_g == null && r.sal_g == null &&
        (seguimiento?.campo_bloqueante === 'alimento_compuesto' || (seguimiento?.campo_bloqueante === 'alimento' && r.items.length === 1)),
    )
  if (unSoloAlimentoAmbiguo && seguimiento) {
    return {
      accion: 'preguntar', registros: [], pregunta: seguimiento, borrador_pendiente: { comida: registros },
      descartado, notas_coach: notas, citas_invalidas: citasInvalidas,
    }
  }
  return {
    accion: registros.length > 0 ? 'tarjeta' : 'nada',
    sesion_id: sesionId,
    ...(fechaReal ? { fecha_real: fechaReal } : {}),
    registros,
    descartado,
    notas_coach: notas,
    ...(aviso ? { aviso } : {}),
    ...(confirmarSesion ? { requiere_confirmacion_de_sesion: true } : {}),
    ...(seguimiento ? { seguimiento } : {}),
    ...(avisos.length ? { aviso: [aviso, ...avisos].filter(Boolean).join(' · ') } : {}),
    citas_invalidas: citasInvalidas,
  }
}
