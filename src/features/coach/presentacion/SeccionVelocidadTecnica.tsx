/**
 * VELOCIDAD Y TÉCNICA — el bloque RESERVADO (decisión de Bryan, 9-oct-2026).
 *
 * El encoder todavía no guarda mediciones que se puedan enseñar (la velocidad de la barra, el
 * porcentaje de pérdida, las palancas y el centro de masas), así que esta sección dice con
 * claridad que no las hay y NADA MÁS: ni cifras de ejemplo, ni gráficas vacías, ni «próximamente»
 * con datos de relleno. Una pantalla que se le enseña a la persona no puede mostrarle un número
 * que no es suyo. Cuando el encoder guarde mediciones, esta sección se sustituye por la real.
 */
export function SeccionVelocidadTecnica({ nombre }: { nombre: string }) {
  return (
    <p className="text-[15px] leading-relaxed text-texto/90">
      Todavía no hay mediciones de velocidad ni tomas de técnica de {nombre}. Aparecerán aquí cuando el encoder las
      guarde.
    </p>
  )
}
