// Edge Function: responder-chat
// Se pega tal cual en el panel de Supabase (Edge Functions -> Via Editor).
// La copia de referencia y con control de versiones es este archivo del repo.

/**
 * Minúsculas, sin tildes, espacios colapsados. Base de toda comparación léxica.
 *
 * El rango [\u0300-\u036f] (marcas diacríticas combinantes) va escrito con
 * escapes a propósito: son caracteres invisibles en un editor y este archivo
 * se entrega copiándolo y pegándolo en el panel de Supabase. Si esos bytes se
 * dañaran al pegar, `normalizar` dejaría de quitar tildes sin que se note, y
 * la detección de crisis fallaría en silencio con cualquier mensaje acentuado
 * ("quiero hacerme daño"). Con escapes eso no puede pasar.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Frases inequívocas. Cada una se comprobó contra su uso coloquial en Colombia
// para que no salte con exageraciones ("me quiero morir de agujetas").
const CRISIS = [
  'no quiero vivir',
  'no quiero seguir viviendo',
  'quiero morirme',
  'quiero morir',
  'quitarme la vida',
  'acabar con mi vida',
  'matarme',
  'suicid',
  'hacerme dano',
  'lastimarme',
  'no vale la pena vivir',
]

// "me quiero morir de X" / "me muero de X" son exageraciones, no crisis.
const EXAGERACION = /\b(me quiero morir|me muero|muerto|muerta)\s+(de|del|por)\b/

export function esCrisis(mensaje: string): boolean {
  const t = normalizar(mensaje)
  if (EXAGERACION.test(t)) return false
  return CRISIS.some((f) => t.includes(f))
}

// Léxico de salud. Se marca al coach en rojo. El sesgo es marcar de más:
// una alerta sobrante cuesta un vistazo; una que falta cuesta un asesorado.
const SALUD = [
  // dolor y lesión
  'duele', 'dolor', 'punza', 'molestia', 'lesion', 'lesione', 'fractura',
  'esguince', 'desgarr', 'hernia', 'tendon', 'inflamad', 'hinchad',
  // urgencia
  'mareo', 'maree', 'desmay', 'sin aire', 'falta de aire', 'no puedo respirar',
  'pecho', 'palpitacion', 'taquicardia', 'opresion',
  // enfermedad
  'fiebre', 'gripa', 'gripe', 'infeccion', 'vomit', 'diarrea', 'medicament',
  // salud femenina
  'regla', 'menstrua', 'periodo', 'sangrado', 'embaraz', 'postparto',
  'orina', 'incontinencia', 'suelo pelvico', 'anticonceptiv',
  // angustia ambigua: no es crisis, pero el coach debe verlo pronto
  'ya no puedo mas', 'no aguanto', 'ansiedad', 'deprimid', 'sin ganas de nada',
]

export function esTemaDeSalud(mensaje: string): boolean {
  const t = normalizar(mensaje)
  return SALUD.some((p) => t.includes(p))
}

// Umbrales MEDIDOS el 2026-07-26 con las 50 fichas reales y 15 preguntas de
// prueba: coincidencias verdaderas 0,507-0,779; falsas 0,264-0,379.
// Los valores anteriores del spec (0,80/0,60) eran conjetura y estaban por
// encima de la escala real del modelo: ninguna ficha habria respondido nunca.
export const UMBRAL_ALTO = 0.5
export const UMBRAL_BAJO = 0.42

export type Via = 'ficha' | 'ficha_tentativa' | 'ia_vivo' | 'escalado'

export function decidirVia(similitud: number | null): Via {
  if (similitud === null || similitud < UMBRAL_BAJO) return 'escalado'
  if (similitud < UMBRAL_ALTO) return 'ficha_tentativa'
  return 'ficha'
}

export interface CuerpoFicha {
  respuesta_directa: string
  por_que: string
  tu_caso_hoy: string
  que_hago_ahora: string
  senal_alarma: string
}

/** Las cinco partes, en el orden en que se le entregan al asesorado. */
const PARTES: (keyof CuerpoFicha)[] = [
  'respuesta_directa',
  'por_que',
  'tu_caso_hoy',
  'que_hago_ahora',
  'senal_alarma',
]

/**
 * Partes que NUNCA se omiten: la respuesta a lo que preguntó y el aviso de
 * seguridad. Callar un "para si te duele dentro de la rodilla" porque faltaba
 * un dato de relleno sería peor que cualquier respuesta sin personalizar.
 *
 * Una ranura en estas dos partes es un fallo de contenido, y por eso
 * `validarCuerpo` (en `src/domain/ficha.ts`) las prohíbe al publicar: ahí es
 * donde se ve, no en la cara del asesorado. Si aun así llegara una, se
 * entrega la parte con la ranura borrada — nunca con el {{hueco}} a la vista.
 */
const NUNCA_SE_OMITEN: (keyof CuerpoFicha)[] = ['respuesta_directa', 'senal_alarma']

/** Fábrica, no constante: un regex global compartido arrastra `lastIndex`. */
const ranura = () => /\{\{\s*([a-z_]+)\s*\}\}/g

/**
 * Une las cinco partes rellenando las ranuras de todas ellas.
 *
 * La regla es **por parte**: si a una parte le falta el dato de cualquiera de
 * sus ranuras, se omite esa parte entera y las demás siguen. Una respuesta sin
 * personalizar sigue siendo correcta; una con datos inventados o con
 * {{huecos}} a la vista, no. Las dos partes de `NUNCA_SE_OMITEN` son la
 * excepción y se explican ahí arriba.
 */
export function armarRespuesta(
  cuerpo: CuerpoFicha,
  datos: Record<string, string | undefined>,
): string {
  const dato = (nombre: string) => datos[nombre]?.trim() || ''

  const armadas = PARTES.map((parte) => {
    const texto = (cuerpo[parte] ?? '').trim()
    if (!texto) return ''

    const usadas = [...texto.matchAll(ranura())].map((m) => m[1])
    if (usadas.length === 0) return texto

    if (usadas.every((r) => dato(r))) {
      return texto.replace(ranura(), (_, r) => dato(r))
    }

    if (!NUNCA_SE_OMITEN.includes(parte)) return ''

    // Parte obligatoria a la que le falta un dato: se entrega igual, con la
    // ranura borrada y los espacios que deja recogidos.
    return texto
      .replace(ranura(), (_, r) => dato(r))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .trim()
  })

  return armadas.filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------- mensajes fijos

const MSG_CRISIS = [
  'Leo lo que me escribes y no lo voy a pasar por alto.',
  'Esto no es algo que deba responderte una app, asi que no voy a hablarte de entrenamiento ahora.',
  'Ya le llego el aviso a tu coach y va a escribirte.',
  'Si en este momento sientes que estas en peligro, busca ayuda de un profesional de salud o de alguien de confianza que este cerca de ti. No te quedes solo con esto.',
].join('\n\n')

const MSG_ESCALADO = [
  'Esa no te la puedo responder bien con lo que tengo.',
  'Se la paso a tu coach tal cual y te responde el.',
].join('\n\n')

const PREFIJO_TENTATIVO = 'Creo que me preguntas por esto. Si no era, dimelo y le paso el mensaje a tu coach.\n\n'

// ---------------------------------------------------------------- handler

interface Peticion {
  usuario_id: string
  mensaje: string
  /** Lo que el asesorado tiene en pantalla. El cliente lo sabe mejor que el servidor. */
  contexto?: Record<string, string>
}

async function manejar(req: Request): Promise<Response> {
  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  let peticion: Peticion
  try {
    peticion = await req.json()
  } catch {
    return json({ error: 'Cuerpo invalido' }, 400)
  }

  const mensaje = (peticion.mensaje ?? '').trim()
  const usuarioId = peticion.usuario_id
  if (!mensaje || !usuarioId) return json({ error: 'Faltan usuario_id o mensaje' }, 400)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!

  const rest = async (ruta: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

  const registrar = (extra: Record<string, unknown>) =>
    rest('consultas_chat', {
      method: 'POST',
      body: JSON.stringify({ usuario_id: usuarioId, mensaje, ...extra }),
    }).catch(() => {})

  // 1. CRISIS. Antes que nada. No busca ficha ni menciona entrenamiento.
  if (esCrisis(mensaje)) {
    await registrar({ via: 'escalado', bandera_roja: true })
    return json({ respuesta: MSG_CRISIS, via: 'escalado', crisis: true, bandera_roja: true })
  }

  const salud = esTemaDeSalud(mensaje)

  // 2. Vector del mensaje.
  let vector: number[]
  try {
    const r = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { authorization: `Bearer ${OPENAI_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: mensaje }),
    })
    if (!r.ok) throw new Error(String(r.status))
    vector = (await r.json()).data[0].embedding
  } catch {
    await registrar({ via: 'escalado', bandera_roja: salud })
    return json({ respuesta: MSG_ESCALADO, via: 'escalado', bandera_roja: salud })
  }

  // 3. Ficha más cercana.
  const rpc = await rest('rpc/buscar_ficha', {
    method: 'POST',
    body: JSON.stringify({ consulta: vector, limite: 1 }),
  })
  const fichas = rpc.ok ? await rpc.json() : []
  const ficha = fichas?.[0] ?? null
  const similitud: number | null = ficha ? Number(ficha.similitud) : null

  // 4. Umbrales.
  const via = decidirVia(similitud)
  const banderaRoja = salud || (via !== 'escalado' && ficha?.bandera_salud === true)

  if (via === 'escalado' || !ficha) {
    await registrar({ via: 'escalado', similitud, bandera_roja: banderaRoja })
    return json({ respuesta: MSG_ESCALADO, via: 'escalado', bandera_roja: banderaRoja })
  }

  // 5. Datos de la persona para las ranuras.
  const datos: Record<string, string> = {}
  for (const [k, v] of Object.entries(peticion.contexto ?? {})) {
    if (/^[a-z_]+$/.test(k) && typeof v === 'string' && v.length <= 120) datos[k] = v
  }

  const necesita = (r: string) => (ficha.datos_que_usa ?? []).includes(r)

  if (necesita('microciclo_actual') && !datos.microciclo_actual) {
    const r = await rest(`microciclos?usuario_id=eq.${usuarioId}&estado=eq.activo&select=numero&limit=1`)
    const m = r.ok ? (await r.json())[0] : null
    if (m) datos.microciclo_actual = `M${m.numero}`
  }

  if (necesita('checkin_bienestar') && !datos.checkin_bienestar) {
    const r = await rest(`checkins?usuario_id=eq.${usuarioId}&select=datos&order=fecha.desc&limit=1`)
    const c = r.ok ? (await r.json())[0] : null
    const d = c?.datos ?? null
    if (d) {
      const partes = ['sueno', 'animo', 'estres', 'energia']
        .filter((p) => d[p] !== undefined && d[p] !== null)
        .map((p) => `${p} ${d[p]}`)
      if (partes.length) datos.checkin_bienestar = partes.join(', ')
    }
  }

  if (necesita('hidratacion_dia') && !datos.hidratacion_dia) {
    const hoy = new Date().toISOString().slice(0, 10)
    const r = await rest(`hidratacion?usuario_id=eq.${usuarioId}&fecha=eq.${hoy}&select=ml&limit=1`)
    const h = r.ok ? (await r.json())[0] : null
    if (h) datos.hidratacion_dia = `${(h.ml / 1000).toFixed(1)} L`
  }

  // 6. Respuesta.
  const cuerpo = armarRespuesta(ficha.cuerpo as CuerpoFicha, datos)
  const respuesta = via === 'ficha_tentativa' ? PREFIJO_TENTATIVO + cuerpo : cuerpo

  await registrar({ via, ficha_id: ficha.id, similitud, bandera_roja: banderaRoja })

  return json({ respuesta, via, ficha_id: ficha.id, similitud, bandera_roja: banderaRoja })
}

// Solo arranca el servidor dentro de Deno. Así los tests pueden importar
// este archivo sin levantar nada.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void } | undefined

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(manejar)
}
