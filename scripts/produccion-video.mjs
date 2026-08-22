// Construcción pura del paquete de producción de vídeo (sin I/O) — testeada en
// src/test/produccion-video.test.ts
//
// POR QUÉ EXISTE: la mensualidad de Google AI Pro da cuota en la INTERFAZ de AI
// Studio / Flow, no en la API. No hay forma soportada de que Claude genere las
// imágenes "por debajo" con esa suscripción (ver
// docs/specs/2026-08-22-video-nano-banana-diseno.md). Así que el reparto es:
// Claude escribe el paquete de producción completo —prompts exactos, plano a
// plano, con el bloque de consistencia repetido— y la generación se hace pegando
// en AI Studio, donde la cuota ya está pagada. Coste de tokens de imagen: cero.

/** Formatos de entrega, con lo que Nano Banana necesita saber del encuadre. */
export const FORMATOS = {
  'reel-vertical': { ratio: '9:16', ancho: 1080, alto: 1920, nombre: 'Reel / Shorts / TikTok' },
  'feed-cuadrado': { ratio: '1:1', ancho: 1080, alto: 1080, nombre: 'Feed cuadrado' },
  'horizontal': { ratio: '16:9', ancho: 1920, alto: 1080, nombre: 'YouTube / horizontal' },
}

/**
 * Identidad visual por defecto, copiada de src/styles/tokens.css (tema oscuro).
 * Si cambian los tokens de marca, cambiar también aquí: son la misma decisión
 * escrita dos veces, y esa duplicación ya nos costó una vez con la prescripción.
 */
export const MARCA = {
  nombre: 'Alpha Athletics',
  fondo: '#0a0a0a',
  superficie: '#141414',
  acento: '#ff1e1e',
  acentoOscuro: '#8f1119',
  texto: '#f2f2f2',
  tenue: '#a8a8ad',
  luz: 'luz dura lateral, sombras profundas, ambiente de gimnasio nocturno',
  camara: 'lente 35 mm, profundidad de campo media, grano fotográfico fino',
}

/** Lo que nunca debe aparecer, en todos los planos. */
const NEGATIVOS_BASE = [
  'texto inventado o ilegible',
  'marcas de agua o logotipos ajenos',
  'manos o dedos deformes',
  'aparatos de gimnasio imposibles',
  'estética de stock photo sonriente',
]

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje)
}

/** Convierte un título en un slug usable como nombre de archivo. */
export function aSlug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Valida el brief y rellena lo opcional. Lanza con el motivo concreto: un brief
 * a medias produce prompts a medias, y eso solo se nota después de gastar cuota.
 */
export function normalizarBrief(brief) {
  exigir(brief && typeof brief === 'object', 'El brief tiene que ser un objeto JSON.')
  exigir(typeof brief.titulo === 'string' && brief.titulo.trim(), 'Falta "titulo" en el brief.')
  exigir(typeof brief.objetivo === 'string' && brief.objetivo.trim(), 'Falta "objetivo": qué tiene que entender quien lo ve.')

  const formato = brief.formato ?? 'reel-vertical'
  exigir(FORMATOS[formato], `Formato desconocido: "${formato}". Opciones: ${Object.keys(FORMATOS).join(', ')}.`)

  exigir(Array.isArray(brief.planos) && brief.planos.length > 0, 'El brief necesita al menos un plano en "planos".')

  const vistos = new Set()
  const planos = brief.planos.map((plano, i) => {
    const id = String(plano.id ?? String(i + 1).padStart(2, '0'))
    exigir(!vistos.has(id), `Dos planos con el mismo id: "${id}".`)
    vistos.add(id)
    exigir(typeof plano.descripcion === 'string' && plano.descripcion.trim(), `El plano "${id}" no tiene "descripcion".`)
    const segundos = Number(plano.segundos ?? 4)
    exigir(Number.isFinite(segundos) && segundos > 0, `El plano "${id}" tiene una duración inválida: ${plano.segundos}.`)
    return {
      id,
      descripcion: plano.descripcion.trim(),
      segundos,
      textoEnPantalla: plano.textoEnPantalla?.trim() || '',
      locucion: plano.locucion?.trim() || '',
      movimiento: plano.movimiento?.trim() || 'cámara fija, sujeto en movimiento leve',
      composicion: plano.composicion?.trim() || '',
      evitar: Array.isArray(plano.evitar) ? plano.evitar : [],
    }
  })

  return {
    titulo: brief.titulo.trim(),
    objetivo: brief.objetivo.trim(),
    formato,
    slug: brief.slug?.trim() || aSlug(brief.titulo),
    marca: { ...MARCA, ...(brief.marca ?? {}) },
    planos,
  }
}

/** Segundos acumulados de cada plano, para el guion y los subtítulos. */
export function repartirTiempos(planos) {
  let desde = 0
  return planos.map((plano) => {
    const tramo = { id: plano.id, desde, hasta: desde + plano.segundos }
    desde = tramo.hasta
    return tramo
  })
}

export function duracionTotal(planos) {
  return planos.reduce((total, plano) => total + plano.segundos, 0)
}

function reloj(segundos) {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0').replace('.', ',')}`
}

/**
 * El bloque que se repite al principio de CADA prompt. Es lo único que mantiene
 * la coherencia entre planos: Nano Banana no recuerda el plano anterior, así que
 * lo que no esté escrito aquí se reinventa en cada imagen.
 */
export function construirBloqueDeConsistencia(marca, formato) {
  const f = FORMATOS[formato]
  return [
    `ESTILO DE MARCA — ${marca.nombre} (aplicar idéntico en todos los planos):`,
    `· Paleta: fondo ${marca.fondo}, superficies ${marca.superficie}, acento rojo ${marca.acento} (solo en un elemento por plano), texto ${marca.texto}, secundario ${marca.tenue}.`,
    `· Luz: ${marca.luz}.`,
    `· Cámara: ${marca.camara}.`,
    `· Encuadre: ${f.ratio} (${f.ancho}x${f.alto}), ${f.nombre}.`,
    `· Tono: técnico y sobrio. Nada de euforia de anuncio.`,
    `· Evitar siempre: ${NEGATIVOS_BASE.join('; ')}.`,
  ].join('\n')
}

/** Prompt de imagen (keyframe) listo para pegar en Nano Banana. */
export function construirPromptImagen(plano, contexto) {
  const lineas = [
    construirBloqueDeConsistencia(contexto.marca, contexto.formato),
    '',
    `PLANO ${plano.id} — imagen fija (keyframe).`,
    plano.descripcion,
  ]
  if (plano.composicion) lineas.push(`Composición: ${plano.composicion}.`)
  lineas.push(
    plano.textoEnPantalla
      ? `Deja aire limpio en el tercio ${contexto.formato === 'reel-vertical' ? 'inferior' : 'izquierdo'} para sobreimprimir después el texto "${plano.textoEnPantalla}". NO escribas el texto dentro de la imagen.`
      : 'Sin ningún texto dentro de la imagen.',
  )
  if (plano.evitar.length) lineas.push(`Evitar además: ${plano.evitar.join('; ')}.`)
  return lineas.join('\n')
}

/** Prompt de continuidad: reusa el keyframe anterior en vez de generar de cero. */
export function construirPromptVariante(plano, anterior) {
  if (!anterior) return null
  return [
    `Parte de la imagen del PLANO ${anterior.id} que acabas de generar (adjúntala).`,
    `Mantén idénticos: persona, vestuario, gimnasio, luz y paleta.`,
    `Cambia solo esto: ${plano.descripcion}`,
    `No reencuadres ni cambies el estilo.`,
  ].join('\n')
}

/** Prompt de animación (Veo / Flow) a partir del keyframe. */
export function construirPromptVideo(plano) {
  return [
    `Anima esta imagen (PLANO ${plano.id}) durante ${plano.segundos} s sin cambiar su composición.`,
    `Movimiento: ${plano.movimiento}.`,
    `Mantén idénticos persona, vestuario, luz y paleta.`,
    `Un solo plano continuo: sin cortes, sin texto nuevo, sin zoom brusco.`,
  ].join('\n')
}

export function nombreDeArchivo(slug, plano, extension) {
  return `${slug}-plano-${plano.id}.${extension}`
}

/** Paquete de producción completo en Markdown, listo para trabajar pegando. */
export function construirPaquete(briefCrudo, fecha) {
  const brief = normalizarBrief(briefCrudo)
  const { planos, formato, slug } = brief
  const tramos = repartirTiempos(planos)
  const contexto = { marca: brief.marca, formato }
  const f = FORMATOS[formato]

  const partes = [
    `# ${brief.titulo}`,
    '',
    `Paquete de producción generado el ${fecha} con \`npm run video\`.`,
    'Se trabaja **pegando en AI Studio / Flow**, con la cuota de la suscripción ya pagada.',
    'Ningún prompt de aquí consume API ni tokens de imagen.',
    '',
    '## Ficha',
    '',
    `| | |`,
    `|---|---|`,
    `| Objetivo | ${brief.objetivo} |`,
    `| Formato | ${f.nombre} — ${f.ratio} (${f.ancho}x${f.alto}) |`,
    `| Duración | ${duracionTotal(planos)} s en ${planos.length} planos |`,
    `| Archivos | \`${slug}-plano-NN.png\` → \`${slug}-plano-NN.mp4\` |`,
    '',
    '## Bloque de consistencia',
    '',
    'Ya va incluido al principio de cada prompt de imagen. Si generas un plano suelto,',
    'pégalo tú: sin él, Nano Banana reinventa la paleta y la persona en cada imagen.',
    '',
    '```',
    construirBloqueDeConsistencia(brief.marca, formato),
    '```',
    '',
    '## Planos',
    '',
  ]

  planos.forEach((plano, i) => {
    const tramo = tramos[i]
    const anterior = i > 0 ? planos[i - 1] : null
    partes.push(
      `### Plano ${plano.id} · ${reloj(tramo.desde)}–${reloj(tramo.hasta)} (${plano.segundos} s)`,
      '',
      `${plano.descripcion}`,
      '',
      `**1 · Imagen en Nano Banana** → guardar como \`${nombreDeArchivo(slug, plano, 'png')}\``,
      '',
      '```',
      construirPromptImagen(plano, contexto),
      '```',
      '',
    )
    const variante = construirPromptVariante(plano, anterior)
    if (variante) {
      partes.push(
        `**1b · Si la persona no casa con el plano ${anterior.id}**, en vez del prompt de arriba:`,
        '',
        '```',
        variante,
        '```',
        '',
      )
    }
    partes.push(
      `**2 · Animación en Veo / Flow** → guardar como \`${nombreDeArchivo(slug, plano, 'mp4')}\``,
      '',
      '```',
      construirPromptVideo(plano),
      '```',
      '',
    )
    if (plano.textoEnPantalla) {
      partes.push(`**3 · Texto en pantalla** (se sobreimprime en el montaje, no en la imagen): «${plano.textoEnPantalla}»`, '')
    }
    if (plano.locucion) {
      partes.push(`**Locución:** ${plano.locucion}`, '')
    }
  })

  const conLocucion = planos.filter((plano) => plano.locucion)
  if (conLocucion.length) {
    partes.push('## Guion de locución', '')
    conLocucion.forEach((plano) => {
      const tramo = tramos[planos.indexOf(plano)]
      partes.push(`- **${reloj(tramo.desde)}–${reloj(tramo.hasta)}** · ${plano.locucion}`)
    })
    partes.push('')
  }

  partes.push(
    '## Antes de publicar',
    '',
    '- [ ] Los planos casan entre sí: misma persona, mismo gimnasio, misma luz.',
    '- [ ] Ningún texto generado dentro de una imagen (se sobreimprime en el montaje).',
    '- [ ] Ninguna cara, medida, nombre ni captura de una asesorada real.',
    '- [ ] La duración total cuadra con el corte final.',
    '',
  )

  return partes.join('\n')
}
