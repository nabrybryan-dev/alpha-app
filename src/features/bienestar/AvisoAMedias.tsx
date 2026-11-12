/**
 * Aviso encima del formulario cuando el check-in de hoy quedó A MEDIAS: Praxis anotó parte de lo que la persona
 * contó. Dice qué pasa con los puntos para que no parezca un error (Bryan, 7-nov-2026: suma al completarlo).
 */
export function AvisoAMedias() {
  return (
    <p role="status" className="mb-3 rounded-boton border border-linea bg-surface-2 px-3 py-2 text-sm text-texto">
      <b>Tu check-in va a medias.</b> Ya está puesto lo que le contaste a Praxis; completa lo que falta y suma al guardarlo.
    </p>
  )
}
