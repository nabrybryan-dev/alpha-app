/** Lo que `identificarEstructura` devuelve, en lo que aquí se usa. */
export interface Veredicto {
  tipo: string
  motivo?: string
  cobertura?: number
  redondez?: number
  ajuste?: { r: number }
}

const LIMITE_REDONDEZ = 8

/**
 * El aviso de por qué la referencia no se pudo fijar, CON LOS NÚMEROS.
 *
 * El mensaje anterior decía «el contorno no es redondo» y nada más. En el
 * gimnasio eso no se puede accionar: no distingue entre la cámara torcida, el
 * borde del disco perdido contra un suelo oscuro, y el caso que más despista —
 * que el trazado se enganche al buje metálico del centro en vez de al canto del
 * disco. Los tres dan el mismo texto y llevan a mover el trípode, que solo
 * arregla uno.
 *
 * El radio encontrado es lo que los separa: si es mucho menor que el disco que
 * se ve en pantalla, lo que se midió fue el buje.
 */
export function avisoDeDisco(r: Veredicto): string {
  const cobertura = r.cobertura === undefined ? null : Math.round(r.cobertura * 100)
  const radio = r.ajuste ? Math.round(r.ajuste.r) : null

  // El núcleo distingue DOS formas de no ser redondo, y llevan a sitios
  // contrarios. «Tiene esquinas» no es un disco mal visto: es que lo que se tocó
  // no es un disco — un banco, una caja, el borde del tapete. Darle aquí el
  // consejo del buje manda a la persona a frotar el metal de algo que no tiene
  // metal, y es exactamente el fallo que arregló el #88: un mensaje que no
  // distingue entre causas manda a arreglar la que no es.
  if (r.motivo === 'eso tiene esquinas: un disco no las tiene') {
    return (
      `Eso tiene esquinas, y un disco no las tiene: lo que hay bajo el dedo es plano y ` +
      `recto —un banco, una caja, el borde del tapete—, no un disco. ` +
      (radio ? `El contorno que encontré mide ${radio} px de radio. ` : '') +
      'Toca sobre la CARA del disco de la barra. Si el disco está medio tapado por otro, ' +
      'no se puede fijar ahí: gira la barra o usa el otro extremo.'
    )
  }

  if (r.tipo === 'no-circular') {
    const residuo = r.redondez === undefined ? null : Math.round(r.redondez * 100)
    return (
      `El contorno no es redondo: se desvía un ${residuo ?? '?'} % del radio y el límite es ` +
      `${LIMITE_REDONDEZ} %. Encontré un círculo de ${radio ?? '?'} px de radio con el ` +
      `${cobertura ?? '?'} % del borde a la vista. Si ese radio es mucho menor que el disco ` +
      'que ves, enganché el buje del centro: toca sobre la goma negra, no en el metal. Si es ' +
      'del tamaño del disco, la cámara está torcida: ponla enfrente de la CARA del disco.'
    )
  }

  if (r.motivo === 'no se ve un contorno cerrado') {
    return (
      `Solo veo el ${cobertura ?? '?'} % del borde, y hace falta la mitad. El canto del disco se ` +
      'está perdiendo contra el fondo: acerca la cámara, o gira la barra para que el disco se ' +
      'recorte contra algo más claro que el suelo.'
    )
  }

  return `Ahí no veo un disco: ${r.motivo ?? 'no se pudo ajustar'}. Toca el centro del disco, o cambia de referencia.`
}
