# Zona 3 · Semana, Progreso y Praxis (25-oct-2026)

Encargo: `REDISENO-APP-20261021/17-ENCARGO-DEEPSEEK-ZONAS-2-4.md`, pasos 6, 7 y 8 de
`14-FASE3-SUBIR-DISENO.md`. Rama `fase3/z3-semana-progreso-praxis`, worktree propio.

## Qué tiene que pasar

1. **Semana entra en la barra y Bienestar sale de ella.** El check-in se hace en línea
   dentro de Hoy. `/bienestar` deja de ser pestaña, pero **no se borra**: sigue viva como
   detalle con el formulario completo, el historial y las medidas.
2. **Semana es la bandeja de la semana** (`/semana`): revisión con voz, notas del coach,
   lo que toca responder (cuestionarios y tarjeta del domingo), mensajes de estilo de vida
   y chat del equipo, con un resumen de lo hecho.
3. **Progreso absorbe** el historial de check-ins, las medidas, los logros y el mapa de
   fatiga. `/logros` sigue viva como detalle (ranking, historias, reconocimientos).
4. **Praxis**: las tarjetas 3D salen cuando la conversación las nombra, nunca al abrir; en
   la Quieta no queda ninguna y el cosmos se detiene (la Quieta ya existía).

## Lo que NO se toca

- La vista simple de Karin (`perfil.vistaSimple`): sus pruebas siguen en verde.
- La compuerta de nutrición (`NutricionLayout`).
- Praxis cerrada a asesorados (`domain/praxis/acceso.ts` y `PraxisPage`).
- La derivación de alarmas al coach y el dolor en rojo (`domain/senales/dolor`,
  `CheckinForm`).
- El riesgo alto solo lo firma Bryan (`quienDecide`).
- Los avisos push y `avisos-plan` (rutas `/mi-plan`, `/coach/mi-plan`,
  `/coach/revisiones`).

## Decisiones de diseño (para no inventar datos)

- **No se inventan tareas de Manuela**: no existe el modelo. Semana las deja fuera y lo
  dice en el PR. Tampoco se inventa el estado «nota leída» ni «revisión escuchada»: la
  revisión se muestra tal cual y las notas se leen, sin contador falso.
- El resumen «N de M hechas» cuenta **solo lo que la app sabe**: sesiones pautadas y
  cuestionarios asignados. No cuenta check-ins ni notas, que no tienen estado de «hecho».
- Las tarjetas de Praxis son atajos a pantallas que ya existen (`/bienestar`,
  `/progreso`, `/chat`). No abren flujos nuevos ni prometen nada que no exista.
- La Quieta de Praxis no se reimplementa: el motor ya la tiene. Las tarjetas se retiran
  cuando llega y no vuelven hasta una conversación nueva.
