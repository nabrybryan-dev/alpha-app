import { Cab, alInicio, compactar, enfocarControles, limpiarControles, montar, mostrarControles, refrescar, retirarControles } from './cabecera'
import { chips, controlAclaracion, controlNoche, enCamaMin, gAlimentacion, gCalidad, gCansancio, gEstres, gGanas, gRendimiento, pieSeguir } from './controles'
import { avisoBryan, controlDolor, controlEntreno, controlHambre, rotuloBryan } from './controlesCuerpo'
import { ETQ, HOY, IDEA_AYER, NOMBRE, type Campo, type DatosDia } from './datos'
import { $, h } from './dom'
import { guardar, leer, reducido, tu } from './entorno'
import { faseEco, faseFirma } from './fases'
import { decir, decirCorto, mostrarPersona, ponerSugerencias } from './frase'
import { conArticulo, preguntaIdea, preguntaIdeaCorta } from './idea'
import { interpretar, siNo } from './interpretar'
import { DUR, esperar, num } from './movimiento'
import { Onda } from './onda'
import { Penta, anotar, anotarDuda } from './penta'
import { respirar } from './respirar'
import { anotarSenalAlimentaria, entrarQuieta, preguntarCuidado, renderSaltos, salto } from './senales'
import { Cancelado, E, S, armarSilencio, cancelar, cortarDecir, emitir, esperaCon, faltantes, guardarBorrador, hayDatos, segundos, vigilar, type Escenario, type Evento, type Sesion } from './sesion'
import { cap, fmtDur, horasPalabra, listaY, normalizar, numPalabra, sesion } from './texto'

/* ——— Los turnos: cuatro preguntas compuestas, y solo lo que hace falta hoy ——— */
const EJ: Record<string, string[]> = {
  hilo: ['a medias, la dejé en la cocina pero la saqué a las once'],
  noche: ['me acosté como a las 12, me levanté a las 6 y 10, dormí a saltos y amanecí muy cansada', 'dormí bien, unas 7 horas y media, amanecí descansado'],
  entreno: ['hice pierna, me fue bien, pero hoy pocas ganas', 'descansé, me fue regular y hoy tengo muchas ganas'],
  cuerpo: ['la rodilla izquierda, poquito', 'nada me duele'],
  mesa: ['hambre como 6, comí bien, estrés alto, semana pesada en el trabajo', 'hambre en 3, comí regular, estoy tranquila'],
  profundo: ['el cierre de mes en el trabajo me tiene sin almorzar a tiempo'],
}
type IdTurno = 'noche' | 'entreno' | 'cuerpo' | 'mesa'
const TURNO_DE: Record<string, IdTurno> = { horaAcostarse: 'noche', horaLevantarse: 'noche', horasSueno: 'noche', calidadSueno: 'noche', cansancio: 'noche', entreno: 'entreno', rendimiento: 'entreno', motivacion: 'entreno', dolor: 'cuerpo', dolorDonde: 'cuerpo', hambreEscala: 'mesa', alimentacion: 'mesa', estres: 'mesa' }
const NOMBRE_TURNO: Record<IdTurno, string> = { noche: 'La noche', entreno: 'El entreno', cuerpo: 'El cuerpo', mesa: 'La comida y el estrés' }
const CAMPOS_TURNO: Record<IdTurno, Campo[]> = { noche: ['calidadSueno', 'cansancio'], entreno: ['rendimiento', 'motivacion'], cuerpo: ['dolor'], mesa: ['hambreEscala', 'alimentacion', 'estres'] }
const TURNOS_BASE: IdTurno[] = ['noche', 'entreno', 'cuerpo', 'mesa']
const GANAS: Record<string, string> = { POCO: 'pocas ganas', REGULAR: 'ganas normales', MUCHO: 'muchas ganas' }
function saludo(): string { return E.franja === 'manana' ? 'Buenos días.' : 'Buenas noches.' }
/* La primera vez (Bryan, 29-sep): saludo + quién es + el aviso del canal humano + la primera pregunta, y nada más.
   La nota escrita se queda quieta encima de la frase; «No doy terapia» ya está fijo en la barra. */
const PRESENTACION = 'Soy Praxis, una voz sintética, no una persona.'
const NOTA_HUMANOS = 'Bryan y Manuela leen los resúmenes, pero no en el momento.'
const avisoHumanos = () => tu('Bryan y Manuela leen tu resumen después.', 'Bryan y Manuela leen su resumen después.')
/* La presentación se marca como dicha en cuanto se compone (aunque la persona la corte con un toque, el texto se completa entero). */
function conSaludo(p: string): string {
  let pre = ''
  if (S.saludoPendiente) { S.saludoPendiente = false; pre = saludo() + ' ' }
  if (S.presentarPendiente) { S.presentarPendiente = false; pre += PRESENTACION + ' ' + avisoHumanos() + ' '; guardar('presentada', true) }
  return pre + p
}
function turnoCompleto(t: IdTurno, d: DatosDia): boolean { if (t === 'cuerpo') return d.dolor != null && (d.dolor === 0 || !!d.dolorDonde); return CAMPOS_TURNO[t].every((c) => d[c] != null) }
function senalProfunda(d: DatosDia, esc: Escenario): boolean { return (d.estres === 'MUCHO' && esc.estresAyer === 'mucho') || num(d.dolor) >= 4 || (d.horasSueno != null && d.horasSueno <= 5) }
/* La pregunta de la semana: no si trata del mismo hábito que la idea de ayer, y de verdad una vez por semana */
function notaToca(): boolean {
  if (E.idea === 'si' && /celular/.test(IDEA_AYER)) return false
  const f = leer<string | null>('notaFecha', null)
  if (!f) return true
  const dias = (Date.parse(HOY.fecha) - Date.parse(f)) / 86400000
  return !(dias >= 0 && dias < 7)
}
/** Decide qué se pregunta y cuándo. */
function siguientePregunta(st: Sesion, esc: Escenario, seg: number): IdTurno | 'hilo' | 'profundo' | 'nota' | 'firma' {
  const d = st.datos, hecho = (id: string) => st.hechos.includes(id)
  if (esc.idea === 'si' && !hecho('hilo')) return 'hilo'
  if (!hecho('profundo') && senalProfunda(d, esc)) return 'profundo' // se ofrece justo después del turno que lo provoca
  if (esc.dolorAyer === 'si' && !hecho('cuerpo') && !turnoCompleto('cuerpo', d)) return 'cuerpo'
  for (const t of TURNOS_BASE) { if (!hecho(t) && !turnoCompleto(t, d)) return t; if (!hecho('profundo') && senalProfunda(d, esc)) return 'profundo' }
  if (!hecho('nota') && seg < 75 && notaToca()) return 'nota'
  return 'firma'
}
type Conv = (t: string) => Evento | null
const convSiNo = (tipo: string, [si, no]: [string | boolean, string | boolean]): Conv => (t) => { const v = siNo(t); return v == null ? null : { tipo, v: v ? si : no } }
/* Espera un tipo de evento. Si la persona escribe donde solo caben toques, se le entiende un sí/no o se le dice qué hacer. */
export async function esperaTipo(tok: number, tipos: string[], conv?: Conv): Promise<Evento> {
  for (;;) {
    const e = await esperaCon(tok, null)
    if (tipos.includes(e.tipo)) return e
    if (e.tipo === 'texto') {
      mostrarPersona(e.txt || '', e.fuente || 'texto')
      const ev = conv ? conv(e.txt || '') : null
      if (ev) return ev
      decirCorto(tu('Toca una opción, por favor.', 'Toque una opción, por favor.'))
    }
  }
}
const hablo = (campos: Campo[]) => campos.some((c) => S.fuentes[c] === 'texto' || S.fuentes[c] === 'voz')
const comentarioCon = (frase: string) => (S.datos.comentarios ? S.datos.comentarios + ' · ' + frase : frase)

export async function procesarTexto(evt: Evento, tok: number): Promise<{ meta?: boolean; agotado?: boolean; nada?: boolean }> {
  const txt = evt.txt || '', fuente = evt.fuente || 'texto'
  mostrarPersona(txt, fuente)
  const res = interpretar(txt, S.turno)
  if (res.riesgo) { entrarQuieta(res.riesgo, txt, false); throw new Cancelado() }
  if (res.ambiguo) { preguntarCuidado(txt, fuente); throw new Cancelado() }
  if (res.alimentaria) anotarSenalAlimentaria(txt)
  if (res.persona) { await decir('Soy Praxis, la voz sintética de Alpha: una inteligencia artificial, no una persona, y no hago terapia. Bryan y Manuela leen los resúmenes, pero no en el momento.', tok); return { meta: true } }
  if (res.noSe) { await decir('Listo, lo dejamos en blanco.', tok); return { meta: true } }
  const lat = await conLatencia(tok)
  if (lat.agotado) return { agotado: true } // «piensa» con latencia real (§3.7)
  /* Fuera de su turno, lo dicho solo llena huecos: nunca pisa lo que ya está confirmado */
  const propio = S.turno === 'firma' || S.turno === 'rapido'
  const campos = res.campos.filter((c) => propio || !TURNO_DE[c.campo] || TURNO_DE[c.campo] === S.turno || S.datos[c.campo] == null)
  for (const c of campos) { anotar(c.campo, c.valor, fuente, c.cita); if (!reducido()) await esperar(160); vigilar(tok) }
  for (const du of res.dudas) if (S.datos[du.campo] == null) anotarDuda(du.campo, du.opciones, du.cita, fuente)
  if (res.sobrante.length) { const lit = res.sobrante.join(' · '); anotar('comentarios', comentarioCon(lit), fuente, lit) }
  if (campos.some((c) => c.campo === 'horaAcostarse' || c.campo === 'horaLevantarse') && S.datos.horasSueno == null) S.pendienteHoras = true
  if (campos.some((c) => c.campo === 'dolorDonde') && S.datos.dolor == null) S.mostrarDial = true
  const otros = new Set(campos.map((c) => TURNO_DE[c.campo]).filter((t) => t && t !== S.turno && !S.hechos.includes(t)))
  otros.forEach((t) => salto(NOMBRE_TURNO[t] + tu(': ya me contaste una parte; solo pregunto lo que falta.', ': ya me contó una parte; solo pregunto lo que falta.')))
  if (res.hilo) { S.hilo = res.hilo; Penta.render() }
  if (res.nota != null) { S.nota = res.nota; Penta.render() }
  refrescar()
  const nada = !campos.length && !res.dudas.length && !res.sobrante.length && res.hilo == null && res.nota == null
  return { nada }
}

/* ——— «Piensa» con latencia real. La meta es 1–1,5 s y el p95 medido fue de 7,7 s por CLI. El prototipo no llama a ningún modelo:
   la espera se simula (LATENCIA) y todo lo demás es el comportamiento real.
   0–150 ms nada · 150 ms aparece la chispa (mínimo 400 ms en pantalla) · 3 s «Sigo pensando…» · 8 s «Puedes seguir con toques» ·
   15 s se agota: «No me llegó la respuesta…», sin reintento automático. ——— */
const LATENCIA_SIMULADA = 900
async function conLatencia(tok: number): Promise<{ agotado: boolean }> {
  const red = reducido(), espera = red ? 300 : LATENCIA_SIMULADA
  const t0 = performance.now(), dicho = $('#dicho'), ayuda = $('#ayuda'), sr = $('#srPiensa')
  let piensa = false, agotado = false, avisos = 0
  const cuando = (ms2: number, fn: () => void) => window.setTimeout(() => { if (tok === S.tok) fn() }, ms2)
  const timers = [
    cuando(150, () => { piensa = true; Onda.estado('piensa'); dicho.setAttribute('aria-busy', 'true'); if (red) ayuda.textContent = 'Pensando…' }),
    cuando(400, () => { sr.textContent = 'Praxis está pensando' }),
    cuando(3000, () => { ayuda.textContent = 'Sigo pensando…'; ayuda.classList.remove('entra'); void ayuda.offsetWidth; ayuda.classList.add('entra'); avisos = 1 }),
    cuando(8000, () => { ayuda.textContent = tu('Puedes seguir con los botones.', 'Puede seguir con los botones.'); avisos = 2 }),
  ]
  let t15 = 0
  try {
    await Promise.race([esperar(espera), new Promise<void>((r) => { t15 = window.setTimeout(() => { agotado = true; r() }, 15000) })])
  } finally {
    timers.forEach((t) => clearTimeout(t)); clearTimeout(t15)
  }
  vigilar(tok)
  if (piensa) { const visible = performance.now() - (t0 + 150); if (visible < DUR.piensaMin) { await esperar(DUR.piensaMin - visible); vigilar(tok) } }
  dicho.removeAttribute('aria-busy'); sr.textContent = ''
  if (avisos || red) ayuda.textContent = ''
  Onda.estado('reposo')
  return { agotado }
}

interface Turno {
  id: string; pregunta: string; ejemplos: string[]; noMarcar?: boolean
  primera?: () => string
  montar: () => Node | null | false | (Node | null | false)[]
  auto: () => boolean; min: () => boolean
  trasTexto?: () => string | null
  reflejo: () => string | null
}
async function correrTurno(tok: number, cfg: Turno): Promise<void> {
  S.turno = cfg.id; alInicio(); Cab.arma()
  /* La primera vez (saludo + presentación + pregunta) es un ritual (Bryan, 29-sep): el agujero se queda grande hasta que termina la frase y los
     controles llegan AL TERMINAR, en cualquier pantalla. Tocar la frase, escribir o desplazarse lo acortan. Los demás días, a los 400 ms. */
  const primera = S.presentarPendiente
  const pd = decir(conSaludo(primera && cfg.primera ? cfg.primera() : cfg.pregunta), tok, primera ? { nota: NOTA_HUMANOS } : {})
  pd.catch(() => { /* la cancelación se propaga por las otras esperas */ })
  if (primera) await pd; else await Promise.race([pd, esperar(reducido() ? 0 : 400)])
  vigilar(tok) // los días siguientes, los controles llegan a los 400 ms, con la frase todavía diciéndose
  montar(() => [...([] as (Node | null | false)[]).concat(cfg.montar()), pieSeguir(cfg.min())])
  ponerSugerencias(cfg.ejemplos) // antes de medir: el muelle ya tiene su alto final
  if (!primera) Cab.revisarBajas() // en pantallas bajas se compacta ahora; en las altas el agujero sigue grande hasta que Praxis termina la frase
  if (primera) mostrarControles(true) // la frase ya se leyó: la vista baja lo justo para ver la primera fila entera (espera al FLIP)
  else if ($('#ondaCaja').classList.contains('compacta')) mostrarControles()
  enfocarControles()
  S.cola = S.cola.filter((e) => e.tipo === 'texto')
  armarSilencio(tok)
  let tras = false
  for (;;) {
    const evt = await esperaCon(tok, cfg.auto() ? (tras ? 350 : 1300) : null)
    if (evt.tipo === 'tiempo') { if (cfg.auto()) break; continue }
    cortarDecir(); await pd // si la persona responde mientras Praxis habla, Praxis se calla
    if (evt.tipo === 'seguir') { if (cfg.min()) break; continue }
    if (evt.tipo === 'texto') {
      const r = await procesarTexto(evt, tok)
      if (r.agotado) await decir('No me llegó la respuesta. Seguimos con toques o con el formulario.', tok)
      else if (r.nada) await decir(tu('No te entendí del todo. Puedes tocar una opción.', 'No le entendí del todo. Puede tocar una opción.'), tok)
      else if (!r.meta && cfg.trasTexto) {
        const q = cfg.trasTexto()
        if (q) { await decir(q, tok); if (S.aplanar) { S.aplanar = false; Onda.estado('aplanada') } }
      }
      tras = true; armarSilencio(tok); continue
    }
    tras = false
  }
  await pd
  clearTimeout(S.tSilencio)
  await retirarControles(); vigilar(tok) // los controles del turno salen en 160 ms y hay un hueco limpio de 120 ms
  const rf = cfg.reflejo()
  if (rf) await decir(rf, tok)
  if (!cfg.noMarcar && !S.hechos.includes(cfg.id)) S.hechos.push(cfg.id)
  guardarBorrador()
}

const TURNOS: Record<string, (tok: number) => Promise<void>> = {
  async hilo(tok) {
    await correrTurno(tok, {
      id: 'hilo', pregunta: preguntaIdea(IDEA_AYER), ejemplos: EJ.hilo,
      primera: () => preguntaIdeaCorta(IDEA_AYER),
      montar: () => chips([['Sí', 'si'], ['A medias', 'a_medias'], ['No', 'no'], ['Saltar', 'saltar']], (v) => { S.hilo = v; Penta.render(); guardarBorrador(); refrescar(); emitir({ tipo: 'toque' }) }, S.hilo, 'hilo'),
      auto: () => S.hilo != null, min: () => S.hilo != null,
      reflejo: () => (S.hilo === 'no' ? 'Gracias por decírmelo. ¿La dejamos igual o la hacemos más pequeña?' : null),
    })
    if (S.hilo === 'no') {
      montar(() => chips([['Igual', 'igual'], ['Más pequeña', 'pequena']], (v) => emitir({ tipo: 'hiloNo', v }), null, 'hilo-no'))
      const conv: Conv = (t) => { const n = normalizar(t); if (/peque|chic|menos/.test(n)) return { tipo: 'hiloNo', v: 'pequena' }; if (/igual|misma|asi/.test(n)) return { tipo: 'hiloNo', v: 'igual' }; return null }
      const r = await esperaTipo(tok, ['hiloNo'], conv)
      S.hiloPequena = r.v === 'pequena'; limpiarControles()
      await decir(r.v === 'pequena' ? 'Listo: esta noche basta con dejarlo fuera del cuarto.' : 'Bueno, la dejamos igual.', tok)
    }
  },
  async noche(tok) {
    const d = S.datos
    salto(tu('El horario de la noche es opcional: si no lo añades, no se guarda.', 'El horario de la noche es opcional: si no lo añade, no se guarda.'))
    const preg = d.calidadSueno != null && d.cansancio == null ? tu('¿Y cómo amaneciste?', '¿Y cómo amaneció?') : E.franja === 'manana' ? tu('¿Cómo dormiste y cómo amaneciste?', '¿Cómo durmió y cómo amaneció?') : tu('¿Cómo estuvo el día? Empecemos por cómo dormiste anoche.', '¿Cómo estuvo el día? Empecemos por cómo durmió anoche.')
    const muestra = (['calidadSueno', 'cansancio'] as Campo[]).filter((c) => d[c] == null)
    await correrTurno(tok, {
      id: 'noche', pregunta: preg, ejemplos: EJ.noche,
      primera: () => (E.franja === 'manana' ? preg : tu('¿Cómo dormiste anoche?', '¿Cómo durmió anoche?')), // la primera vez, en ~15 palabras
      montar: () => [controlAclaracion(), controlNoche(), muestra.includes('calidadSueno') && gCalidad(), muestra.includes('cansancio') && gCansancio()],
      auto: () => S.datos.calidadSueno != null && S.datos.cansancio != null && !S.dudas.calidadSueno && !S.dudas.cansancio && !S.pendienteHoras,
      min: () => S.datos.calidadSueno != null && S.datos.cansancio != null,
      trasTexto: () => {
        const p: string[] = [], ec = enCamaMin()
        if (S.pendienteHoras && ec != null) p.push(tu('Estuviste ', 'Estuvo ') + fmtDur(ec) + ' en la cama. ' + tu('¿Dormiste más o menos eso?', '¿Durmió más o menos eso?'))
        /* Lo dudoso se pregunta sin citar entre comillas en medio de la frase: con las opciones dichas como se dicen */
        const ADJ_CAL: Record<string, string> = { MALA: 'mal', REGULAR: 'regular', BUENA: 'bien' }, ADJ_CAN: Record<string, string> = { POCO: 'poco cansancio', REGULAR: 'algo de cansancio', MUCHO: 'mucho cansancio' }
        if (S.dudas.calidadSueno) p.push((p.length ? 'Y no' : 'No') + ' me quedó claro cómo ' + tu('dormiste', 'durmió') + ': ¿' + S.dudas.calidadSueno.opciones.map((o) => ADJ_CAL[o]).join(' o ') + '?')
        if (S.dudas.cansancio) p.push(tu('¿Y amaneciste con ', '¿Y amaneció con ') + S.dudas.cansancio.opciones.map((o) => ADJ_CAN[o]).join(' o con ') + '?')
        if (!p.length && S.datos.calidadSueno == null) p.push(tu('¿Y cómo dormiste?', '¿Y cómo durmió?'))
        else if (!p.length && S.datos.cansancio == null) p.push(tu('¿Y con cuánto cansancio amaneciste?', '¿Y con cuánto cansancio amaneció?'))
        return p.join(' ')
      },
      reflejo: () => {
        if (!hablo(['calidadSueno', 'cansancio', 'horasSueno'])) return null // si tocó, la nota que cae ya lo confirma
        const d2 = S.datos, hs = d2.horasSueno != null ? horasPalabra(d2.horasSueno) : null
        const cita = S.citas.calidadSueno && S.fuentes.calidadSueno !== 'toque' && !/^\s*(dorm|no dorm)/.test(normalizar(S.citas.calidadSueno)) ? S.citas.calidadSueno : null
        const cal = cita || ({ BUENA: 'bien', REGULAR: 'regular', MALA: 'mal' } as Record<string, string>)[d2.calidadSueno || '']
        const can = ({ POCO: 'poco cansancio', REGULAR: 'algo de cansancio', MUCHO: 'mucho cansancio' } as Record<string, string>)[d2.cansancio || '']
        const dur = tu('Dormiste ', 'Durmió ') + (hs ? hs + (cal ? ', ' + cal + ',' : '') : cal || '')
        return (hs || cal ? dur : '') + (can ? (hs || cal ? ' y ' + tu('amaneciste', 'amaneció') : tu('Amaneciste', 'Amaneció')) + ' con ' + can : '') + '.'
      },
    })
    S.pendienteHoras = false
    if (S.datos.horasSueno != null && S.datos.horasSueno <= 5 && !S.respiraOfrecida && leer('saltosRespira', 0) < 3) {
      S.respiraOfrecida = true; $('#btnRespirar').classList.add('ofrece')
      await decir('¿Respiramos tres veces antes de seguir?', tok)
      montar(() => chips([['Sí', 'si'], ['Saltar', 'no']], (v) => emitir({ tipo: 'resp', v }), null, 'resp'))
      const r = await esperaTipo(tok, ['resp'], convSiNo('resp', ['si', 'no']))
      limpiarControles(); $('#btnRespirar').classList.remove('ofrece')
      if (r.v === 'si') { await respirar(); vigilar(tok); await decir('Listo. Seguimos.', tok) }
      else guardar('saltosRespira', leer('saltosRespira', 0) + 1)
    }
  },
  async entreno(tok) {
    const d = S.datos, man = E.franja === 'manana'
    const faltaE = d.rendimiento == null, faltaG = d.motivacion == null
    const desc = d.entreno === 'Descansé'
    const ent = desc ? tu('cómo te sentiste descansando', 'cómo se sintió descansando') : tu('qué hiciste y cómo te fue', 'qué hizo y cómo le fue')
    let preg
    const ganasHoy = tu('¿Con cuántas ganas estás hoy?', '¿Con cuántas ganas está hoy?')
    if (faltaE && faltaG) preg = man ? '¿Y el entreno de ayer, ' + ent + '? ' + ganasHoy : tu('¿Qué entrenaste hoy y cómo te fue? ¿Con cuántas ganas estás?', '¿Qué entrenó hoy y cómo le fue? ¿Con cuántas ganas está?')
    else if (faltaG) { preg = ganasHoy; salto(tu('El entreno ya me lo contaste: solo te pregunto las ganas.', 'El entreno ya me lo contó: solo le pregunto las ganas.')) }
    else preg = man ? '¿Y el entreno de ayer, ' + ent + '?' : tu('¿Qué entrenaste hoy y cómo te fue?', '¿Qué entrenó hoy y cómo le fue?')
    const REN_TXT: Record<string, string> = { MALA: tu('te fue mal', 'le fue mal'), REGULAR: tu('te fue regular', 'le fue regular'), BUENA: tu('te fue bien', 'le fue bien') }
    const REN_DESC: Record<string, string> = { MALA: tu('te sentiste mal', 'se sintió mal'), REGULAR: tu('te sentiste regular', 'se sintió regular'), BUENA: tu('te sentiste bien', 'se sintió bien') }
    await correrTurno(tok, {
      id: 'entreno', pregunta: preg, ejemplos: EJ.entreno,
      montar: () => [faltaE && controlEntreno(), faltaE && gRendimiento(), faltaG && gGanas()],
      auto: () => S.datos.rendimiento != null && S.datos.motivacion != null, min: () => S.datos.rendimiento != null && S.datos.motivacion != null,
      trasTexto: () => (S.datos.rendimiento == null ? tu('¿Y cómo te fue?', '¿Y cómo le fue?') : S.datos.motivacion == null ? tu('¿Y con cuántas ganas estás hoy?', '¿Y con cuántas ganas está hoy?') : null),
      reflejo: () => {
        if (!hablo(['entreno', 'rendimiento', 'motivacion'])) return null
        const x = S.datos
        const hoyGanas = tu('Hoy tienes ', 'Hoy tiene ') + GANAS[x.motivacion || ''] + '.'
        if (x.entreno === 'Descansé') return tu('Descansaste y ', 'Descansó y ') + REN_DESC[x.rendimiento || ''] + '. ' + hoyGanas
        if (x.rendimiento === 'BUENA' && x.motivacion === 'POCO') return (x.entreno === 'LEG A' ? 'La pierna' : x.entreno ? sesion(x.entreno) : 'El entreno') + tu(' te salió bien', ' le salió bien') + ', aun con pocas ganas.'
        return cap((x.entreno ? 'En ' + sesion(x.entreno) + ' ' : '') + REN_TXT[x.rendimiento || '']) + '. ' + hoyGanas
      },
    })
  },
  async cuerpo(tok) {
    const dolio = E.dolorAyer === 'si'
    if (dolio) { S.mostrarDial = true; salto(tu('Empiezo por el cuerpo: ayer anotaste un 6 de dolor en la rodilla.', 'Empiezo por el cuerpo: ayer anotó un 6 de dolor en la rodilla.')) }
    await correrTurno(tok, {
      id: 'cuerpo', pregunta: dolio ? '¿Cómo sigue la rodilla?' : tu('¿Algo te duele hoy?', '¿Algo le duele hoy?'), ejemplos: EJ.cuerpo,
      montar: () => controlDolor(),
      auto: () => turnoCompleto('cuerpo', S.datos), min: () => turnoCompleto('cuerpo', S.datos),
      trasTexto: () => {
        const x = S.datos
        if (x.dolorDonde && x.dolor == null) { S.aplanar = true; return '¿Cuánto, del 0 al 10?' }
        if (num(x.dolor) > 0 && !x.dolorDonde) return '¿Dónde?'
        return null
      },
      reflejo: () => {
        const x = S.datos
        if (num(x.dolor) >= 4) return null // la pregunta siguiente lo dice con su razón
        if (!hablo(['dolor', 'dolorDonde'])) return null
        if (x.dolor === 0) return tu('Nada te duele.', 'Nada le duele.')
        return cap(numPalabra(x.dolor as number)) + ' en ' + conArticulo(x.dolorDonde || '') + '.'
      },
    })
    if (num(S.datos.dolor) >= 7) {
      montar(() => [h('button', { type: 'button', class: 'btn-rojo-borde', onclick: () => { avisoBryan(); emitir({ tipo: 'bryan' }) } }, rotuloBryan()), pieSeguir(true)])
      await esperaTipo(tok, ['bryan', 'seguir'])
      limpiarControles()
    }
  },
  /* La mesa se pregunta en dos tiempos: comida y hambre juntas, y el estrés aparte, como cierre */
  async mesa(tok) {
    const d = S.datos, man = E.franja === 'manana'
    const faltaH = d.hambreEscala == null, faltaA = d.alimentacion == null, faltaS = d.estres == null
    if (!(faltaH && faltaA && faltaS)) salto(tu('La comida: ya me contaste una parte; solo pregunto lo que falta.', 'La comida: ya me contó una parte; solo pregunto lo que falta.'))
    if (faltaH || faltaA) {
      let preg
      if (faltaH && faltaA) preg = man ? tu('Ayer, ¿cómo te fue con la comida y con el hambre?', 'Ayer, ¿cómo le fue con la comida y con el hambre?') : tu('¿Cómo comiste hoy y cómo va el hambre, del 1 al 10?', '¿Cómo comió hoy y cómo va el hambre, del 1 al 10?')
      else if (faltaH) preg = man ? '¿Y el hambre de ayer, del 1 al 10?' : '¿Y cómo va el hambre, del 1 al 10?'
      else preg = man ? tu('¿Y cómo comiste ayer?', '¿Y cómo comió ayer?') : tu('¿Y cómo comiste hoy?', '¿Y cómo comió hoy?')
      const COMIO: Record<string, string> = { MALA: tu('comiste mal', 'comió mal'), REGULAR: tu('comiste regular', 'comió regular'), BUENA: tu('comiste bien', 'comió bien') }
      await correrTurno(tok, {
        id: 'mesa', noMarcar: faltaS, pregunta: preg, ejemplos: EJ.mesa,
        montar: () => [controlAclaracion(), faltaH && controlHambre(), faltaA && gAlimentacion()],
        auto: () => S.datos.hambreEscala != null && S.datos.alimentacion != null, min: () => S.datos.hambreEscala != null && S.datos.alimentacion != null,
        trasTexto: () => (S.datos.hambreEscala == null ? '¿Y el hambre, del 1 al 10?' : S.datos.alimentacion == null ? tu('¿Y cómo comiste?', '¿Y cómo comió?') : null),
        reflejo: () => (hablo(['hambreEscala', 'alimentacion']) ? tu('Tuviste hambre de ', 'Tuvo hambre de ') + S.datos.hambreEscala + ' y ' + COMIO[S.datos.alimentacion || ''] + '.' : null),
      })
    }
    if (S.datos.estres == null) {
      await correrTurno(tok, {
        id: 'mesa', pregunta: faltaH || faltaA ? '¿Y la cabeza, cómo está?' : '¿Y el estrés, cómo va?', ejemplos: EJ.mesa,
        montar: () => [controlAclaracion(), gEstres()],
        auto: () => S.datos.estres != null && !S.dudas.estres, min: () => S.datos.estres != null,
        trasTexto: () => (S.datos.estres == null ? '¿Y el estrés, bajo, medio o alto?' : null),
        reflejo: () => (hablo(['estres']) ? tu('Tienes el estrés ', 'Tiene el estrés ') + ETQ.estres[S.datos.estres || ''].toLowerCase() + '. Gracias por contármelo.' : null),
      })
    }
  },
  async profundo(tok) {
    S.turno = 'profundo'; Cab.arma()
    const d = S.datos
    const dosDias = d.estres === 'MUCHO' && E.estresAyer === 'mucho', duele = num(d.dolor) >= 4
    const razon = dosDias ? 'Van dos días con el estrés alto.' : duele ? 'Un ' + d.dolor + ' de dolor' + (d.dolorDonde ? ' en ' + conArticulo(d.dolorDonde) : '') + ' no es poco. Bryan lo revisa hoy.' : tu('Dormiste poco.', 'Durmió poco.')
    const invita = tu('¿Quieres contarme ', '¿Quiere contarme ') + (dosDias ? 'qué está pasando?' : duele ? 'cómo pasó?' : 'qué pasó anoche?')
    salto('Pregunto un poco más porque ' + (dosDias ? 'es el segundo día seguido con estrés alto.' : duele ? 'hoy hay dolor de 4 o más.' : tu('dormiste 5 horas o menos.', 'durmió 5 horas o menos.')))
    const pd = decir(razon + ' ' + invita, tok)
    pd.catch(() => {})
    await Promise.race([pd, esperar(reducido() ? 0 : 400)]); vigilar(tok)
    montar(() => chips([['Sí', 'si'], ['Ahora no', 'no']], (v) => emitir({ tipo: 'prof', v }), null, 'prof'))
    Cab.revisarBajas(); enfocarControles()
    const r = await esperaTipo(tok, ['prof'], convSiNo('prof', ['si', 'no']))
    cortarDecir(); await pd; limpiarControles()
    if (r.v === 'si') {
      await decir(tu('Cuéntame. Lo que escribas le llega tal cual a Bryan.', 'Cuénteme. Lo que escriba le llega tal cual a Bryan.'), tok)
      ponerSugerencias(EJ.profundo); $('#entrada').focus()
      montar(() => pieSeguir(true))
      const e = await esperaTipo(tok, ['texto', 'seguir'])
      limpiarControles()
      if (e.tipo === 'texto' && e.txt) {
        mostrarPersona(e.txt, e.fuente)
        anotar('comentarios', comentarioCon(e.txt), e.fuente || 'texto', e.txt)
        await decir('Gracias. Queda tal cual para Bryan.', tok)
      }
    } else await decir('Bueno.', tok)
    S.hechos.push('profundo'); guardarBorrador()
  },
  async nota(tok) {
    S.turno = 'nota'; Cab.arma()
    const pd = decir(tu('Una más, si quieres: ¿anoche usaste el celular en la cama?', 'Una más, si quiere: ¿anoche usó el celular en la cama?'), tok)
    pd.catch(() => {})
    await Promise.race([pd, esperar(reducido() ? 0 : 400)]); vigilar(tok)
    montar(() => chips<string | boolean>([['Sí', true], ['No', false], ['Saltar', 'saltar']], (v) => emitir({ tipo: 'nota', v }), null, 'nota'))
    Cab.revisarBajas(); enfocarControles()
    ponerSugerencias([])
    const r = await esperaTipo(tok, ['nota'], convSiNo('nota', [true, false]))
    cortarDecir(); await pd; limpiarControles()
    S.nota = r.v ?? null; Penta.render(); Onda.pulso()
    if (r.v !== 'saltar') guardar('notaFecha', HOY.fecha)
    if (r.v === 'saltar') await decir('Bueno.', tok)
    S.hechos.push('nota'); guardarBorrador()
  },
}

function textoFaltan(f: string[]): string { return (f.length > 1 || f[0] === 'las ganas' ? 'Nos faltan ' : 'Nos falta ') + listaY(f) + '.' }
export async function correrCheckin(): Promise<void> {
  cancelar()
  const tok = S.tok
  try {
    if (!S.t0) S.t0 = performance.now()
    Cab.arma()
    S.enFirma = false; S.cola = []; Onda.soltarFirma(); Onda.estado('reposo')
    if (!Cab.ayer) Onda.forma(S.datos)
    if (S.datos.estres) Onda.tension(S.datos.estres === 'MUCHO' ? 1.45 : S.datos.estres === 'REGULAR' ? 1.2 : 1)
    $('#btnRapido').setAttribute('aria-pressed', 'false')
    Penta.cerrar(); $('#penta').hidden = false; $('#muelle').hidden = false; $('#editor').hidden = true; limpiarControles(); renderSaltos(); compactar(false)
    const habia = hayDatos() || S.hechos.length > 0
    if (!S.hechos.includes('inicio')) {
      S.hechos.push('inicio')
      if (E.idea === 'no') salto('Hoy no hay idea pendiente de ayer.')
      if (E.franja === 'noche') salto('Como es de noche, el entreno y la comida son los de hoy.')
    }
    S.presentarPendiente = !habia && !leer('presentada', false) // la primera vez, Praxis dice quién es dentro de la primera frase (ver conSaludo)
    if (habia && S.hechos.length > 1) {
      const f = [...new Set(faltantes(S.datos).map((c) => NOMBRE[c]))]
      await decir(f.length && f.length <= 3 ? '¿Seguimos donde íbamos? ' + textoFaltan(f) : '¿Seguimos donde íbamos?', tok)
      S.saludoPendiente = false
    } else S.saludoPendiente = true
    for (;;) {
      for (const t of TURNOS_BASE) if (!S.hechos.includes(t) && turnoCompleto(t, S.datos) && hayDatos()) { S.hechos.push(t); salto('Me salto ' + NOMBRE_TURNO[t].toLowerCase() + tu(': ya me lo contaste.', ': ya me lo contó.')) }
      const p = siguientePregunta(S, E, segundos())
      if (p === 'firma') { if (!S.hechos.includes('nota')) { S.hechos.push('nota'); salto('La pregunta de la semana queda para otro día.') } break }
      await TURNOS[p](tok)
    }
    await faseFirma(tok)
    await faseEco(tok)
  } catch (e) { if (!(e instanceof Cancelado)) throw e }
}
