/**
 * Reflexión final que se muestra al cerrar la sesión, según cómo la vivió el
 * asesorado (RPE = qué tan dura, PRS = qué tan recuperado entró). El objetivo
 * es reconocer el esfuerzo real, no felicitar en automático: entrar cansado y
 * cumplir vale distinto que un día fácil.
 */
export function reflexionSesion(rpe: number, prs: number): string {
  // Entró cansado y aun así entrenó: eso es carácter.
  if (prs <= 4 && rpe >= 7) return 'Entraste sin batería y aun así la sacaste. Eso es carácter puro. 🖤'
  if (prs <= 4) return 'No estabas al 100 y cumpliste igual. Constancia por encima de la motivación. 🦅'

  // Sesión durísima con buena recuperación: lo dio todo.
  if (rpe >= 9) return 'Lo diste TODO hoy. Sesión brutal — así se rompen las marcas. 🔥'
  if (rpe >= 7) return 'Sesión fuerte y bien ejecutada. Vas construyendo algo grande. 💪'

  // Sesión llevadera: día sólido de acumulación.
  if (rpe <= 3) return 'Día suave y controlado. La recuperación también entrena. 🧠'
  return 'Día sólido. Ladrillo a ladrillo se construye la disciplina Alpha. 🦅'
}
