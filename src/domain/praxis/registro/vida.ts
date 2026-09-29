/**
 * Vida diaria: sueño, pasos, agua y escalas del check-in.
 *
 * Reglas propias (DISENO §3.3):
 *  - «Bastante» no es un número: `caminé bastante` NO se convierte en minutos ni
 *    en pasos. Queda descartado, visible, y se ofrece el campo.
 *  - Las escalas P/R/M salen de una TABLA CERRADA de palabras. Lo que no está en
 *    la tabla no se mapea: queda en `descartado`.
 *  - Ánimo ≠ ganas de entrenar. «Sin ganas de entrenar» va a `motivacion` solo si
 *    la frase dice entrenar o gym; jamás alimenta el ánimo.
 *  - Lo no dicho queda ausente: sin el 7 por defecto del formulario.
 *  - El dolor NUNCA se escribe por esta vía (lo maneja el filtro clínico), con UNA
 *    excepción: la ausencia explícita («no me duele nada») es un cero medido, no un silencio.
 *  - Peso, entreno del día y tiempos sueltos (caminata, siesta, pantalla) van al check-in
 *    (`pesoKg`, `entreno`, `comentarios`) como CITA: nunca se convierten en pasos ni en otra cosa.
 */
import { horaDeCita, minutosDeCita, normalizarTexto, numeroDeCita, redondear1 } from './numeros.ts'
import { etiquetaDeFecha, fechaLocal, horaLocal, sumarDias } from './fecha.ts'
import { revisarAguaDeltaMl, revisarHorasSueno, revisarPasos, revisarPesoCorporal } from './limites.ts'
import { VASO_ML } from './medidas.ts'
import type {
  CampoEscala, Confianza, ContextoRegistro, Pregunta, RegistroCheckin, RegistroHidratacion, VidaExtraida,
} from './tipos.ts'

type Valor3 = 'POCO' | 'REGULAR' | 'MUCHO'
type Calidad3 = 'MALA' | 'REGULAR' | 'BUENA'

const CANSANCIO: [RegExp, Valor3][] = [
  [/\b(muert[oa]|agotad|destruid|reventad|cansadisim|hecho polvo|sin energia|rendid)/, 'MUCHO'],
  [/\bsueno terrible\b/, 'MUCHO'],
  [/\b(muchisima energia|con mucha energia|mucha energia|descansad|lleno de energia)/, 'POCO'],
  [/\b(mas o menos de energia|regular de energia|maso menos)/, 'REGULAR'],
]
const ESTRES: [RegExp, Valor3][] = [
  [/\b(estresadisim|estresad|agobiad|estres alto|mucho estres)/, 'MUCHO'],
  [/\b(cero estres|sin estres|tranquil|relajad)/, 'POCO'],
]
const ANIMO: [RegExp, Valor3][] = [
  [/\b(buen animo|contentisim|contento|contenta|feliz|animad|alegre|de diez)/, 'MUCHO'],
  [/\b(bajon|triste|desanimad|bajoneada|bajoneado)/, 'POCO'],
  [/\b(animo estoy bien|animo normal|estoy bien)/, 'REGULAR'],
]
const RENDIMIENTO: [RegExp, Calidad3][] = [
  [/\b(fuerte|super|excelente|muy bien|me fue bien|a full|volando)/, 'BUENA'],
  [/\b(mal|fatal|pesimo|flojo|sin fuerza)/, 'MALA'],
  [/\b(regular|normal|mas o menos)/, 'REGULAR'],
]
const ALIMENTACION: [RegExp, Calidad3][] = [
  [/\b(comi bien|comida bien|bien)/, 'BUENA'],
  [/\b(comi mal|comida mal|mal|me pase)/, 'MALA'],
  [/\b(regular|mas o menos)/, 'REGULAR'],
]

function buscar<T>(tabla: [RegExp, T][], n: string): T | null {
  for (const [re, v] of tabla) if (re.test(n)) return v
  return null
}

/** Calidad del sueño. La negación de «mal» ("no dormí mal") NO es BUENA: es REGULAR. */
export function calidadDeSueno(cita: string): Calidad3 | null {
  const n = normalizarTexto(cita)
  if (/\bno (dormi|he dormido|estuvo)[^,]{0,12}\bmal\b/.test(n)) return 'REGULAR'
  if (/\b(fatal|mal|pesimo|horrible|terrible|pesado|no pude dormir|insomnio)/.test(n)) return 'MALA'
  if (/\b(de corrido|rico|profundo|excelente|genial|muy bien|bien)\b/.test(n)) return 'BUENA'
  if (/\b(normal|regular|mas o menos|maso menos)\b/.test(n)) return 'REGULAR'
  return null
}

/** Ganas de entrenar → motivación, solo si habla de entrenar. */
function ganasDeEntrenar(cita: string): Valor3 | null {
  const n = normalizarTexto(cita)
  if (!/\b(entrenar|entreno|gym|gimnasio|rutina)\b/.test(n)) return null
  if (/\b(no tengo|sin|cero|pocas|nada de)\b.*\bganas\b|\bganas\b.*\bno\b/.test(n)) return 'POCO'
  if (/\b(muchas|full|tengo)\b.*\bganas\b/.test(n)) return 'MUCHO'
  return null
}

export interface ResultadoVida {
  registros: (RegistroCheckin | RegistroHidratacion)[]
  descartado: { cita: string; motivo: string }[]
  /** Pregunta que bloquea (un número imposible). */
  pregunta?: Pregunta
  /** Duda que no bloquea la tarjeta. */
  seguimiento?: Pregunta
  avisos: string[]
}

/** Ausencia explícita de dolor: tabla cerrada. Cualquier otra palabra de dolor en la frase la anula. */
const SIN_DOLOR = /\b(no me duele(n)? (nada|ni))\b|\bsin (ningun )?dolor(es)?\b|\bcero dolor\b|\bnada de dolor\b|\bno (tengo|siento) (ningun )?(dolor|molestia)s?\b/g

export function sinDolorExplicito(frase: string): boolean {
  const n = normalizarTexto(frase)
  if (!SIN_DOLOR.test(n)) return false
  SIN_DOLOR.lastIndex = 0
  // Si tras quitar la negación queda otra palabra de dolor («no me duele nada la espalda pero sí el hombro»), no es un cero.
  const resto = n.replace(SIN_DOLOR, ' ')
  SIN_DOLOR.lastIndex = 0
  return !/\b(duel\w*|dolor\w*|molest\w*|adolor\w*)\b/.test(resto) && !/\bpero\b.*\b(si|tengo)\b/.test(resto)
}

export interface OpcionesVida {
  /** La misma frase trae series o sesión: «no entrené» sería una contradicción. */
  hizoEntreno?: boolean
}

const TIEMPO_ETIQUETA = { caminata: 'Caminata', siesta: 'Siesta', pantalla: 'Pantalla' } as const

export function resolverVida(v: VidaExtraida, ctx: ContextoRegistro, frase = '', opciones: OpcionesVida = {}): ResultadoVida {
  const hoy = fechaLocal(ctx.ahora)
  const parche: Record<string, string | number> = {}
  const conf: Record<string, Confianza> = {}
  const antes: Record<string, string | number | null> = {}
  const registros: ResultadoVida['registros'] = []
  const descartado: ResultadoVida['descartado'] = []
  const avisos: string[] = []
  let seguimiento: Pregunta | undefined
  const poner = (campo: string, valor: string | number, c: Confianza) => {
    parche[campo] = valor
    conf[campo] = c
    const previo = ctx.checkinHoy?.[campo]
    if (previo !== undefined && previo !== null) antes[campo] = previo as string | number
  }

  // Sueño
  const senalAprox = v.senales.includes('aproximado')
  // «Ayer dormí nueve horas» puede ser la noche que acaba de pasar o la anterior: se pregunta.
  if (v.sueno_horas && /\bayer\b/.test(normalizarTexto(frase)) && !/\banoche\b/.test(normalizarTexto(frase))) {
    const domingo = etiquetaDeFecha(sumarDias(hoy, -1))
    return {
      registros: [], descartado, avisos,
      pregunta: { texto: `¿Fue la noche de anoche o la del ${domingo.split(' ')[0]}?`, opciones: ['La de anoche', `La del ${domingo.split(' ')[0]}`], campo_bloqueante: 'fecha_del_sueno' },
    }
  }
  if (v.sueno_horas) {
    const n = numeroDeCita(v.sueno_horas)
    if (n) {
      const ver = revisarHorasSueno(n.valor)
      if (ver.tipo === 'imposible') {
        return {
          registros: [], descartado, avisos,
          pregunta: { texto: 'Ese número no me cuadra. ¿Cuántas horas fueron?', opciones: [], campo_bloqueante: 'horasSueno' },
        }
      }
      if (ver.tipo === 'aviso') avisos.push(ver.aviso)
      poner('horasSueno', n.valor, 'media')
    }
  }
  // «Me acosté con el celular hasta la una» dice hasta cuándo estuvo despierta, no cuándo se durmió.
  if (/\bhasta\b/.test(normalizarTexto(v.hora_acostarse ?? ''))) {
    return {
      registros: [], descartado, avisos,
      pregunta: { texto: '¿A qué hora te dormiste más o menos?', opciones: [], campo_bloqueante: 'horaAcostarse' },
    }
  }
  const acostarse = horaDeCita(v.hora_acostarse, 'acostarse')
  const levantarse = horaDeCita(v.hora_levantarse, 'levantarse')
  if (acostarse) poner('horaAcostarse', acostarse, 'alta')
  if (levantarse) poner('horaLevantarse', levantarse, 'alta')
  if (acostarse && levantarse && parche.horasSueno === undefined) {
    const [ha, ma] = acostarse.split(':').map(Number)
    const [hl, ml] = levantarse.split(':').map(Number)
    let min = hl * 60 + ml - (ha * 60 + ma)
    if (min <= 0) min += 24 * 60
    poner('horasSueno', redondear1(min / 60), 'media')
  }
  if (v.calidad_sueno) {
    const q = calidadDeSueno(v.calidad_sueno)
    if (q) poner('calidadSueno', q, 'media')
    else descartado.push({ cita: v.calidad_sueno, motivo: 'no está en la tabla de palabras: dilo con un número o elige en el formulario' })
  }

  // Pasos: nunca a partir de «bastante» ni de minutos.
  let diferido = false
  if (v.pasos) {
    const n = numeroDeCita(v.pasos)
    if (n) {
      const ver = revisarPasos(n.valor)
      if (ver.tipo === 'imposible') {
        return {
          registros: [], descartado, avisos,
          pregunta: { texto: '¿Cuántos pasos marca tu celular o reloj?', opciones: [], campo_bloqueante: 'pasos' },
        }
      }
      if (ver.tipo === 'aviso') avisos.push(ver.aviso)
      poner('pasos', n.valor, n.aproximado || senalAprox ? 'media' : 'alta')
      // El formulario pide «pasos de ayer» en la fila de hoy: los de hoy, de noche, son de mañana.
      diferido = horaLocal(ctx.ahora).h >= 20
    }
  }
  if (v.actividad_sin_numero) {
    descartado.push({ cita: v.actividad_sin_numero, motivo: '«bastante» o «un rato» no se convierte en minutos ni pasos' })
    // Solo si habla de caminar se ofrece el campo de pasos; una siesta o un estiramiento no lo piden.
    if (/(camin|paso|trot|corr)/.test(normalizarTexto(v.actividad_sin_numero))) {
      seguimiento = { texto: '¿Tu celular o reloj te marca cuántos pasos llevas hoy?', opciones: [], campo_bloqueante: 'pasos' }
    }
  }

  // Escalas (tabla cerrada)
  for (const e of v.escalas) {
    const n = normalizarTexto(e.cita)
    const campo: CampoEscala = e.campo
    let valor: string | number | null = null
    let destino = ''
    if (campo === 'cansancio') { valor = buscar(CANSANCIO, n); destino = 'cansancio' }
    else if (campo === 'estres') { valor = buscar(ESTRES, n); destino = 'estres' }
    else if (campo === 'animo') { valor = buscar(ANIMO, n); destino = 'animo' }
    else if (campo === 'ganas_de_entrenar') { valor = ganasDeEntrenar(e.cita); destino = 'motivacion' }
    else if (campo === 'rendimiento') { valor = buscar(RENDIMIENTO, n); destino = 'rendimiento' }
    else if (campo === 'alimentacion') { valor = buscar(ALIMENTACION, n); destino = 'alimentacion' }
    else if (campo === 'hambre') {
      const num = numeroDeCita(e.cita)
      if (num && Number.isInteger(num.valor) && num.valor >= 1 && num.valor <= 10) { valor = num.valor; destino = 'hambreEscala' }
      else {
        seguimiento = seguimiento ?? { texto: 'En una escala de 1 a 10, ¿cuánta hambre tienes hoy?', opciones: [], campo_bloqueante: 'hambreEscala' }
      }
    }
    if (valor !== null) poner(destino, valor, 'media')
    else descartado.push({ cita: e.cita, motivo: 'no está en la tabla de palabras: no se convierte en un valor' })
  }

  // Peso corporal: solo si dijo que se pesó y una cifra; una estimación («creo que estoy como en 78») no es un pesaje.
  if (v.peso_corporal) {
    const n = numeroDeCita(v.peso_corporal)
    const nf = normalizarTexto(frase)
    if (ctx.perfil.verComposicion === false) {
      descartado.push({ cita: v.peso_corporal, motivo: 'tu plan no lleva el peso corporal en la app' })
    } else if (!n || /\bno me (pese|pesado|he pesado)\b|\bcreo\b|\bsupongo\b/.test(nf)) {
      descartado.push({ cita: v.peso_corporal, motivo: 'no fue un pesaje con cifra: no se anota' })
    } else {
      const ver = revisarPesoCorporal(n.valor)
      if (ver.tipo === 'imposible') {
        return {
          registros: [], descartado, avisos,
          pregunta: { texto: 'Ese peso no me cuadra. ¿Cuántos kilos marcó la báscula?', opciones: [], campo_bloqueante: 'pesoKg' },
        }
      }
      poner('pesoKg', redondear1(n.valor), n.aproximado ? 'media' : 'alta')
    }
  }

  // Qué pasó con el entreno de hoy: se anota lo que dijo, sin reproche y sin adivinar el porqué.
  if (v.dia_de_entreno) {
    const d = v.dia_de_entreno
    const nombre = ctx.sesiones.find((s) => s.id === ctx.sesionHoyId)?.nombre ?? null
    if (opciones.hizoEntreno && d.estado !== 'cambio') {
      descartado.push({ cita: d.motivo ?? 'no entrené', motivo: 'la misma frase trae series: no se anota que no entrenó' })
    } else if (d.estado === 'descanso') {
      poner('entreno', 'Descanso', 'alta')
    } else if (d.estado === 'cambio') {
      if (d.hizo) poner('entreno', `${d.hizo}${nombre ? ` (cambió ${nombre})` : ' (cambió la pauta)'}`, 'alta')
      else descartado.push({ cita: 'cambió la sesión', motivo: 'no dijo qué hizo en su lugar' })
    } else {
      poner('entreno', `No entrenó${nombre ? ` (${nombre})` : ''}${d.motivo ? ` — «${d.motivo}»` : ''}`, 'alta')
    }
  }

  // Tiempos sueltos: la duración dicha, como comentario. Ni pasos ni sueño de la noche.
  const tiempos: string[] = []
  for (const t of v.tiempos ?? []) {
    const min = minutosDeCita(t.duracion)
    if (min === null || min < 1 || min > 24 * 60) {
      descartado.push({ cita: t.duracion, motivo: 'no pude leer esa duración' })
      continue
    }
    tiempos.push(`${TIEMPO_ETIQUETA[t.actividad]}: ${t.duracion}`)
    if (t.actividad === 'caminata' && parche.pasos === undefined) {
      seguimiento = seguimiento ?? { texto: '¿Tu celular o reloj te marca cuántos pasos llevas hoy?', opciones: [], campo_bloqueante: 'pasos' }
    }
  }
  if (tiempos.length > 0) {
    const previo = ctx.checkinHoy?.comentarios
    const nuevo = tiempos.join(' · ')
    poner('comentarios', typeof previo === 'string' && previo.trim() ? `${previo} · ${nuevo}` : nuevo, 'alta')
  }

  // Ausencia explícita de dolor: un cero medido (tabla cerrada, ver arriba).
  if (v.sin_dolor) {
    if (sinDolorExplicito(frase || v.sin_dolor)) poner('dolor', 0, 'alta')
    else descartado.push({ cita: v.sin_dolor, motivo: 'no es una ausencia clara de dolor: no se anota un cero' })
  }

  if (Object.keys(parche).length > 0) {
    registros.push({
      campo: 'checkin',
      fecha: diferido ? sumarDias(hoy, 1) : hoy,
      parche,
      confianza_por_campo: conf,
      ...(Object.keys(antes).length ? { antes } : {}),
      ...(diferido ? { diferido: true } : {}),
    })
  }

  // Agua: vasos × 200 mL (Res. 810), tazas, litros («litro y medio»), «botella de 600», y varias cosas
  // sumadas («tres vasos y una botella de 600»). Una botella sin tamaño se pregunta, no se inventa.
  if (v.agua) {
    const texto = normalizarTexto(`${v.agua.cantidad} ${v.agua.medida ?? ''}`)
      .replace(/\blitro y medio\b/, '1.5 litros')
      .replace(/\bmedio litro\b/, '0.5 litros')
    let ml = 0
    const partes: string[] = []
    let sinTamano = false
    for (const seg of texto.split(/\by\b|,|\+/).map((x) => x.trim()).filter(Boolean)) {
      const cant = numeroDeCita(seg)
      const explicito = seg.match(/\bbotellas?\s+de\s+(\d{2,4})\b/)
      if (explicito) {
        const n = cant && cant.valor !== Number(explicito[1]) ? cant.valor : 1
        ml += Number(explicito[1]) * n
        partes.push(`${n > 1 ? n + ' × ' : ''}botella de ${explicito[1]} mL`)
      } else if (/\b(ml|mililitros?)\b/.test(seg) && cant) { ml += cant.valor; partes.push(`${cant.valor} mL`) }
      else if (/\blitros?\b/.test(seg) && cant) { ml += cant.valor * 1000; partes.push(`${cant.valor} L`) }
      else if (/\b(botellas?|termo|garrafa)/.test(seg)) sinTamano = true
      else if (/\b(vasos?|tazas?)\b/.test(seg) && cant) { ml += cant.valor * VASO_ML; partes.push(`${cant.valor} × ${VASO_ML} mL`) }
    }
    if (sinTamano) {
      seguimiento = { texto: '¿De cuántos ml es tu botella (o si no sabes, pequeña, mediana o grande)?', opciones: ['Pequeña', 'Mediana', 'Grande'], campo_bloqueante: 'botella_ml' }
    } else if (ml > 0) {
      const ver = revisarAguaDeltaMl(ml, ctx.hidratacionHoyMl ?? 0)
      if (ver.tipo === 'imposible') descartado.push({ cita: v.agua.cantidad, motivo: ver.motivo })
      else {
        if (ver.tipo === 'aviso') avisos.push(ver.aviso)
        registros.push({ campo: 'hidratacion', fecha: hoy, delta_ml: ml, confianza: 'media', detalle: partes.join(' + ') })
      }
    }
  }

  return { registros, descartado, seguimiento, avisos }
}
