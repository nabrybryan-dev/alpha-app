/**
 * Simulacro del ingreso por voz: 20 personas inventadas del corpus SINTÉTICO, hablando, pasadas por el extractor.
 *
 *   npx vite-node scripts/banco-ingreso/banco.mts -- [--n 20] [--semilla 42] [--paralelo 4] [--mutante mudo|inventor]
 *
 * Qué hace (todo con `claude -p --model haiku`, el patrón de correr_modelo.py; sin API con claves, sin tocar
 * producción ni la landing; el corpus se lee y nada más):
 *   1. Elige N encuestas del corpus con semilla fija y variadas (voraz sobre rasgos).
 *   2. De las respuestas verdaderas saca, por turno, cómo lo diría una persona hablando (Haiku, con muletillas,
 *      a veces desordenado o incompleto). Un 15 % de los datos NO se le da: esa persona no lo dijo.
 *      Si la persona tiene un dato de salud, se le escapa de pasada en el turno 3 (la trampa de la regla dura).
 *   3. Cada habla pasa por el extractor REAL (`extraer.ts`: prompt + validación de citas) y se compara con la verdad.
 *   4. Mide tiempo (hablar vs escribir) y escribe RESULTADO.md.
 *
 * Caché: cada respuesta del modelo se guarda por (prompt, entrada) en `cache.json`; repetir no gasta.
 * `--mutante mudo|inventor` NO llama al extractor: comprueba que el medidor se pone rojo (ver README al pie de RESULTADO.md).
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TURNOS_VOZ, campoPorId, type CampoIngreso, type TurnoId,
} from '../../src/domain/praxis/ingreso/guion.ts'
import {
  PROMPT_SISTEMA_INGRESO, VERSION_PROMPT_INGRESO, armarMensajeIngreso, juntarTurnos, leerSalidaIngreso,
  marcarSaludPorDiccionario, validarIngreso, type ResultadoIngreso, type ValorIngreso,
} from '../../src/domain/praxis/ingreso/extraer.ts'
import { escanearNumeros, normalizarTexto } from '../../src/domain/praxis/registro/numeros.ts'

const AQUI = dirname(fileURLToPath(import.meta.url))
const CORPUS = 'C:/Users/ASUS/dev/cerebro-alpha/agentes/entrenamiento/material/1000_encuestas_complejas_v2.json'
const CACHE = join(AQUI, 'cache.json')
const CWD_NEUTRO = 'F:/wt/tmp-ingreso/cwd' // sin CLAUDE.md alrededor

// ───────────── argumentos ─────────────
const arg = (nombre: string, def: string): string => {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const N = Number(arg('n', '20'))
const SEMILLA = Number(arg('semilla', '42'))
const PARALELO = Number(arg('paralelo', '4'))
const MUTANTE = arg('mutante', '') as '' | 'mudo' | 'inventor'
const P_OMITIR = 0.15
const NOMBRE_SALIDA = arg('salida', 'RESULTADO.md')
const SALIDA = join(AQUI, NOMBRE_SALIDA)
const RESULTADOS_JSON = join(AQUI, NOMBRE_SALIDA.replace(/\.md$/, '.json'))

// ───────────── azar con semilla ─────────────
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 20)

// ───────────── el corpus y la verdad ─────────────
type Respuestas = Record<string, unknown>
interface Encuesta { person: { id: string }; client_intake: { answers: Respuestas } }

const vacio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim())
const noEsNo = (v: unknown) => !vacio(v) && !/^\s*(no|ninguna?)\b/i.test(String(v))

/** Verdad de los campos de VOZ, en los ids del guion. `null` = la encuesta no trae el dato. */
function verdadDeVoz(a: Respuestas): Record<string, string | number | null> {
  const nf = String(a.nivel_fuerza ?? '').trim()
  const [nivel, ...cola] = nf.split(' - ')
  const num = (v: unknown) => (vacio(v) || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    ciudad: vacio(a.ciudad) ? null : String(a.ciudad),
    edad: num(a.edad),
    altura_cm: num(a.altura_cm),
    peso_actual_kg: num(a.peso_actual_kg),
    objetivo_principal: vacio(a.objetivo_principal) ? null : String(a.objetivo_principal),
    parte_a_mejorar: vacio(a.parte_a_mejorar) ? null : String(a.parte_a_mejorar),
    peso_objetivo_kg: num(a.peso_objetivo_kg),
    tiempo_entrenando: vacio(a.tiempo_entrenando) ? null : String(a.tiempo_entrenando),
    nivel_fuerza: ['Principiante', 'Intermedio', 'Avanzado'].includes(nivel) ? nivel : null,
    marcas_fuerza: cola.length ? cola.join(' - ') : null,
    tipo_trabajo: vacio(a.tipo_trabajo) ? null : String(a.tipo_trabajo),
    dia_tipo_alimentacion: vacio(a.dia_tipo_alimentacion) ? null : String(a.dia_tipo_alimentacion),
    vasos_agua: vacio(a.vasos_agua) ? null : String(a.vasos_agua),
    cocina_o_compra: null, // el corpus no lo trae: cualquier valor extraído es INVENTADO
  }
}

interface SaludVerdadera { tipo: 'lesion' | 'medicacion' | 'limitacion'; texto: string }
function saludDe(a: Respuestas): SaludVerdadera[] {
  const s: SaludVerdadera[] = []
  if (noEsNo(a.lesiones)) s.push({ tipo: 'lesion', texto: String(a.lesiones) })
  if (noEsNo(a.medicacion)) s.push({ tipo: 'medicacion', texto: String(a.medicacion) })
  if (noEsNo(a.ejercicios_limitados)) s.push({ tipo: 'limitacion', texto: String(a.ejercicios_limitados) })
  return s
}

/** De un texto verdadero, las cláusulas SIN salud (lo que sí puede quedar en el formulario). */
function sinSalud(texto: string): string | null {
  const trozos = texto.split(/\.\s+|;\s*|,\s*(?:pero|aunque)\s+|\s+(?:pero|aunque)\s+/i).map((t) => t.trim().replace(/\.$/, '')).filter(Boolean)
  const limpios = trozos.filter((t) => marcarSaludPorDiccionario(t).marcas.length === 0)
  return limpios.length ? limpios.join('. ') : null
}

function cargarMuestra(): Encuesta[] {
  const todo = JSON.parse(readFileSync(CORPUS, 'utf-8')) as Encuesta[]
  const azar = mulberry32(SEMILLA)
  const orden = todo.map((e, i) => ({ e, i, r: azar() })).sort((x, y) => x.r - y.r).map((x) => x.e)
  const rasgos = (e: Encuesta): string[] => {
    const a = e.client_intake.answers
    const r = [
      `obj:${a.objetivo_principal}`, `trab:${a.tipo_trabajo}`, `tiempo:${a.tiempo_entrenando}`, `gen:${a.genero}`,
      `les:${noEsNo(a.lesiones)}`, `med:${noEsNo(a.medicacion)}`, `lim:${noEsNo(a.ejercicios_limitados)}`,
      `dias:${typeof a.dias_por_semana === 'number' ? 'num' : 'raro'}`, `dia:${!vacio(a.dia_tipo_alimentacion)}`,
      `agua:${!vacio(a.vasos_agua)}`, `edad:${!vacio(a.edad)}`, `aut:${!vacio(a.nivel_autopercibido)}`,
      `nf:${String(a.nivel_fuerza ?? '').split(' - ')[0] || 'vacio'}`, `cad:${a.cadencia_revision}`,
    ]
    const pm = verdadDeVoz(a).parte_a_mejorar
    r.push(`pm:${typeof pm === 'string' && marcarSaludPorDiccionario(pm).marcas.length > 0 ? 'salud' : 'libre'}`)
    return r
  }
  const cubiertos = new Set<string>()
  const elegidas: Encuesta[] = []
  const candidatas = orden.slice(0, 400)
  while (elegidas.length < N && candidatas.length) {
    let mejor = 0, puntos = -1
    candidatas.forEach((e, i) => {
      const p = rasgos(e).filter((x) => !cubiertos.has(x)).length
      if (p > puntos) { puntos = p; mejor = i }
    })
    const [e] = candidatas.splice(mejor, 1)
    rasgos(e).forEach((x) => cubiertos.add(x))
    elegidas.push(e)
  }
  return elegidas
}

// ───────────── el modelo (claude -p) con caché ─────────────
interface Salida { texto: string; costo: number; ms: number }
let cache: Record<string, Salida> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf-8')) : {}
let llamadasNuevas = 0

function llamarClaude(sistema: string, entrada: string): Promise<Salida> {
  return new Promise((resolver) => {
    const t0 = Date.now()
    const p = spawn(
      'claude',
      ['-p', '--model', 'haiku', '--tools', '', '--strict-mcp-config', '--output-format', 'json', '--no-session-persistence', '--system-prompt', sistema],
      { cwd: CWD_NEUTRO, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MAX_THINKING_TOKENS: '0' } },
    )
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    const reloj = setTimeout(() => p.kill(), 120_000)
    p.on('close', () => {
      clearTimeout(reloj)
      try {
        const j = JSON.parse(out) as { result?: string; total_cost_usd?: number; duration_ms?: number }
        resolver({ texto: j.result ?? '', costo: j.total_cost_usd ?? 0, ms: j.duration_ms ?? Date.now() - t0 })
      } catch {
        resolver({ texto: '', costo: 0, ms: Date.now() - t0 })
      }
    })
    p.stdin.end(entrada)
  })
}

async function conCache(clase: 'gen' | 'ext', sistema: string, entrada: string, valido: (t: string) => boolean): Promise<Salida> {
  const k = `${clase}:${sha(sistema + '\u0000' + entrada)}`
  if (cache[k] && valido(cache[k].texto)) return cache[k]
  for (let intento = 0; intento < 3; intento++) {
    const r = await llamarClaude(sistema, entrada)
    llamadasNuevas++
    if (valido(r.texto)) {
      cache[k] = r
      writeFileSync(CACHE, JSON.stringify(cache, null, 1), 'utf-8')
      return r
    }
  }
  return { texto: '', costo: 0, ms: 0 }
}

async function pool<T, R>(items: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const j = i++; res[j] = await f(items[j], j) }
  }))
  return res
}

// ───────────── generar el habla ─────────────
const PROMPT_HABLA = `Simulas a una persona real contestando POR VOZ (una nota de voz al celular) una pregunta de una guía de hábitos de un gimnasio en Colombia. Te doy la pregunta, un estilo y los DATOS VERDADEROS de la persona para este turno. Di cómo lo diría ella, de corrido.

REGLAS
- Primera persona, español colombiano coloquial y en tú. Como habla la gente: muletillas («pues», «eh», «o sea», «mmm», «la verdad», «ahí»), frases sueltas, algún tropiezo; a veces desordenado o con un dato a medias.
- Menciona CADA dato verdadero que te doy, con tus palabras (no copies las etiquetas ni uses el texto de las opciones tal cual: parafrasea como lo diría alguien).
- Los números se dicen como se dicen hablando: a veces con palabras («treinta y un años», «uno sesenta y seis»), a veces con cifras, a veces redondeados con «como» o «más o menos» si es natural (un kilo o un año de diferencia, no más).
- NO agregues ningún dato que no te doy: nada de edad, ciudad, peso, estatura, trabajo, entreno, comida, salud, nombres ni horarios que no estén en los datos. Si la pregunta toca algo para lo que no tienes dato, NO lo menciones ni de pasada ni con vaguedades («a mi manera», «ahí voy»): sáltatelo por completo o di en pocas palabras que de eso no hablas.
- Si te doy un «dato de salud que se te escapa», lo dices de pasada, con naturalidad, en tus palabras.
- Largo natural de una nota de voz: unas 6 a 14 palabras por cada dato que digas (contando las muletillas), nunca más de 80 en total; si casi no hay datos, una frase corta. Responde SOLO con lo que diría en voz alta: sin comillas, sin acotaciones, sin explicaciones.`

const ESTILOS = [
  'directo y breve',
  'hablador: se va por las ramas pero dice todo lo que le piden',
  'algo nervioso: frases a medias, se corrige a mitad de frase',
  'relajado y muy coloquial (paisa o costeño)',
  'apurado, habla rápido y junta las ideas sin pausa',
]

function describirDato(id: string, v: string | number): string {
  switch (id) {
    case 'ciudad': return `ciudad donde vive: ${v}`
    case 'edad': return `edad: ${v} años`
    case 'altura_cm': return `estatura: ${v} cm`
    case 'peso_actual_kg': return `peso actual: ${v} kg`
    case 'peso_objetivo_kg': return `peso al que quiere llegar: ${v} kg`
    case 'objetivo_principal': return `lo que quiere lograr (etiqueta del formulario, parafrasea): «${v}»`
    case 'parte_a_mejorar': return `lo que quiere mejorar, dicho a su manera: «${v}»`
    case 'tiempo_entrenando': return `hace cuánto entrena (etiqueta del formulario, parafrasea): «${v}»`
    case 'nivel_fuerza': return `el nivel que dices tener (con tus palabras): ${v}`
    case 'marcas_fuerza': return `pesos que levanta: ${v}`
    case 'tipo_trabajo': return `su trabajo (etiqueta del formulario, parafrasea): «${v}»`
    case 'dia_tipo_alimentacion': return `cómo es su día/semana: «${v}»`
    case 'vasos_agua': return `cuánta agua toma: «${v}»`
    default: return `${id}: ${v}`
  }
}

interface Turno {
  turno: TurnoId
  habla: string
  palabras: number
  dichos: string[] // campos que se le dieron a decir
  saludDicha: SaludVerdadera | null
  costoGen: number
  msExt: number
  costoExt: number
  brutoExt: string
  resultado: ResultadoIngreso
}

interface Persona {
  idx: number
  id: string
  estilo: string
  respuestas: Respuestas
  verdad: Record<string, string | number | null>
  omitidas: string[]
  salud: SaludVerdadera[]
  turnos: Turno[]
}

const contarPalabras = (t: string) => t.split(/\s+/).filter(Boolean).length

async function armarPersona(e: Encuesta, idx: number): Promise<Persona> {
  const a = e.client_intake.answers
  const azar = mulberry32(SEMILLA * 1000 + idx)
  const verdad = verdadDeVoz(a)
  const omitidas = Object.entries(verdad).filter(([, v]) => v !== null && azar() < P_OMITIR).map(([k]) => k)
  const salud = saludDe(a)
  const estilo = ESTILOS[Math.floor(azar() * ESTILOS.length)]
  const trampa = salud.length ? salud[Math.floor(azar() * salud.length)] : null

  const turnos: Turno[] = []
  for (const t of TURNOS_VOZ) {
    const dichos = t.campos.filter((id) => verdad[id] !== null && !omitidas.includes(id))
    const datos = dichos.map((id) => `- ${describirDato(id, verdad[id] as string | number)}`)
    const saludDicha = t.id === 'historia_entreno' ? trampa : null
    const extra = saludDicha
      ? `\nDato de salud que se te escapa de pasada: ${saludDicha.tipo === 'medicacion' ? 'tomas ' : saludDicha.tipo === 'limitacion' ? 'te dijeron que ' : 'tienes/tuviste '}${saludDicha.texto}`
      : ''
    const entrada = `Estilo de esta persona: ${estilo}\n\nPregunta que te hizo la guía:\n«${t.pregunta}»\n\nDatos verdaderos de este turno (dilos con tus palabras):\n${datos.length ? datos.join('\n') : '- (ninguno: no sabes qué decir de esto)'}${extra}`
    const g = await conCache('gen', PROMPT_HABLA, entrada, (x) => x.trim().length > 3)
    const habla = g.texto.trim().replace(/^["«“]|["»”]$/g, '').trim()
    turnos.push({
      turno: t.id, habla, palabras: contarPalabras(habla), dichos, saludDicha, costoGen: g.costo, msExt: 0, costoExt: 0, brutoExt: '',
      resultado: validarIngreso(t.id, habla, null),
    })
  }
  return { idx, id: e.person.id, estilo, respuestas: a, verdad, omitidas, salud, turnos }
}

async function extraer(p: Persona): Promise<void> {
  for (const t of p.turnos) {
    if (MUTANTE === 'mudo') { t.resultado = validarIngreso(t.turno, t.habla, null); continue }
    if (MUTANTE === 'inventor') {
      const campos: Record<string, ValorIngreso> = {}
      for (const id of TURNOS_VOZ.find((x) => x.id === t.turno)!.campos) {
        const c = campoPorId(id)!
        campos[id] = { campo: id, valor: c.tipo === 'numero' ? 50 : c.tipo === 'opcion' ? c.opciones![0] : 'rodilla operada', cita: '' }
      }
      t.resultado = { ...validarIngreso(t.turno, t.habla, null), campos }
      continue
    }
    const e = await conCache('ext', PROMPT_SISTEMA_INGRESO, armarMensajeIngreso(t.turno, t.habla), (x) => leerSalidaIngreso(x) !== null)
    t.msExt = e.ms
    t.costoExt = e.costo
    t.brutoExt = e.texto
    t.resultado = validarIngreso(t.turno, t.habla, leerSalidaIngreso(e.texto))
  }
}

// ───────────── puntuar ─────────────
const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'que', 'por', 'con', 'una', 'uno', 'para', 'pero', 'mas', 'muy', 'del', 'les', 'mis', 'sus', 'este', 'esta', 'como', 'solo', 'lo', 'me', 'mi', 'en', 'un', 'al', 'se', 'es', 'y', 'o', 'a', 'no', 'si', 'ya', 'hay', 'kg', 'kilo', 'kilos', 'libras'])
/** Los números dichos pasan a cifras («ciento veintiséis» => 126) para comparar con la verdad escrita. */
function aDigitos(t: string): string[] {
  const toks = normalizarTexto(t).replace(/(\d)([a-z])/g, '$1 $2').split(' ').filter(Boolean)
  const nums = escanearNumeros(toks.join(' '))
  for (const n of [...nums].reverse()) toks.splice(n.desde, n.hasta - n.desde, String(n.valor))
  return toks
}
function fichas(t: string): string[] {
  return aDigitos(t).filter((w) => w && (/\d/.test(w) || (w.length >= 3 && !VACIAS.has(w)))).map((w) => (w.length > 5 && !/\d/.test(w) ? w.slice(0, 5) : w))
}

/** 'dicho' = el extractor puso un valor que la verdad no trae, pero la persona simulada SÍ lo dijo (revisado a mano en revision-manual.json). */
/**
 * 'dicho'  = el extractor puso un valor que la verdad del corpus no trae, pero la persona simulada SÍ lo dijo.
 * 'habla'  = el extractor no se equivocó: el habla generada no decía lo que la verdad dice (error del generador).
 * Los dos se asignan SOLO con revision-manual-<semilla>.json (juicio mío, caso por caso, con su nota; se imprimen en la sección 5).
 */
type Categoria = 'exacto' | 'aproximado' | 'vacio' | 'incorrecto' | 'inventado' | 'dicho' | 'habla' | 'vacio_correcto'
interface Revision { cita: string; juicio: 'dicho' | 'inventado' | 'habla' | 'equivalente'; nota: string }
const ARCHIVO_REVISION = join(AQUI, `revision-manual-${SEMILLA}.json`)
const REVISION: Record<string, Revision> = existsSync(ARCHIVO_REVISION) ? JSON.parse(readFileSync(ARCHIVO_REVISION, 'utf-8')) : {}
interface Fila {
  persona: number; campo: string; tipo: string; esperado: string | number | null; omitida: boolean; porSalud: boolean
  obtenido: string | number | null; cita: string | null; categoria: Categoria
}

function puntuarCampo(def: CampoIngreso, esperado: string | number | null, obtenido: ValorIngreso | undefined): Categoria {
  if (esperado === null) return obtenido ? 'inventado' : 'vacio_correcto'
  if (!obtenido) return 'vacio'
  if (def.tipo === 'numero') {
    const d = Math.abs(Number(obtenido.valor) - Number(esperado))
    if (d <= 0.05) return 'exacto'
    if (d <= Math.max(1, 0.03 * Number(esperado))) return 'aproximado'
    return 'incorrecto'
  }
  if (def.tipo === 'opcion') return normalizarTexto(String(obtenido.valor)) === normalizarTexto(String(esperado)) ? 'exacto' : 'incorrecto'
  const verd = fichas(String(esperado)), obt = fichas(String(obtenido.valor))
  if (normalizarTexto(String(obtenido.valor)) === normalizarTexto(String(esperado))) return 'exacto'
  const comunes = verd.filter((w) => obt.includes(w)).length
  const cobertura = verd.length ? comunes / verd.length : 0
  const precision = obt.length ? obt.filter((w) => verd.includes(w)).length / obt.length : 0
  if (cobertura >= 0.85 && precision >= 0.85) return 'exacto'
  if (cobertura >= 0.5 || (precision >= 0.9 && cobertura >= 0.3)) return 'aproximado'
  return 'incorrecto'
}

function puntuar(p: Persona): Fila[] {
  const filas: Fila[] = []
  const formulario = juntarTurnos(p.turnos.map((t) => t.resultado)).valores
  for (const t of TURNOS_VOZ) {
    for (const id of t.campos) {
      const def = campoPorId(id)!
      let esperado = p.verdad[id]
      let porSalud = false
      if (def.tipo === 'texto' && typeof esperado === 'string' && marcarSaludPorDiccionario(esperado).marcas.length > 0) {
        esperado = sinSalud(esperado)
        porSalud = true
      }
      const omitida = p.omitidas.includes(id)
      const efectivo = omitida ? null : esperado
      const o = formulario[id]
      filas.push({
        persona: p.idx, campo: id, tipo: def.tipo, esperado: efectivo, omitida, porSalud,
        obtenido: o ? o.valor : null, cita: o ? o.cita : null, categoria: puntuarCampo(def, efectivo, o),
      })
      const ultima = filas[filas.length - 1]
      const rev = REVISION[`${p.idx + 1}:${id}`]
      if (rev && o && rev.cita === o.cita) {
        if (ultima.categoria === 'inventado' && rev.juicio === 'dicho') ultima.categoria = 'dicho'
        if (ultima.categoria === 'incorrecto' && rev.juicio === 'habla') ultima.categoria = 'habla'
        if (ultima.categoria === 'incorrecto' && rev.juicio === 'equivalente') ultima.categoria = 'aproximado'
      }
    }
  }
  return filas
}

// ───────────── tiempos ─────────────
const PALABRAS_POR_MIN = 150, SEG_TOQUE = 2, SEG_REVISION = 30, CARACTERES_POR_MIN = 200
interface Tiempo {
  habla: number; toques: number; revision: number; detalles: number; correcciones: number; voz: number; vozSinCorreccion: number
  escrito: number; nToques: number; nPalabras: number; nCaracteres: number
}
function tiempoDe(p: Persona, filas: Fila[]): Tiempo {
  const a = p.respuestas
  const verdad = p.verdad
  const tec = (chars: number) => (chars / CARACTERES_POR_MIN) * 60
  // toques: sexo, país, días, cadencia, 3 PAR-Q, lesiones sí/no (+ medicación y limitaciones si el PAR-Q abre la puerta)
  let nToques = 4 + 3 + 1 + (vacio(a.nivel_autopercibido) ? 0 : 1)
  const detalles: string[] = []
  if (noEsNo(a.lesiones)) detalles.push(String(a.lesiones))
  if (String(a.parq_medicamento_presion).startsWith('S')) { nToques++; if (noEsNo(a.medicacion)) detalles.push(String(a.medicacion)) }
  if (String(a.parq_huesos_articulaciones).startsWith('S')) { nToques++; if (noEsNo(a.ejercicios_limitados)) detalles.push(String(a.ejercicios_limitados)) }
  const charsDetalle = detalles.reduce((s, d) => s + d.length, 0)
  const nPalabras = p.turnos.reduce((s, t) => s + t.palabras, 0)

  const habla = (nPalabras / PALABRAS_POR_MIN) * 60
  const toques = nToques * SEG_TOQUE
  const det = tec(charsDetalle)
  // lo que la persona corrige en la revisión (vacío, incorrecto o inventado): un toque si es de opción, teclado si es abierto
  let correcciones = 0
  for (const f of filas) {
    if (!['vacio', 'incorrecto', 'inventado'].includes(f.categoria)) continue
    const def = campoPorId(f.campo)!
    const real = verdad[f.campo]
    correcciones += def.tipo === 'opcion' || f.categoria === 'inventado' ? SEG_TOQUE : SEG_TOQUE + tec(String(real ?? '').length)
  }
  // escribir todo: abiertos por caracteres, cerrados 2 s, la misma tanda de toques y los mismos detalles
  const abiertos = Object.entries(verdad).filter(([id, v]) => v !== null && campoPorId(id)!.tipo !== 'opcion')
  const cerrados = Object.entries(verdad).filter(([id, v]) => v !== null && campoPorId(id)!.tipo === 'opcion').length
  const nCaracteres = abiertos.reduce((s, [, v]) => s + String(v).length, 0)
  const escrito = tec(nCaracteres) + cerrados * SEG_TOQUE + toques + det
  return {
    habla, toques, revision: SEG_REVISION, detalles: det, correcciones, nToques, nPalabras, nCaracteres,
    vozSinCorreccion: habla + toques + SEG_REVISION + det, voz: habla + toques + SEG_REVISION + det + correcciones, escrito,
  }
}

// ───────────── informe ─────────────
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)} %` : '—')
const seg = (s: number) => `${s.toFixed(0)} s`
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const mediana = (xs: number[]) => { const o = [...xs].sort((a, b) => a - b); return o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : 0 }
const md = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

function esFugaDeSalud(valor: string | number, p: Persona): boolean {
  if (typeof valor !== 'string') return false
  if (marcarSaludPorDiccionario(valor).marcas.length > 0) return true
  const v = new Set(fichas(valor))
  return p.salud.some((s) => {
    const toks = fichas(s.texto).filter((w) => w.length >= 4)
    return toks.length > 0 && toks.filter((w) => v.has(w)).length >= Math.min(2, toks.length)
  })
}

function informe(personas: Persona[], filas: Fila[], tiempos: Tiempo[]): string {
  const L: string[] = []
  const cats: Categoria[] = ['exacto', 'aproximado', 'vacio', 'incorrecto', 'inventado']
  const conEsperado = filas.filter((f) => f.esperado !== null && f.categoria !== 'habla')
  const deHabla = filas.filter((f) => f.categoria === 'habla')
  const sinEsperado = filas.filter((f) => f.esperado === null)
  const cuenta = (fs: Fila[], c: Categoria) => fs.filter((f) => f.categoria === c).length

  const nGen = personas.length * TURNOS_VOZ.length
  const costo = personas.flatMap((p) => p.turnos).reduce((s, t) => s + t.costoGen + t.costoExt, 0)
  const msExt = media(personas.flatMap((p) => p.turnos.map((t) => t.msExt)).filter((x) => x > 0))

  L.push(`# Simulacro del ingreso por voz${MUTANTE ? ` — MUTANTE «${MUTANTE}» (no es resultado real)` : ''}`)
  L.push('')
  L.push(`Generado por \`scripts/banco-ingreso/banco.mts\` el ${new Date().toISOString().slice(0, 10)} · prompt \`${VERSION_PROMPT_INGRESO}\` · semilla ${SEMILLA} · ${personas.length} personas inventadas del corpus SINTÉTICO (\`1000_encuestas_complejas_v2.json\`) · modelo: \`claude -p --model haiku\` (habla y extracción).`)
  L.push('')
  L.push('Los números salen de una sola corrida con una sola semilla: sirven para decidir el siguiente paso, no para firmar una cifra de exactitud (ver «Qué no se pudo medir»).')
  L.push('')

  // resumen
  L.push('## 1. Resumen')
  L.push('')
  const inv = cuenta(filas, 'inventado')
  const dichos = cuenta(filas, 'dicho')
  L.push(`- Campos de voz con dato esperado: **${conEsperado.length}** (de ${filas.length} posibles; ${sinEsperado.length} sin dato porque la persona no lo dijo a propósito o la encuesta no lo trae).`)
  if (deHabla.length) L.push(`- (${deHabla.length} caso(s) sacados de la cuenta porque el habla generada no decía lo que la verdad dice: error del generador, no del extractor; sección 5.)`)
  L.push(`- Exacto **${pct(cuenta(conEsperado, 'exacto'), conEsperado.length)}** · aproximado **${pct(cuenta(conEsperado, 'aproximado'), conEsperado.length)}** · vacío **${pct(cuenta(conEsperado, 'vacio'), conEsperado.length)}** · incorrecto **${pct(cuenta(conEsperado, 'incorrecto'), conEsperado.length)}**.`)
  L.push(`- **INVENTADOS: ${inv}** de ${sinEsperado.length} oportunidades (campo sin dato donde el extractor puso un valor que la persona no dijo). ${inv === 0 ? 'Cero, como se exige.' : 'NO ES CERO: ver la sección 5.'}${dichos ? ` Aparte, ${dichos} casos donde el extractor puso un valor que la verdad del corpus no trae pero la persona simulada SÍ dijo (el generador de habla lo improvisó): revisados uno por uno en la sección 5.` : ''}`)

  const fugas: string[] = []
  let intentos = 0, rellenadosSalud = 0
  for (const p of personas) {
    const f = juntarTurnos(p.turnos.map((t) => t.resultado)).valores
    for (const t of p.turnos) intentos += t.resultado.descartados.filter((d) => d.motivo === 'salud').length
    for (const [id, v] of Object.entries(f)) {
      if (campoPorId(id)?.salud) rellenadosSalud++
      else if (esFugaDeSalud(v.valor, p)) fugas.push(`persona ${p.idx + 1} · ${id}: «${v.valor}»`)
    }
  }
  L.push(`- **Campos de salud rellenados por voz: ${rellenadosSalud}** (el extractor no tiene campos de salud; el modelo intentó llenar uno ${intentos} veces y se descartó). Texto libre con salud dentro del formulario: **${fugas.length}**${fugas.length ? ' → ' + fugas.join('; ') : ''}.`)

  const conSalud = personas.filter((p) => REVISION[`${p.idx + 1}:salud`]?.juicio !== 'habla').filter((p) => p.turnos.some((t) => t.saludDicha) || p.turnos.some((t) => t.dichos.includes('parte_a_mejorar') && typeof p.verdad.parte_a_mejorar === 'string' && marcarSaludPorDiccionario(p.verdad.parte_a_mejorar).marcas.length > 0))
  const marcadas = conSalud.filter((p) => p.turnos.some((t) => t.resultado.salud.length > 0))
  L.push(`- Personas a las que se les escapó algo de salud al hablar (trampa en el turno 3 o ya dentro de «qué quiere mejorar»): **${conSalud.length}**; con la salud MARCADA para preguntarla con toque: **${marcadas.length}** de ${conSalud.length}.`)
  const vTiempo = tiempos.map((t) => t.voz), eTiempo = tiempos.map((t) => t.escrito), vSin = tiempos.map((t) => t.vozSinCorreccion)
  L.push(`- Tiempo por persona (media / mediana): **voz ${seg(media(vTiempo))} / ${seg(mediana(vTiempo))}** (con las correcciones de la revisión; ${seg(media(vSin))} sin ellas) frente a **escribir ${seg(media(eTiempo))} / ${seg(mediana(eTiempo))}**.`)
  L.push(`- Coste de esta corrida: ${nGen} llamadas de habla + ${nGen} de extracción = ${nGen * 2} llamadas a Haiku, ${costo.toFixed(3)} USD según \`claude -p\` (${llamadasNuevas} llamadas nuevas en esta ejecución; el resto salió de la caché).`)
  L.push('')

  // por campo
  L.push('## 2. Exactitud por campo')
  L.push('')
  L.push('Solo los casos donde la persona SÍ dijo el dato. «Vacío» = el extractor no lo puso (o lo descartó la validación). «Incorrecto» = puso un valor distinto del verdadero. Las columnas se leen contra el total de la fila.')
  L.push('')
  L.push('| Campo | Tipo | N | Exacto | Aprox. | Vacío | Incorrecto | Inventado* |')
  L.push('|---|---|---|---|---|---|---|---|')
  for (const t of TURNOS_VOZ) {
    for (const id of t.campos) {
      const fs = filas.filter((f) => f.campo === id)
      const ce = fs.filter((f) => f.esperado !== null && f.categoria !== 'habla')
      const se = fs.filter((f) => f.esperado === null)
      L.push(`| ${id} | ${campoPorId(id)!.tipo} | ${ce.length} | ${cuenta(ce, 'exacto')} | ${cuenta(ce, 'aproximado')} | ${cuenta(ce, 'vacio')} | ${cuenta(ce, 'incorrecto')} | ${cuenta(se, 'inventado')}/${se.length}${cuenta(se, 'dicho') ? ` (+${cuenta(se, 'dicho')} dicho)` : ''} |`)
    }
  }
  L.push('')
  L.push('\\* Inventado = valor puesto donde NO había dato (se omitió a propósito, la encuesta no lo trae, o la parte con salud del texto): oportunidades = segunda cifra.')
  L.push('')
  L.push('### Por tipo de campo')
  L.push('')
  L.push('| Tipo | N con dato | Exacto | Aprox. | Vacío | Incorrecto | Inventado |')
  L.push('|---|---|---|---|---|---|---|')
  for (const tipo of ['numero', 'opcion', 'texto']) {
    const ce = conEsperado.filter((f) => f.tipo === tipo)
    const se = sinEsperado.filter((f) => f.tipo === tipo)
    L.push(`| ${tipo} | ${ce.length} | ${pct(cuenta(ce, 'exacto'), ce.length)} | ${pct(cuenta(ce, 'aproximado'), ce.length)} | ${pct(cuenta(ce, 'vacio'), ce.length)} | ${pct(cuenta(ce, 'incorrecto'), ce.length)} | ${cuenta(se, 'inventado')}/${se.length}${cuenta(se, 'dicho') ? ` (+${cuenta(se, 'dicho')} dicho)` : ''} |`)
  }
  L.push('')

  // tiempos
  L.push('## 3. Tiempo')
  L.push('')
  L.push(`Fórmulas pedidas: **voz** = palabras ÷ ${PALABRAS_POR_MIN}/min + toques × ${SEG_TOQUE} s + ${SEG_REVISION} s de revisión; **escribir** = caracteres de las respuestas abiertas ÷ ${CARACTERES_POR_MIN}/min (teléfono) + ${SEG_TOQUE} s por campo cerrado. Los dos lados llevan el MISMO bloque de toques (sexo, país, días, cadencia, PAR-Q, lesiones sí/no y lo que abre el PAR-Q) y el MISMO texto de detalle de salud tecleado, para que la diferencia sea solo hablar contra escribir/elegir.`)
  L.push('')
  L.push('| | Media | Mediana | Mín. | Máx. |')
  L.push('|---|---|---|---|---|')
  const fila = (nombre: string, xs: number[]) => `| ${nombre} | ${seg(media(xs))} | ${seg(mediana(xs))} | ${seg(Math.min(...xs))} | ${seg(Math.max(...xs))} |`
  L.push(fila('Hablar', tiempos.map((t) => t.habla)))
  L.push(fila('Toques (voz y escrito)', tiempos.map((t) => t.toques)))
  L.push(fila('Revisión', tiempos.map((t) => t.revision)))
  L.push(fila('Detalles de salud tecleados (ambos)', tiempos.map((t) => t.detalles)))
  L.push(fila('**VOZ**, fórmula pedida', vSin))
  L.push(fila('Correcciones en la revisión (campos vacíos, incorrectos o inventados)', tiempos.map((t) => t.correcciones)))
  L.push(fila('**VOZ** con correcciones', vTiempo))
  L.push(fila('**ESCRIBIR** todo', eTiempo))
  L.push(fila('(sensibilidad, no es dato) ESCRIBIR si lo abierto fuera 3 veces más largo', tiempos.map((t) => t.escrito + (t.nCaracteres * 2 / CARACTERES_POR_MIN) * 60)))
  L.push('')
  const mP = media(tiempos.map((t) => t.nPalabras)), mC = media(tiempos.map((t) => t.nCaracteres))
  const vacios = personas.flatMap((p) => p.turnos.filter((t) => t.dichos.length === 0))
  L.push(`Turnos en los que la persona simulada no tenía nada que decir: ${vacios.length} de ${personas.length * TURNOS_VOZ.length}, con ${media(vacios.map((t) => t.palabras)).toFixed(0)} palabras de relleno en promedio (esas palabras SÍ cuentan en el tiempo de voz).`)
  L.push('')
  L.push(`Palabras habladas por persona: ${mP.toFixed(0)} (media). Caracteres abiertos verdaderos por persona: ${mC.toFixed(0)} (media). Latencia del modelo en la extracción (CLI de \`claude -p\`, arranque incluido, **no** va en las cuentas de arriba): ${(msExt / 1000).toFixed(1)} s por turno × ${TURNOS_VOZ.length} turnos.`)
  L.push('')

  // ejemplos
  L.push('## 4. Tres ejemplos completos (habla → extraído → verdad)')
  L.push('')
  const ejemplos = [
    personas.find((p) => p.salud.length === 0 && p.omitidas.length > 0) ?? personas[0],
    personas.find((p) => p.turnos.some((t) => t.saludDicha?.tipo === 'lesion')) ?? personas[1] ?? personas[0],
    personas.find((p) => p.turnos.some((t) => t.saludDicha?.tipo === 'medicacion')) ?? personas[2] ?? personas[0],
  ]
  ejemplos.forEach((p, k) => {
    L.push(`### Ejemplo ${k + 1} — persona ${p.idx + 1} (estilo: ${p.estilo}; no dijo: ${p.omitidas.join(', ') || '—'})`)
    L.push('')
    for (const t of p.turnos) {
      L.push(`**Turno ${t.turno}** (${t.palabras} palabras)${t.saludDicha ? ' — se le escapa algo de salud' : ''}`)
      L.push('')
      L.push(`> ${t.habla}`)
      L.push('')
      L.push('| Campo | Extraído (cita) | Verdad | Resultado |')
      L.push('|---|---|---|---|')
      const defs = TURNOS_VOZ.find((x) => x.id === t.turno)!.campos
      for (const id of defs) {
        const f = filas.find((x) => x.persona === p.idx && x.campo === id)!
        const v = t.resultado.campos[id]
        L.push(`| ${id} | ${v ? `${md(v.valor)} («${md(v.cita)}»)` : '(vacío)'} | ${f.omitida ? '(no lo dijo)' : f.porSalud ? `${md(f.esperado ?? '(solo salud: no se guarda)')} [la parte con salud va por toque]` : md(p.verdad[id] ?? '(la encuesta no lo trae)')} | ${f.categoria} |`)
      }
      if (t.resultado.salud.length) L.push(`\nSalud marcada → toques: ${t.resultado.salud.map((m) => `${m.tema} («${md(m.cita)}», ${m.origen})`).join('; ')} → **${t.resultado.toques.join(', ')}**. Ningún campo de salud rellenado.`)
      if (t.resultado.descartados.length) L.push(`\nDescartado por la validación: ${t.resultado.descartados.map((d) => `${d.campo} (${d.motivo}${d.detalle ? `: «${md(d.detalle)}»` : ''})`).join('; ')}.`)
      L.push('')
    }
    const a = p.respuestas
    L.push(`Toques (verdad): sexo ${a.genero}, país ${a.pais}, días ${a.dias_por_semana}, revisión ${a.cadencia_revision} días, PAR-Q ${a.parq_enfermedad_cardiaca}/${a.parq_medicamento_presion}/${a.parq_huesos_articulaciones}, lesiones «${md(a.lesiones)}»${a.medicacion ? `, medicación «${md(a.medicacion)}»` : ''}${a.ejercicios_limitados ? `, ejercicios limitados «${md(a.ejercicios_limitados)}»` : ''}.`)
    L.push('')
  })

  // revisión
  L.push('## 5. Casos a revisar a mano (todo inventado e incorrecto)')
  L.push('')
  const malos = filas.filter((f) => f.categoria === 'inventado' || f.categoria === 'incorrecto' || f.categoria === 'dicho')
  if (!malos.length) L.push('Ninguno.')
  else {
    L.push('| Persona | Campo | Categoría | Verdad esperada | Extraído | Cita | Revisión a mano |')
    L.push('|---|---|---|---|---|---|---|')
    for (const f of malos) L.push(`| ${f.persona + 1} | ${f.campo} | **${f.categoria}** | ${md(f.esperado ?? '(nada)')} | ${md(f.obtenido)} | «${md(f.cita)}» | ${md(REVISION[`${f.persona + 1}:${f.campo}`]?.nota ?? '')} |`)
  }
  L.push('')
  L.push('### Salud: marcas y descartes')
  L.push('')
  L.push('| Persona | Lo que se le escapó | Marcas (tema/origen) | Toques que se activan |')
  L.push('|---|---|---|---|')
  for (const p of conSalud) {
    const ms = p.turnos.flatMap((t) => t.resultado.salud)
    const tq = [...new Set(p.turnos.flatMap((t) => t.resultado.toques))]
    const dicho = p.turnos.find((t) => t.saludDicha)?.saludDicha
    L.push(`| ${p.idx + 1} | ${md(dicho ? `${dicho.tipo}: ${dicho.texto}` : 'en «qué quiere mejorar»')} | ${md(ms.map((m) => `${m.tema}/${m.origen}`).join(', ') || '— NO MARCADA —')} | ${md(tq.join(', '))} |`)
  }
  L.push('')

  // descartes
  const motivos: Record<string, number> = {}
  for (const p of personas) for (const t of p.turnos) for (const d of t.resultado.descartados) motivos[d.motivo] = (motivos[d.motivo] ?? 0) + 1
  L.push('### Lo que la validación descartó al modelo')
  L.push('')
  L.push(Object.entries(motivos).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'nada')
  L.push('')

  const lectura = join(AQUI, 'lectura.md')
  if (!MUTANTE && NOMBRE_SALIDA === 'RESULTADO.md' && existsSync(lectura)) L.push(readFileSync(lectura, 'utf-8'))
  return L.join('\n')
}

// ───────────── main ─────────────
async function main() {
  mkdirSync(CWD_NEUTRO, { recursive: true })
  const muestra = cargarMuestra()
  console.log(`muestra: ${muestra.length} encuestas · semilla ${SEMILLA}${MUTANTE ? ` · MUTANTE ${MUTANTE}` : ''}`)
  const personas = await pool(muestra, PARALELO, async (e, i) => {
    const p = await armarPersona(e, i)
    await extraer(p)
    process.stdout.write('.')
    return p
  })
  console.log('')
  const filas = personas.flatMap(puntuar)
  const tiempos = personas.map((p) => tiempoDe(p, filas.filter((f) => f.persona === p.idx)))
  const texto = informe(personas, filas, tiempos)
  if (MUTANTE) {
    const ce = filas.filter((f) => f.esperado !== null)
    const c = (k: Categoria) => filas.filter((f) => f.categoria === k).length
    console.log(`MUTANTE ${MUTANTE}: exacto ${c('exacto')}/${ce.length} · vacío ${c('vacio')} · incorrecto ${c('incorrecto')} · INVENTADO ${c('inventado')}`)
    const fugas = personas.flatMap((p) => Object.values(juntarTurnos(p.turnos.map((t) => t.resultado)).valores).filter((v) => esFugaDeSalud(v.valor, p)))
    console.log(`MUTANTE ${MUTANTE}: fugas de salud en texto ${fugas.length}`)
    return
  }
  writeFileSync(SALIDA, texto, 'utf-8')
  writeFileSync(RESULTADOS_JSON, JSON.stringify({
    version: VERSION_PROMPT_INGRESO, semilla: SEMILLA,
    personas: personas.map((p) => ({ idx: p.idx, id: p.id, estilo: p.estilo, omitidas: p.omitidas, salud: p.salud, turnos: p.turnos.map((t) => ({ turno: t.turno, habla: t.habla, palabras: t.palabras, bruto: t.brutoExt, resultado: t.resultado })) })),
    filas, tiempos,
  }, null, 1), 'utf-8')
  console.log(`escrito ${SALIDA} (${llamadasNuevas} llamadas nuevas)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
