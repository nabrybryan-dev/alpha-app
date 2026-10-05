import type { DatosDia } from './datos'
import { tu } from './entorno'
import { num } from './movimiento'
import { cap, fmtNum, listaY, normalizar } from './texto'

/**
 * La idea de ayer se dice con naturalidad. Si empieza por un infinitivo, se conjuga en
 * condicional («quedamos en que dejarías…»; irregulares y pronominales incluidos). Si viene
 * en otra forma, va después de dos puntos, sin comillas pegadas en medio de la oración.
 */
const COND_IRREG: Record<string, string> = { hacer: 'har', poner: 'pondr', salir: 'saldr', tener: 'tendr', decir: 'dir', poder: 'podr', venir: 'vendr', querer: 'querr', saber: 'sabr', valer: 'valdr', caber: 'cabr' }
/* Palabras en -ar/-er/-ir que no son verbos (y que pueden abrir una idea). Un infinitivo nunca lleva tilde, salvo en -ír (reír, oír). */
const NO_VERBO = /^(celular|lugar|hogar|mujer|ayer|placer|mar|par|bar|familiar|collar|altar|militar|particular|regular|popular|similar|solar|lunar|polar|escolar|muscular|bienestar|taller|alfiler|elixir|pilar|azar|radar|dolar|poder|deber)$/

function partirIdea(idea: string): { inf: string; se: boolean; resto: string } | null {
  const m = /^(\S+?)(ar|er|ir|ír)(se)?(\s.*)?$/i.exec((idea || '').trim())
  if (!m) return null
  const inf = (m[1] + m[2]).toLowerCase()
  if (NO_VERBO.test(inf) || /[áéíóú]/.test(m[1])) return null
  const resto = (m[4] || '').replace(/\b([a-zñ]+?(?:ar|er|ir|ír))se\b/gi, (_x, v: string) => v + tu('te', 'se')) // «al levantarse» → «al levantarte» en tú
  return { inf, se: !!m[3], resto }
}
function condicional(inf: string): string { return (COND_IRREG[inf] || inf.replace(/ír$/, 'ir')) + tu('ías', 'ía') }
/* En condicional, los infinitivos coordinados también se conjugan: «te acostarías temprano y te levantarías sin afán» */
function ideaCondicional(idea: string): string | null {
  const p = partirIdea(idea)
  if (!p) return null
  const resto = p.resto.replace(/\by\s+([a-zñ]+?(?:ar|er|ir|ír))(te|se)?\b/gi, (x, inf: string, se?: string) => (NO_VERBO.test(inf.toLowerCase()) ? x : 'y ' + (se ? tu('te ', 'se ') : '') + condicional(inf.toLowerCase())))
  return (p.se ? tu('te ', 'se ') : '') + condicional(p.inf) + resto
}
function ideaInfinitivo(idea: string): string | null { const p = partirIdea(idea); if (!p) return null; return p.inf + (p.se ? tu('te', 'se') : '') + p.resto }
export function preguntaIdea(idea: string): string {
  const c = ideaCondicional(idea)
  return c ? 'Ayer quedamos en que ' + c + '. ' + tu('¿Pudiste hacerlo?', '¿Pudo hacerlo?') : 'Ayer quedamos en una idea: ' + idea + '. ' + tu('¿Pudiste hacerla?', '¿Pudo hacerla?')
}
export function preguntaIdeaCorta(idea: string): string { const i = ideaInfinitivo(idea); return i ? tu('¿Pudiste ', '¿Pudo ') + i + '?' : tu('¿Pudiste hacer lo que quedamos ayer?', '¿Pudo hacer lo que quedamos ayer?') }

export function conArticulo(z: string): string {
  const n = normalizar(z)
  if (/^(la|el|mi) /.test(n)) return z
  if (n.startsWith('lumbar')) return 'la zona lumbar'
  return (/^(rodilla|espalda|cadera|muneca|pantorrilla|planta)/.test(n) ? 'la ' : 'el ') + z
}

/* ——— El reflejo del día: lo que Praxis entendió, sin culpa ——— */
const asiTuDia = () => tu('Así se ve tu día. Gracias por contármelo.', 'Así se ve su día. Gracias por contármelo.')
function verificarCulpa(s: string): string { return /deberias|fallaste|no cumpliste|perdiste|culpa|disciplina|flojera|otra vez no/.test(normalizar(s)) ? asiTuDia() : s }
export function reflejoDelDia(d: DatosDia): string {
  const p: string[] = []
  if (d.estres === 'MUCHO') p.push(/pesad/.test(normalizar(d.comentarios || '')) ? 'una semana pesada' : 'el estrés alto')
  if (d.motivacion === 'POCO') p.push('pocas ganas')
  let s = p.length ? tu('Tienes ', 'Tiene ') + listaY(p) : ''
  if (d.rendimiento === 'BUENA' && d.entreno && d.entreno !== 'Descansé') s += (s ? ', y aun así ' : '') + (d.entreno === 'LEG A' ? 'la pierna' : 'el entreno') + tu(' te salió bien', ' le salió bien')
  s = s ? cap(s) + '.' : ''
  if (d.horasSueno != null && d.horasSueno <= 6.5) s += ' Bryan va a tener en cuenta ' + tu('tus ', 'sus ') + fmtNum(d.horasSueno) + ' horas de sueño para la sesión.'
  else if (num(d.dolor) >= 4) s += ' Bryan revisa hoy lo del dolor.'
  s = s.trim()
  return verificarCulpa(s || asiTuDia())
}

/* ——— UNA idea para hoy: la elige una regla; el texto es de ejemplo ——— */
export interface IdeaElegida { area: string; texto: string; pequena: string; probar?: boolean; bryan?: boolean }
export function elegirIdea(d: DatosDia, man: boolean): IdeaElegida {
  const nada = tu('Hoy nada nuevo: sigue como vas.', 'Hoy nada nuevo: siga como va.')
  if (num(d.dolor) >= 7) return { area: 'cuerpo', texto: 'Hoy nada nuevo con el cuerpo: sin ejercicio extra.', pequena: nada, bryan: true }
  const pesos: Record<string, number> = { mente: d.estres === 'MUCHO' ? 3 : d.estres === 'REGULAR' ? 1 : 0, sueno: (d.horasSueno != null && d.horasSueno <= 6 ? 2.5 : 0) + (d.calidadSueno === 'MALA' ? 1 : 0), energia: d.cansancio === 'MUCHO' ? 1.2 : 0 }
  const [area, peso] = Object.entries(pesos).sort((a, b) => b[1] - a[1])[0]
  if (peso <= 0) return { area: 'ninguna', texto: nada, pequena: nada }
  const cat: Record<string, Omit<IdeaElegida, 'area'>> = {
    mente: man ? { texto: tu('Después de servir el café, respira tres veces.', 'Después de servir el café, respire tres veces.'), pequena: 'Una sola respiración después del café.', probar: true } : { texto: tu('Al apagar la luz, respira lento tres veces.', 'Al apagar la luz, respire lento tres veces.'), pequena: 'Una sola respiración al apagar la luz.', probar: true },
    sueno: { texto: tu('Cuando conectes el celular en la cocina, empieza a bajar las luces.', 'Cuando conecte el celular en la cocina, empiece a bajar las luces.'), pequena: tu('Esta noche, solo deja el celular fuera del cuarto.', 'Esta noche, solo deje el celular fuera del cuarto.') },
    energia: man ? { texto: tu('Al salir de casa, camina 10 minutos al sol antes de las 10.', 'Al salir de casa, camine 10 minutos al sol antes de las 10.'), pequena: tu('Toma dos minutos de luz de día junto a la ventana.', 'Tome dos minutos de luz de día junto a la ventana.') } : { texto: tu('Mañana, al salir de casa, camina 10 minutos al sol antes de las 10.', 'Mañana, al salir de casa, camine 10 minutos al sol antes de las 10.'), pequena: tu('Mañana, toma dos minutos de luz de día junto a la ventana.', 'Mañana, tome dos minutos de luz de día junto a la ventana.') },
  }
  return { area, ...cat[area] }
}
