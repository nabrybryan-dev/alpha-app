# Consola del coach: perfil completo, jerarquía y movimiento (2026-09-26)

## Qué y por qué

Bryan: «se siente muy escueto… que los asesorados activos cuenten con todo su perfil y cada
desplegable con datos; interacciones conectadas; más movimiento».

Auditoría de solo lectura sobre la base (26-sep, 23 personas con microciclo activo): los datos
existían y la consola no los pintaba — objetivo, edad, disponibilidad y pauta (`perfiles.datos`),
el formulario de nutrición con medidas y alimentación (`perfil_alimentario.respuestas`), el
cribado (`cribado_vigente`), el peso de los check-ins (10+ por persona en la mitad de la
cartera), la tabla de microciclos del plan estratégico (`contenido.cabecera/filas`), el
historial de microciclos, las respuestas a cuestionarios.

## Decisiones

- **Tres fuentes de peso y perímetros**, cruzadas y nunca fundidas: ficha, formulario de
  nutrición y check-in. Cada punto lleva su fuente (`domain/consolaCoach/perfilCompleto.ts`).
- **Semáforo del cribado descriptivo**, no regla clínica: rojo = síntomas con el esfuerzo o
  cardiopatía (PAR-Q); ámbar = cualquier otro «sí». TODO-DECISION: si la medicación crónica
  sube a rojo.
- **Vacío que dice qué falta y cómo se consigue** en cada sección (`Falta`), y distingue «no
  existe» de «tu permiso no alcanza» (RLS de `perfiles` y `cribado` es solo del coach).
- **La semana vigente usa `armarSemana`** (la misma rejilla que ve la persona) y
  `compararMicrociclos` reconoce días con tilde, en el nombre o por orden (D1…Dn): antes la
  revisión y la cuadrícula salían vacías para quien no tiene `dia` sin tilde.
- **Movimiento solo con CSS** (keyframes con solo `from` en `tokens.css`): el estado final es el
  del elemento, así que sin animación —jsdom, movimiento reducido, pestaña congelada— todo se ve.
  Sin librerías nuevas.
- **Conectada**: selección persistente (sessionStorage con try/catch), cabecera fija de la
  persona, Revisión y Agentes enlazan a la ficha, acciones optimistas con confirmación en sitio,
  lecturas asíncronas compartidas (`ProveedorDatosConsola`).

## Pendiente (fuera de este cambio)

- Migración de lectura para staff con `leer_entrenamiento` en `perfiles` y `cribado` (hoy solo
  el coach): propuesta en el PR, no aplicada.
- `CoachLayout` redirige a quien no es coach: la nutricionista con capacidades no entra a
  `/coach/consola` aunque la RLS la deje leer.
