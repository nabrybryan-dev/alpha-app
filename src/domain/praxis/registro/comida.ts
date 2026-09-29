/**
 * Comida: cantidad + medida casera → gramos, siempre con su fuente.
 *
 * Política (DISENO §1.5, §1.6 y R1–R3 de nutrición):
 *  - Los gramos salen de la tabla `MEDIDAS_CASERAS`, nunca del modelo.
 *  - «Un plato», «un pedazo», «una presa» sin equivalencia verificada NO se
 *    convierten: gramos `null`, editable, y UNA duda de seguimiento.
 *  - La comida se registra SIEMPRE (R2): un hueco no la bloquea, queda editable.
 *  - Aceite y sal: solo con cucharada/cucharadita o pizca dicha. «Un chorrito»
 *    no se convierte.
 *  - El estado (crudo/cocido) se asume cocido (R1) y se avisa; si la persona
 *    dio gramos y el alimento cambia mucho al cocinarse, se pregunta.
 */
import { fechaLocal, horaLocal } from './fecha.ts'
import { gramosDeMedida, medidaCanonica, MEDIDAS_CASERAS, porcionHabitual } from './medidas.ts'
import { normalizarTexto, numeroDeCita, valorDeCita } from './numeros.ts'
import { revisarGramos } from './limites.ts'
import type {
  Confianza, ComidaExtraida, ContextoRegistro, ItemComidaPropuesto, Pregunta, RegistroAdherencia, RegistroComida,
} from './tipos.ts'

const CAMBIAN_AL_COCINAR = /\b(arroz|pasta|espagueti|lenteja|lentejas|frijol|frijoles|pollo|pechuga|carne|avena)\b/

export function comidaPorHora(ahoraIso: string): RegistroComida['comida'] {
  const { h, m } = horaLocal(ahoraIso)
  const t = h * 60 + m
  if (t < 10 * 60 + 30) return 'desayuno'
  if (t < 15 * 60 + 30) return 'almuerzo'
  if (t < 18 * 60) return 'snack'
  return 'cena'
}

function comidaDeCita(cita: string | null, ahoraIso: string): RegistroComida['comida'] {
  const n = normalizarTexto(cita ?? '')
  if (/desayun/.test(n)) return 'desayuno'
  if (/almuerz/.test(n)) return 'almuerzo'
  if (/\bcen(a|e|amos|ando)\b|\bcena\b|noche/.test(n)) return 'cena'
  if (/merienda|onces|snack|algo|media manana|media tarde/.test(n)) return 'snack'
  return comidaPorHora(ahoraIso)
}


/**
 * Cuando la duda no es «cuánto» sino «QUÉ era»: una presa de pollo sin parte, un pedazo de
 * queso (¿tajada o pedazo grueso?), un combo o un ejecutivo sin detalle. No se adivina.
 */
function preguntaDeIdentidad(alimento: string, medida: string | null, medidaTexto: string): Pregunta | null {
  const alim = normalizarTexto(alimento)
  const dijoPedazo = medida === 'presa' || medida === 'pedazo' || /(^| )(presa|pedazo)( |$)/.test(alim)
  if (/(^| )pollo( |$)/.test(alim) && dijoPedazo && !/(pechuga|pierna|muslo|alita|contramuslo)/.test(alim)) {
    return {
      texto: `¿La ${medidaTexto || 'presa'} era pechuga, pierna, muslo o ala?`,
      opciones: ['Pechuga', 'Pierna', 'Muslo'],
      campo_bloqueante: 'alimento',
    }
  }
  // Un «pedazo» de algo que la tabla mide en tajadas (queso, pan, piña): primero se aclara cuál.
  if (medida === 'pedazo' && MEDIDAS_CASERAS.some((f) => f.medida === 'tajada' && f.claves[0].some((k) => alim.includes(k)))) {
    return { texto: '¿Era una tajada delgada o un pedazo grueso?', opciones: ['Tajada delgada', 'Pedazo grueso'], campo_bloqueante: 'alimento' }
  }
  const compuesto = alim.match(/\b(combo|ejecutivo|corrientazo)\b/)
  if (compuesto) return { texto: `¿Qué traía el ${compuesto[1]}, más o menos?`, opciones: [], campo_bloqueante: 'alimento_compuesto' }
  return null
}

export interface ResultadoComida {
  registro: RegistroComida | null
  /** «Comí como decía el plan»: se marca la adherencia, no se copian gramos. */
  adherencia?: RegistroAdherencia
  seguimiento?: Pregunta
  descartado: { cita: string; motivo: string }[]
  avisos: string[]
}

export function resolverComida(c: ComidaExtraida, ctx: ContextoRegistro): ResultadoComida {
  const items: ItemComidaPropuesto[] = []
  const descartado: ResultadoComida['descartado'] = []
  const avisos: string[] = []
  let seguimiento: Pregunta | undefined
  const preguntar = (p: Pregunta) => {
    seguimiento = seguimiento ?? p
  }

  for (const it of c.items) {
    const pesado = it.senales.includes('pesado')
    const q = valorDeCita(it.cantidad)
    const medida = medidaCanonica(it.medida)
    const medidaTexto = normalizarTexto(it.medida ?? '')
    const estado = it.estado ? normalizarTexto(it.estado) : null
    const base: ItemComidaPropuesto = {
      alimento: it.alimento,
      gramos: null,
      medida_nombre: it.medida ?? null,
      medida_cantidad: q,
      estado_asumido: estado,
      fuente_medida: null,
      confianza: 'baja',
      editable: true,
    }

    // Pesado en la báscula: la cifra es la de la persona.
    if (/^(g|gr|gramos?|grs)$/.test(medidaTexto) && q !== null) {
      const ver = revisarGramos(q)
      if (ver.tipo === 'imposible') {
        descartado.push({ cita: it.alimento, motivo: ver.motivo })
        continue
      }
      let estadoAsumido = estado
      if (!estado && CAMBIAN_AL_COCINAR.test(normalizarTexto(it.alimento))) {
        estadoAsumido = 'cocido'
        avisos.push(`${it.alimento}: se asumió cocido (si fue crudo, cámbialo: el peso cambia mucho)`)
        preguntar({
          texto: `¿Esos ${q} g eran con el ${it.alimento} ya cocido o crudo?`,
          opciones: ['Cocido', 'Crudo'],
          campo_bloqueante: 'estado',
        })
      }
      items.push({
        ...base,
        gramos: q,
        estado_asumido: estadoAsumido,
        fuente_medida: pesado ? 'pesado' : 'dicho en gramos',
        confianza: pesado ? 'alta' : 'media',
      })
      continue
    }

    const identidad = preguntaDeIdentidad(it.alimento, medida, medidaTexto)
    if (identidad) {
      items.push({ ...base, nota: 'Falta saber qué era' })
      preguntar(identidad)
      continue
    }

    // Sin cantidad y sin medida: hueco editable + duda.
    if (q === null && !it.medida) {
      items.push({ ...base, nota: 'Sin cantidad: complétala en la tarjeta' })
      preguntar({
        texto: `¿Cuánto ${it.alimento} más o menos (tazas, cucharadas, gramos)?`,
        opciones: [],
        campo_bloqueante: 'cantidad',
      })
      continue
    }

    const cantidad = q ?? 1
    const res = gramosDeMedida(it.alimento, medida, cantidad)
    if (res.tipo === 'gramos') {
      const ver = revisarGramos(res.gramos)
      if (ver.tipo === 'imposible') {
        descartado.push({ cita: it.alimento, motivo: ver.motivo })
        continue
      }
      const conf: Confianza = it.senales.includes('aproximado') || it.senales.includes('no_recuerda')
        ? (res.confianza === 'media' ? 'media' : 'baja')
        : res.confianza
      items.push({
        ...base,
        gramos: res.gramos,
        estado_asumido: estado ?? res.fila.estado ?? null,
        fuente_medida: res.fila.fuente,
        confianza: it.senales.includes('no_recuerda') ? 'baja' : conf,
        nota: res.fila.nota ?? res.eq,
      })
      continue
    }
    if (res.tipo === 'ambigua') {
      items.push({ ...base, nota: 'Falta saber cuál era' })
      preguntar(res.pregunta)
      continue
    }
    // Sin equivalencia: «plato» con porción habitual, si no, hueco.
    const habitual = medida === 'plato' || medida === 'porcion' || medida === 'unidad' ? porcionHabitual(it.alimento) : null
    if (habitual) {
      items.push({
        ...base,
        gramos: Math.round(cantidad * habitual.gramos * 10) / 10,
        fuente_medida: habitual.fuente,
        confianza: 'baja',
        nota: `${medidaTexto || 'porción'} no es medida oficial: se usó la porción habitual`,
      })
      continue
    }
    items.push({ ...base, nota: res.motivo })
    if (medida === 'pedazo' || medida === 'presa' || medida === 'plato') {
      preguntar({
        texto: `El ${medidaTexto || 'pedazo'} de ${it.alimento}, ¿era del tamaño de la palma de tu mano o más grande?`,
        opciones: ['Palma sin dedos', 'Media palma', 'Dos palmas'],
        campo_bloqueante: 'cantidad',
      })
    } else {
      preguntar({ texto: `¿Como cuánto ${it.alimento} fue?`, opciones: [], campo_bloqueante: 'cantidad' })
    }
  }

  // Plato dividido en fracciones: sin fuente colombiana para «medio plato».
  for (const p of c.plato ?? []) {
    if (items.some((i) => normalizarTexto(i.alimento) === normalizarTexto(p.alimento))) continue
    const f = valorDeCita(p.fraccion)
    const habitual = f !== null ? porcionHabitual(p.alimento) : null
    if (habitual && f !== null) {
      items.push({
        alimento: p.alimento,
        gramos: Math.round(f * habitual.gramos * 10) / 10,
        medida_nombre: 'plato',
        medida_cantidad: f,
        estado_asumido: null,
        fuente_medida: habitual.fuente,
        confianza: 'baja',
        editable: true,
        nota: 'plato no es medida oficial: se usó la porción habitual',
      })
    } else {
      items.push({
        alimento: p.alimento, gramos: null, medida_nombre: 'plato', medida_cantidad: f, estado_asumido: null,
        fuente_medida: null, confianza: 'baja', editable: true, nota: 'Sin equivalencia: complétala en la tarjeta',
      })
    }
  }

  // Aceite y sal (R3): solo con medida dicha.
  let aceite_g: number | null | undefined
  let sal_g: number | null | undefined
  for (const [cita, tipo] of [[c.aceite, 'aceite'], [c.sal, 'sal']] as const) {
    if (!cita) continue
    const n = normalizarTexto(cita)
    const qty = numeroDeCita(cita)
    const med = /cucharadit/.test(n) ? 'cucharadita' : /cucharad/.test(n) ? 'cucharada' : /pizca/.test(n) ? 'pizca' : null
    // «una pizca» no lleva número escrito; «un chorrito» no lleva medida: no se convierte.
    const res = med && (qty || med === 'pizca') ? gramosDeMedida(tipo, med, qty?.valor ?? 1) : null
    if (res && res.tipo === 'gramos') {
      if (tipo === 'aceite') aceite_g = res.gramos
      else sal_g = res.gramos
    } else {
      if (tipo === 'aceite') aceite_g = null
      else sal_g = null
      preguntar({
        texto: tipo === 'aceite' ? '¿Fue como una cucharadita o una cucharada?' : '¿Fue una pizca o una cucharadita?',
        opciones: tipo === 'aceite' ? ['Cucharadita', 'Cucharada'] : ['Pizca', 'Cucharadita'],
        campo_bloqueante: tipo,
      })
    }
  }

  const adherencia: RegistroAdherencia | undefined =
    c.segun_plan === 'no_dicho'
      ? undefined
      : {
          campo: 'adherencia',
          fecha: fechaLocal(ctx.ahora),
          estado: c.segun_plan === 'como_el_plan' ? 'si' : c.segun_plan === 'parcial' ? 'parcial' : 'no',
          confianza: 'alta',
        }

  if (items.length === 0 && aceite_g === undefined && sal_g === undefined) {
    // Dijo qué comida fue pero no qué comió («almuerzo ejecutivo»): nada que registrar, se pregunta.
    if (!adherencia && !(c.plato && c.plato.length > 0)) {
      const cual = comidaDeCita(c.comida_cita, ctx.ahora)
      preguntar({ texto: `¿Qué traía tu ${cual}?`, opciones: [], campo_bloqueante: 'alimento' })
    }
    return { registro: null, adherencia, seguimiento, descartado, avisos }
  }
  const todosPesados = items.length > 0 && items.every((i) => i.fuente_medida === 'pesado')
  const registro: RegistroComida = {
    campo: 'comida',
    comida: comidaDeCita(c.comida_cita, ctx.ahora),
    fecha: fechaLocal(ctx.ahora),
    items,
    confianza_registro: c.cocinado_por_ella === 'no' ? 'ajeno' : todosPesados ? 'pesado' : 'estimado',
    ...(aceite_g !== undefined ? { aceite_g } : {}),
    ...(sal_g !== undefined ? { sal_g } : {}),
  }
  return { registro, adherencia, seguimiento, descartado, avisos }
}
