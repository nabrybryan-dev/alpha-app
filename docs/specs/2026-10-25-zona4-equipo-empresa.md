# Zona 4 · Equipo y Empresa (fase 3, 25-oct-2026)

## Qué

Llevar a la app real los pasos 9, 10 y 11 del plan 14 —el staff, Equipo y Empresa— y cerrar lo
que faltaba del paso 2 (la mesa del encoder y `/marca`, solo del equipo; retirar la cartera
duplicada). La referencia visual es la maqueta 7 (`REDISENO-APP-20261021/maqueta-v7.html`).

## Por qué

- El staff tiene **tres sombreros** el mismo día: entrena, nutre y administra. Un modo que
  esconde trabajo esconde alarmas, así que se ven juntos y se filtran, con un solo filtro que
  viaja entre el Hoy del equipo, la Bandeja, Equipo y Empresa.
- La **seguridad sale siempre**: una alerta de dolor del check-in (≥ 4/10) no se puede quedar
  detrás de un filtro. La derivación al coach ya existía; ahora tiene un sitio fijo.
- Había **dos carteras** (`/equipo` y `/coach/asesorados`) y **dos puertas** a la ficha
  (`/coach/asesorado/:id` y la consola de siete pestañas). Queda una cartera y una ficha; las
  direcciones viejas redirigen o siguen abriendo la misma pantalla.
- La mesa del encoder y `/marca` no tienen sentido para un asesorado: el encoder se usa
  **dentro** de la serie y el manual de marca es interno.

## Decisiones

1. **Un filtro, no cuatro.** `domain/equipo/sombreros.ts` (puro) decide qué cuenta cada chip y
   qué deja ver; `features/equipo/filtroSombreros.ts` lo guarda fuera de React para que viaje
   entre pantallas. «Todo» es el estado de partida; recargar lo reinicia (abrir la app no debe
   esconder trabajo de ayer).
2. **Cifras solo donde hay dato real.** Equipo cuenta personas que piden atención (Entreno) y
   planes esperando firma (Nutrición). Administración no tiene una cuenta propia y su chip va
   sin número. No se inventan totales de tareas.
3. **La seguridad es una lista aparte.** `domain/equipo/seguridad.ts` busca el último check-in de
   cada persona y devuelve las alarmas ordenadas por dolor. `AvisosDeSeguridad` se pinta fuera de
   todo filtro.
4. **Bandeja compone, no rehace.** Tareas = `MiPlanPage`; Mensajes = chat/consultas (coach) o el
   buzón del equipo; Firmas = las dos bandejas de siempre. Cada pestaña pertenece a un sombrero
   para que el filtro sea predecible.
5. **Empresa agrupa las herramientas existentes** (consola, revisiones, encoder, Praxis,
   nutrición del equipo, cifras, estrategias, administración, creadores) según permisos. Las
   rutas viejas no se mueven; sólo se llega a ellas desde un sitio único. La hoja «Tus tres
   sombreros» nombra el riesgo alto con su permiso (`autorizar_excepcion`): no cambia quién firma.
6. **Cartera única**: `/coach/asesorados` redirige a `/equipo`. Los paneles que vivían en la
   cartera vieja (salud de los datos, embudo de avisos, microciclos) se mudan a `/equipo`.
7. **Ficha única**: `/equipo/:usuarioId` y `/coach/asesorado/:usuarioId` montan la misma
   pantalla; la segunda se conserva para los enlaces ya enviados. La consola de siete pestañas
   sigue viva en Empresa › Entrenador.
8. **«Vista de la app»** pasa de dos botones a un interruptor con el mismo dato
   (`perfil.vistaSimple`) y el mismo camino de guardado. Solo el staff puede cambiarlo (trigger
   `proteger_perfil`); no se toca.
9. **Puertas**: `SoloEquipo` aplica `soloEquipo` en el router para encoder, `/marca`, Equipo, la
   ficha, Bandeja y Empresa. La tabla de rutas y el router se contrastan en `rutas.acceso.test`.
10. **Lo que no se toca**: vista simple de Karin, compuerta de nutrición, Praxis cerrada,
    derivación de alarmas, dolor = rojo, riesgo alto solo Bryan, avisos push y `avisos-plan`.

## Lo que queda fuera (y por qué)

- La ficha de la maqueta tiene pestañas Semana · Plan · Progreso · Salud · Mensajes. La app
  conserva sus pestañas (Resumen · Entrenamiento · Vida · Nutrición · Cuestionarios) y su
  contenido: renombrarlas sin mover los datos habría sido cosmético y arriesgado. No se hizo.
- Tareas de Manuela, notas «leídas» y revisión «escuchada» no existen en `main`: no se inventan.
- No se rediseñan las pantallas internas (consola, estrategias, administración, nutrición del
  equipo); se agrupan y se enlazan.
- Nada se probó en un iPhone real ni con lector de pantalla.

## Pruebas

- `domain/equipo/sombreros.test.ts`, `domain/equipo/seguridad.test.ts`.
- `features/equipo/filtroSombreros.test.ts`, `Sombreros.test.tsx`.
- `features/equipo/BandejaPage.test.tsx`, `EmpresaPage.test.tsx`, `EquipoPage.unica.test.tsx`.
- `features/coach/MiDiaCoachPage.test.tsx`, `VistaSimpleDeLaFicha.test.tsx`.
- `components/ui/BottomNav.test.tsx`, `app/rutas.*.test.*`, `app/router.test.tsx`,
  `app/layouts.coach.test.tsx`, `app/CoachLayout.acceso.test.tsx` (actualizados a la barra nueva).
