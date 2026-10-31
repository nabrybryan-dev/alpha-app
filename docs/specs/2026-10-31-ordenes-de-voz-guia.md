# Entrenar: órdenes de voz sobre el sujeto (31-oct-2026)

## Por qué

Bryan, 31-oct: el sujeto de Praxis debe ir integrado con el que se mueve, y al navegar la persona da órdenes
por voz de hacia dónde ir y se le muestran los ejercicios y movimientos.

## Qué es

- Un micrófono en el salón. Un toque y se habla: en el gimnasio las manos no están libres.
- Lista cerrada de órdenes, sin modelo (`salon/voz/ordenesDeVoz.ts`): zonas, ejercicios de hoy, ver el movimiento,
  dar la vuelta, de frente o de espaldas, siguiente, anterior, lo de hoy, todas las zonas, cerrar.
- Cada orden hace lo mismo que un toque que ya existe (`ejecutarOrden.ts`). No hay camino nuevo para cambiar
  nada: no anota series ni toca la prescripción.
- Lo que no es una orden se contesta «no entendí», y lo ambiguo pregunta cuál. No se adivina.

## Decisiones de seguridad

- **Solo el equipo por ahora** (`puedeVerPraxis`). El audio lo transcribe el navegador (Google en Android, Apple en
  iPhone), así que el texto y la voz pasan por un tercero. Abrirlo a asesorados espera lo mismo que Praxis (P8).
- El filtro de riesgo va primero. Lo de salud («me duele», una señal de riesgo) nunca navega y contesta con la
  derivación. Esta capa solo usa el diccionario: el modelo no corre aquí, y no reemplaza a un profesional.
- Lo dicho no se guarda ni se envía a nuestros servicios.
- `vercel.json`: `microphone=()` pasa a `microphone=(self)`. Con el valor anterior el navegador puede negar el micrófono en
  toda la app, también a la voz de Praxis. Es un cambio de cabecera de producción y va al fusionar.

## Lo que falta probar en un teléfono real

Permiso del micrófono con la cabecera nueva, iPhone (Safari y app instalada), ruido del gimnasio, y que el
botón no tape nada a 360 px.

## Fuera de este prototipo

Praxis hablando en voz alta, caminar por la sala, anotar series con la voz y órdenes con un modelo.
