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
const EXAGERACION = /\b(me quiero morir|me muero|muerto|muerta)\s+(de|del|por)\s+\S+/g

/**
 * La exageración se BORRA del texto y la crisis se busca en lo que queda.
 *
 * Vetar el mensaje entero en cuanto aparecía una exageración era demasiado
 * ancho: "me muero de ganas de que esto acabe, quiero quitarme la vida"
 * devolvía false. Los mensajes mixtos son justamente los que más importan.
 */
export function esCrisis(mensaje: string): boolean {
  const limpio = normalizar(mensaje).replace(EXAGERACION, ' ')
  return CRISIS.some((f) => limpio.includes(f))
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

/** Saca el token de una cabecera `Authorization: Bearer <token>`. */
export function tokenDeCabecera(cabecera: string | null): string {
  if (!cabecera) return ''
  const m = cabecera.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : ''
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

// ---------------------------------------------------------------- aviso al coach

export interface Aviso {
  tipo: 'crisis' | 'salud'
  nombre: string
  panel: string
}

/**
 * El aviso NO lleva el texto del mensaje, a propósito: puede contener datos de
 * salud y Telegram es un tercero. Solo dice quién y de qué tipo; el contenido
 * se lee en el panel. Ver §9 de CLAUDE.md.
 */
export function textoDeAviso(a: Aviso): string {
  const pila = (a.nombre ?? '').trim().split(/\s+/)[0]
  const quien = pila || 'Una asesorada'
  const cabecera = a.tipo === 'crisis' ? '🚨 URGENTE — Alpha Athletics' : '🔴 Bandera roja — Alpha Athletics'
  const que =
    a.tipo === 'crisis'
      ? `${quien} escribió algo que el sistema no debe responder. Ya recibió una respuesta de contención, pero te está esperando a ti.`
      : `${quien} escribió sobre un tema de salud.`
  return `${cabecera}\n\n${que}\n\n${a.panel}`
}

// ---------------------------------------------------------------- mensajes fijos

// El texto NO promete un aviso al telefono: hoy la bandera roja solo queda
// marcada en el panel del coach. Prometer "va a escribirte" a las 3 de la
// madrugada es prometer algo que el sistema no cumple, y ahi es donde menos
// se puede. El aviso real es la Etapa 6; hasta entonces, la urgencia se
// traslada a lo que si esta disponible en ese momento.
const MSG_CRISIS = [
  'Leo lo que me escribes y no lo voy a pasar por alto.',
  'Esto no es algo que deba responderte una app, asi que no voy a hablarte de entrenamiento ahora.',
  'Le voy a dejar esto marcado a tu coach para que lo vea.',
  'Si necesitas hablar con alguien ahora mismo, no esperes a que el te escriba: busca a un profesional de salud o a alguien de confianza que este cerca de ti. No te quedes solo con esto.',
].join('\n\n')

const MSG_ESCALADO = [
  'Esa no te la puedo responder bien con lo que tengo.',
  'Se la paso a tu coach tal cual y te responde el.',
].join('\n\n')

const PREFIJO_TENTATIVO = 'Creo que me preguntas por esto. Si no era, dimelo y le paso el mensaje a tu coach.\n\n'

// ---------------------------------------------------------------- handler

/**
 * El cuerpo NO lleva usuario: quien pregunta se decide con el token de sesion.
 * Si el cliente manda un `usuario_id`, se ignora en silencio.
 */
interface Peticion {
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
  if (!mensaje) return json({ error: 'Falta el mensaje' }, 400)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!

  // El usuario NO se toma del cuerpo: se saca del token de sesion y se valida
  // contra Supabase Auth. Si se confiara en el cuerpo, cualquier asesorado
  // podria pasar el uuid de otro y leer sus datos o escribir en su historial.
  //
  // Se le pregunta a Auth en vez de decodificar el token aqui: decodificar sin
  // verificar la firma acepta tokens falsificados, y verificarla dentro de la
  // funcion exigiria el secreto JWT, que cambia de forma segun el proyecto use
  // claves antiguas o nuevas. Preguntarle a Auth es autoritativo en los dos
  // casos. Cuesta un viaje extra de unos 50 ms.
  //
  // La clave publica se comprueba ANTES que el token y falla con 500, no con
  // 401: si faltara, TODA peticion respondería "sesion invalida" y mandaria a
  // buscar el problema en la sesion del asesorado en vez de en la configuracion
  // de la funcion, que es donde esta.
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  if (!ANON_KEY) {
    return json({ error: 'Falta SUPABASE_ANON_KEY (o SUPABASE_PUBLISHABLE_KEY) en la funcion' }, 500)
  }

  const token = tokenDeCabecera(req.headers.get('Authorization'))
  if (!token) return json({ error: 'Falta la sesion' }, 401)

  let usuarioId: string
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` },
    })
    if (!r.ok) return json({ error: 'Sesion invalida' }, 401)
    const u = await r.json()
    if (!u?.id) return json({ error: 'Sesion invalida' }, 401)
    usuarioId = u.id
  } catch {
    return json({ error: 'No se pudo validar la sesion' }, 401)
  }

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

  /**
   * Escribe la respuesta en el hilo del chat y devuelve el id de la fila.
   *
   * La fila la escribe la FUNCION, no el cliente. `mensajes.de_id` exige un
   * usuario real y su politica RLS es `with check (de_id = auth.uid())`: una
   * asesorada no puede insertar una fila firmada por el coach. Aqui se usa
   * service_role, que se salta RLS. Es el mismo criterio que con el usuario:
   * el servidor es dueño de lo que firma, el cliente no.
   *
   * Devuelve undefined si algo falla; nunca lanza. Que el asesorado lea la
   * respuesta importa mas que quede registrada.
   */
  const guardarEnHilo = async (texto: string): Promise<string | undefined> => {
    try {
      const r = await rest('usuarios_app?rol=eq.coach&select=id&limit=1')
      const coach = r.ok ? (await r.json())[0] : null
      // Sin coach dado de alta no hay quien firme la fila, pero la respuesta
      // se entrega igual: es un problema de configuracion, no del asesorado.
      if (!coach?.id) return undefined

      // Misma convencion de id que `mockDb.ts` en la app: el cliente pinta la
      // respuesta con ESTE id, asi que al rehidratar la fila coincide y no
      // aparece duplicada.
      const id = `msg-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const ins = await rest('mensajes', {
        method: 'POST',
        body: JSON.stringify({
          id,
          de_id: coach.id,
          para_id: usuarioId,
          fecha_iso: new Date().toISOString(),
          texto,
          origen: 'alpha',
          leido: false,
        }),
      })
      return ins.ok ? id : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Unico punto de salida con texto para el asesorado: guarda la fila y añade
   * `mensaje_id`. Si no se pudo guardar, la respuesta sale igual sin ese campo.
   */
  const entregar = async (texto: string, extra: Record<string, unknown>) => {
    const mensajeId = await guardarEnHilo(texto)
    return json({ respuesta: texto, ...extra, ...(mensajeId ? { mensaje_id: mensajeId } : {}) })
  }

  // 1. CRISIS. Antes que nada. No busca ficha ni menciona entrenamiento.
  if (esCrisis(mensaje)) {
    await registrar({ via: 'escalado', bandera_roja: true })
    return entregar(MSG_CRISIS, { via: 'escalado', crisis: true, bandera_roja: true })
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
    return entregar(MSG_ESCALADO, { via: 'escalado', bandera_roja: salud })
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
    return entregar(MSG_ESCALADO, { via: 'escalado', bandera_roja: banderaRoja })
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

  return entregar(respuesta, { via, ficha_id: ficha.id, similitud, bandera_roja: banderaRoja })
}

// Solo arranca el servidor dentro de Deno. Así los tests pueden importar
// este archivo sin levantar nada.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void } | undefined

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(manejar)
}
