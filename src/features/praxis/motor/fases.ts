import { renderBienestar } from './bienestar'
import { Cab, alInicio, compactar, enfocarControles, limpiarControles, montar, mostrarControles, refrescar, retirarControles } from './cabecera'
import { gAlimentacion, gCalidad, gCansancio, gEstres, gGanas, gRendimiento } from './controles'
import { avisoBryan, botonListo, controlDolor, controlHambre, filaComentarios, filaPasos, filaPeso, irAlHueco, rotuloBryan } from './controlesCuerpo'
import { FIRMAS_PREVIAS, HOY, NOMBRE, USUARIO, type Campo } from './datos'
import { $, aviso, h } from './dom'
import { borrarClave, reducido, tieneAnimate, tu } from './entorno'
import { decir, decirCorto, fijarFrase, ponerSugerencias } from './frase'
import { elegirIdea, reflejoDelDia } from './idea'
import { siNo } from './interpretar'
import { DUR, EASE, esperar, num } from './movimiento'
import { Onda } from './onda'
import { Penta } from './penta'
import { respirar } from './respirar'
import { cerrarSala } from './sala'
import { renderSaltos, salto } from './senales'
import { Cancelado, Dia, E, S, cancelar, cortarDecir, emitir, esperaCon, faltantes, fijarHecho, hoyReal, refDe, vigilar, type Registro } from './sesion'
import { esperaTipo, procesarTexto } from './turnos'
import { numPalabra } from './texto'
import { Voz, sonarEco } from './voz'

/* ——— La firma: confirmación editable. Nada se escribe antes de LISTO ——— */
export function actualizarFirma(): void { S.reflejo = reflejoDelDia(S.datos) }
function controlesFirma(): (Node | false)[] {
  return [filaPasos(), E.peso === 'si' && filaPeso(), filaComentarios(),
    h('div', { class: 'reflejo' }, h('span', { class: 'marca-ejemplo' }, 'Lo que entendí · ejemplo'), h('p', null, S.reflejo)),
    botonListo()]
}
function alHueco(): void { const f = faltantes(S.datos); irAlHueco(f.length ? NOMBRE[f[0]] : undefined) }
export async function faseFirma(tok: number): Promise<void> {
  S.turno = 'firma'; Cab.pendiente = false
  await retirarControles(); vigilar(tok)
  compactar(false); alInicio(); $('#dijo').textContent = ''
  await Onda.firmar(S.datos); vigilar(tok)
  S.enFirma = true; Penta.abrir()
  if (E.peso === 'no') salto(tu('No te pido el peso: tu plan no lo tiene activo.', 'No le pido el peso: su plan no lo tiene activo.'))
  actualizarFirma()
  await decir(tu('Así queda tu día. Toca cualquier nota si algo no cuadra.', 'Así queda su día. Toque cualquier nota si algo no cuadra.'), tok)
  montar(controlesFirma); enfocarControles()
  ponerSugerencias([])
  for (;;) {
    const e = await esperaCon(tok, null)
    if (e.tipo === 'listo') { if (!faltantes(S.datos).length) break; alHueco(); continue }
    if (e.tipo === 'texto') { await procesarTexto(e, tok); void Onda.firmar(S.datos); actualizarFirma(); refrescar() }
  }
}

/* ——— El eco: el agujero absorbe la firma y la devuelve como un anillo ——— */
/** Lo que SE GUARDARÍA. En esta entrega no se guarda nada en la base: se enseña como ejemplo. */
function registroParaGuardar(): Registro {
  const datos: Record<string, unknown> = {}
  ;(['calidadSueno', 'cansancio', 'horasSueno', 'horaAcostarse', 'horaLevantarse', 'entreno', 'rendimiento', 'motivacion', 'dolor', 'dolorDonde', 'hambreEscala', 'alimentacion', 'estres', 'pasos', 'comentarios'] as Campo[]).forEach((c) => { if (S.datos[c] != null) datos[c] = S.datos[c] })
  const fuentes: Record<string, string> = {}, referencia: Record<string, string> = {}, citas: Record<string, string> = {}
  Object.keys(datos).forEach((c) => { fuentes[c] = S.fuentes[c] || 'toque'; referencia[c] = S.ref[c] || refDe(c); if (S.citas[c] && fuentes[c] !== 'toque') citas[c] = S.citas[c] })
  if (S.peso != null) { datos.pesoKg = S.peso; fuentes.pesoKg = 'toque'; referencia.pesoKg = 'hoy' }
  Object.assign(datos, { origen: 'conversacion', fuentes, referencia, citas, firma_v: 1 })
  if (S.nota === true || S.nota === false) datos.nota_semana = { pregunta: 'V1', valor: S.nota }
  if (S.hilo && S.hilo !== 'saltar') datos.idea_ayer = S.hilo
  if (S.senales.length) datos.senales = S.senales.map((x) => ({ tipo: x.tipo, frase: x.frase }))
  if (S.ideaTexto) datos.idea = { texto: S.ideaTexto, area: S.idea ? S.idea.area : null, dificultad: S.confianza }
  return { tabla: 'checkins', id: 'ck-' + USUARIO + '-' + HOY.fecha, usuario_id: USUARIO, fecha: HOY.fecha, datos }
}
function guardarHecho(idea: string | null): void {
  S.registro = registroParaGuardar()
  fijarHecho({ datos: { ...S.datos }, idea, registro: S.registro, dia: hoyReal() })
}
function escucharDia(btn: HTMLElement | null): void {
  const ok = sonarEco(S.datos, (p) => Onda.cursor(p))
  if (btn) { btn.setAttribute('aria-pressed', 'true'); setTimeout(() => btn.setAttribute('aria-pressed', 'false'), 2600) }
  if (!ok) {
    aviso(tu('Este navegador no puede sonar aquí. El punto recorre tu firma igual.', 'Este navegador no puede sonar aquí. El punto recorre su firma igual.'))
    const t0 = performance.now()
    const paso = () => { const p = (performance.now() - t0) / 2500; if (p < 1) { Onda.cursor(p); requestAnimationFrame(paso) } else Onda.cursor(-1) }
    requestAnimationFrame(paso)
  }
}
const asiSono = () => tu('Así sonó tu ', 'Así sonó su ') + HOY.dia + '.'
function bloqueEco(): HTMLElement {
  const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-k': 'escucha' }, tu('Escucha tu día', 'Escuche su día'))
  b.addEventListener('click', () => escucharDia(b))
  return h('div', { class: 'eco-bloque' }, h('span', { class: 'titulo-eco' }, asiSono()), h('span', { class: 'xp' }, 'Firma ' + (FIRMAS_PREVIAS + 1)), b,
    h('span', { class: 'marca-ejemplo' }, tu('El sonido solo sale si lo tocas', 'El sonido solo sale si lo toca')))
}
function detallesGuardado(): HTMLElement {
  const reg = S.registro || registroParaGuardar()
  return h('details', { class: 'guardado' }, h('summary', null, tu('Lo que se guardaría en tu check-in (ejemplo)', 'Lo que se guardaría en su check-in (ejemplo)')), h('pre', null, JSON.stringify(reg, null, 2)))
}
export async function faseEco(tok: number): Promise<void> {
  S.listo = true; S.enFirma = false; Voz.callar(); compactar(false)
  guardarHecho(null)
  borrarClave('borrador')
  /* Antes del momento más alto del día, silencio: la frase, el pentagrama, el muelle y los controles salen juntos en 160 ms (--ease-salida) y hay un hueco limpio de 120 ms;
     solo entonces el agujero absorbe la firma. Con movimiento reducido no hay salida: se quitan de una vez. */
  $('#editor').hidden = true
  const sale: Animation[] = []
  if (tieneAnimate() && !reducido()) for (const el of [$('#dicho'), $('#penta'), $('#muelle')]) if (!el.hidden) sale.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.toque, easing: EASE.salida, fill: 'forwards' }))
  try {
    await retirarControles(); vigilar(tok)
    Penta.cerrar(); $('#penta').hidden = true; $('#muelle').hidden = true; renderSaltos()
    $('#frase').textContent = ''; $('#dijo').textContent = ''
  } finally { sale.forEach((a) => a.cancel()) } // si se cancela a medias (cerrar la sala), nada queda a opacidad 0
  await Onda.eco(S.datos); vigilar(tok)
  await decir(asiSono() + ' Bryan lo revisa hoy.', tok)
  montar(() => [bloqueEco()])
  if ($<HTMLInputElement>('#cSonido').checked) escucharDia(null)
  await esperar(500); vigilar(tok)
  await faseIdea(tok)
}

/* Un solo gesto pide permiso y ofrece: Me la llevo · Otra más pequeña · Hoy no. Ya llevada, dos botones dicen cómo se ve. */
function tarjetaIdea(llevada: boolean): HTMLElement {
  const idea = S.idea
  const box = h('div', { class: 'idea' }, h('span', { class: 'marca-ejemplo' }, llevada ? tu('Te la llevas', 'Se la lleva') : tu('Tu idea para hoy · sale de tus respuestas', 'Su idea para hoy · sale de sus respuestas')), h('p', { class: 'idea-txt' }, S.ideaTexto))
  const acc = h('div', { class: 'acciones' })
  const boton = (k: string, txt: string, v: string) => h('button', { type: 'button', class: 'chip', 'data-k': k, onclick: () => emitir({ tipo: 'idea2', v }) }, txt)
  if (!idea) return box
  if (!llevada) {
    acc.append(h('button', { type: 'button', class: 'btn-plata', 'data-k': 'llevo', onclick: () => emitir({ tipo: 'idea2', v: 'llevo' }) }, 'Me la llevo'))
    if (S.ideaTexto !== idea.pequena) acc.append(boton('pequena', 'Otra más pequeña', 'pequena'))
    if (idea.probar) acc.append(boton('probar', 'Probar ahora', 'probar'))
    acc.append(boton('hoyno', 'Hoy no', 'no'))
  } else if (!idea.fija && idea.area !== 'ninguna') {
    box.append(h('span', { class: 'marca-ejemplo' }, tu('¿Cómo la ves para hoy?', '¿Cómo la ve para hoy?')))
    acc.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.confianza === 'facil'), 'data-k': 'facil', onclick: () => valorarIdea('facil') }, 'Fácil'),
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.confianza === 'cuesta'), 'data-k': 'cuesta', onclick: () => valorarIdea('cuesta') }, 'Me cuesta'))
  }
  if (acc.children.length) box.append(acc)
  if (idea.bryan) box.append(h('button', { type: 'button', class: 'btn-rojo-borde', onclick: avisoBryan }, rotuloBryan()))
  return box
}
function valorarIdea(v: string): void {
  S.confianza = v; Onda.pulso()
  const pequena = S.idea && S.idea.pequena
  if (v === 'cuesta' && pequena && S.ideaTexto !== pequena) { S.ideaTexto = pequena; decirCorto('Entonces la dejamos más pequeña.') }
  else decirCorto(v === 'facil' ? 'Bien. Que sea así de simple.' : 'Es normal que cueste. Con hacerla una vez basta.')
  guardarHecho(S.ideaTexto); refrescar(); renderBienestar()
}
async function faseIdea(tok: number): Promise<void> {
  const idea = elegirIdea(S.datos, E.franja === 'manana')
  S.idea = idea; S.ideaTexto = idea.texto
  if (idea.area === 'ninguna') {
    montar(() => [bloqueEco(), tarjetaIdea(true)]); mostrarControles()
    await decir(tu('Hoy nada nuevo: sigue como vas.', 'Hoy nada nuevo: siga como va.'), tok)
    return cierreFinal()
  }
  montar(() => [bloqueEco(), tarjetaIdea(false)]); mostrarControles()
  const pd = decir(tu('Una idea para hoy, si te sirve. ', 'Una idea para hoy, si le sirve. ') + S.ideaTexto, tok)
  pd.catch(() => {})
  for (;;) {
    const e = await esperaTipo(tok, ['idea2'], (t) => { const v = siNo(t); return v == null ? null : { tipo: 'idea2', v: v ? 'llevo' : 'no' } })
    cortarDecir(); await pd
    if (e.v === 'llevo') break
    if (e.v === 'no') { S.ideaTexto = null; await decir('Listo.', tok); return cierreFinal() }
    if (e.v === 'pequena') { S.ideaTexto = idea.pequena; refrescar(); decirCorto(idea.pequena) }
    if (e.v === 'probar') { await respirar(); vigilar(tok); decirCorto(tu('Así de corta. ¿Te la llevas?', 'Así de corta. ¿Se la lleva?')) }
  }
  montar(() => [bloqueEco(), tarjetaIdea(true)])
  await decir(tu('Listo, queda contigo.', 'Listo, queda con usted.'), tok)
  cierreFinal()
}
function controlesFinales(): (Node | false | null)[] {
  return [bloqueEco(), !!S.ideaTexto && tarjetaIdea(true), detallesGuardado(),
    h('button', { type: 'button', class: 'btn-plata', 'data-k': 'volver', onclick: () => cerrarSala() }, 'Volver a Bienestar')]
}
function cierreFinal(): void {
  guardarHecho(S.ideaTexto)
  montar(controlesFinales)
  renderBienestar()
}
export function mostrarDiaHecho(): void {
  const hecho = Dia.hecho
  if (!hecho) return
  S.listo = true; S.datos = { ...hecho.datos }; S.ideaTexto = hecho.idea; S.registro = hecho.registro
  S.idea = { area: '', pequena: hecho.idea, fija: true }
  $('#penta').hidden = true; $('#muelle').hidden = true; $('#saltos').hidden = true; $('#editor').hidden = true; compactar(false)
  void Onda.eco(S.datos)
  fijarFrase(asiSono())
  montar(controlesFinales)
}

/* ——— Modo rápido: los obligatorios que falten, juntos ——— */
function controlesRapido(): Node[] {
  const B: Partial<Record<Campo, () => Node | Node[]>> = { calidadSueno: gCalidad, cansancio: gCansancio, rendimiento: gRendimiento, motivacion: gGanas, dolor: controlDolor, hambreEscala: controlHambre, alimentacion: gAlimentacion, estres: gEstres }
  const out: Node[] = []
  S.rapidoCampos.forEach((c) => { const b = B[c]; if (b) out.push(...([] as Node[]).concat(b())) })
  out.push(botonListo())
  return out
}
export async function modoRapido(): Promise<void> {
  if (S.listo || S.quieta || S.cuidado || $('#sala').hidden) return
  cancelar()
  const tok = S.tok
  try {
    if (!S.t0) S.t0 = performance.now()
    $('#btnRapido').setAttribute('aria-pressed', 'true')
    S.enFirma = false; Onda.soltarFirma(); Onda.estado('reposo'); Penta.cerrar(); $('#editor').hidden = true; limpiarControles()
    S.turno = 'rapido'
    S.rapidoCampos = faltantes(S.datos).filter((c) => c !== 'dolorDonde')
    if (num(S.datos.dolor) > 0 && !S.datos.dolorDonde && !S.rapidoCampos.includes('dolor')) S.rapidoCampos.push('dolor')
    salto('Modo rápido: solo lo que falta y es obligatorio.')
    const n = S.rapidoCampos.length
    await decir(n ? 'Modo rápido: ' + (n === 1 ? 'un toque' : numPalabra(n) + ' toques') + ' y listo.' : tu('Modo rápido: ya está todo. Toca LISTO.', 'Modo rápido: ya está todo. Toque LISTO.'), tok)
    montar(controlesRapido); compactar(true); mostrarControles(); enfocarControles()
    for (;;) {
      const e = await esperaCon(tok, null)
      if (e.tipo === 'listo') { if (!faltantes(S.datos).length) break; alHueco(); continue }
      if (e.tipo === 'texto') await procesarTexto(e, tok)
    }
    await faseEco(tok)
  } catch (e) { if (!(e instanceof Cancelado)) throw e }
}
