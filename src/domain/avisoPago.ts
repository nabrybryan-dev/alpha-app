/**
 * Aviso de mensualidad vencida con botón de pago (Bryan, 21-oct-2026).
 *
 * La fuente es `perfiles.datos.avisoPago`, que el coach escribe a mano (sin migración):
 * `{ venceDesde: '2026-10-05', texto?: '…', enlace: 'https://…', activo: true }`.
 * La ficha ya baja entera con `datos`, así que esto solo decide si se pinta y con qué texto.
 *
 * Regla de oro: sin enlace https válido NO se muestra nada. Un botón roto, o uno que lleve
 * a un `javascript:`, es peor que no avisar. Los datos vienen de un jsonb sin esquema, por
 * eso todo entra como `unknown` y se comprueba campo a campo.
 */
export interface AvisoPagoVisible {
  texto: string
  enlace: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * «2026-10-05» -> «5 de octubre». Se parte el texto a mano: `new Date('2026-10-05')` es
 * medianoche UTC y en Colombia (UTC-5) caería en el día anterior. Una fecha imposible
 * (30 de febrero) se rechaza en vez de inventar otra.
 */
export function fechaEnEspanol(iso: unknown): string | undefined {
  if (typeof iso !== 'string') return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return undefined
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const real = new Date(Date.UTC(anio, mes - 1, dia))
  if (real.getUTCFullYear() !== anio || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== dia) return undefined
  return `${dia} de ${MESES[mes - 1]}`
}

/** Solo https, con servidor y sin usuario:clave incrustados. Devuelve la URL normalizada. */
function enlaceHttpsValido(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || valor.trim() === '') return undefined
  let url: URL
  try {
    url = new URL(valor.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || !url.hostname) return undefined
  if (url.username || url.password) return undefined
  return url.href
}

function textoPorDefecto(nombre: string, venceDesde: unknown): string {
  const fecha = fechaEnEspanol(venceDesde)
  const vencida = fecha ? `venció el ${fecha}` : 'está vencida'
  return `${nombre}, tu mensualidad de Alpha ${vencida}. Ya te cargué la semana para que no pierdas el ritmo que traes. Para seguir con tu plan, ponte al día aquí:`
}

/**
 * @param datos  `perfil.avisoPago` tal como llegó de la base (sin fiarse de su forma).
 * @param nombre primer nombre de la persona, para el texto por defecto.
 */
export function avisoPagoVisible(datos: unknown, nombre: string): AvisoPagoVisible | undefined {
  if (!datos || typeof datos !== 'object') return undefined
  const d = datos as Record<string, unknown>
  if (d.activo !== true) return undefined
  const enlace = enlaceHttpsValido(d.enlace)
  if (!enlace) return undefined
  const propio = typeof d.texto === 'string' && d.texto.trim() !== '' ? d.texto : undefined
  return { texto: propio ?? textoPorDefecto(nombre, d.venceDesde), enlace }
}
