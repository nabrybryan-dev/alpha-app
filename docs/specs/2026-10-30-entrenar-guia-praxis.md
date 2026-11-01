# Entrenar: el cuerpo limpio y la guía de Praxis (30-oct-2026)

## Por qué

Bryan, 30-oct, tras probar la vista previa en su teléfono: el centro de Entrenar está «muy cargado
de botones», y lo pedido es algo «práctico», «muy profesional» y fácil. Pide además integrar el
salón con Praxis: abrir las zonas musculares, mostrar el sujeto anatómico y las áreas a entrenar,
explicar con precisión qué se hace y navegar «sin gastar la clave de Anthropic».

## Qué es la guía y qué no es

- Es navegación local: lee la sesión y el microciclo que la app ya tiene, más un texto fijo por región.
- **No llama a ningún modelo ni a ningún servicio.** No hay campo de texto. Una prueba revisa el fuente.
- **No abre la charla de Praxis**, que sigue cerrada a asesorados (`PRAXIS_ABIERTA_A_ASESORADOS`):
  nada de lo que escribe una persona pasa por aquí, así que tampoco hace falta el filtro de riesgo.
- No da consejo clínico ni cambia la prescripción. El dolor solo se recuerda como se marcó.
- No muestra porcentajes de activación ni cifras mecánicas (decisión 57 del laboratorio).

## Diseño

En reposo, el centro tiene el cuerpo, el nombre del ejercicio, los puntos de progreso y **una sola
línea de Praxis**. Tocar un músculo o esa línea abre un panel en la mitad baja. El cuerpo sigue
visible arriba, gira hacia la cara correcta, se acerca a la zona y solo esa zona se enciende.

Dentro de una zona se lee: las partes, qué hace, qué ejercicios de hoy la trabajan (principal o
apoyo y cuánto cuenta cada serie), series anotadas y su lectura de la prescripción. Se pasa de zona
deslizando de lado o tocando otro músculo. Tocar un ejercicio lleva a ese ejercicio.

## Relevo sin pérdidas

| Lo que estaba en el centro | Dónde queda |
|---|---|
| Piel, Músculo y Hueso | Guía, sección «Vista» (mismos radios) |
| Hoy y Semana | Guía, sección «Vista» (mismos radios) |
| Movimiento | Guía, sección «Vista»; en movimiento sigue la tecla «Cuerpo» |
| Dar la vuelta | Arrastrar el cuerpo, y tecla en «Vista» |
| Lista de series por región | Índice de la guía, con las 15 regiones |
| «Rojo: lo que falta por trabajar» | La línea de Praxis y el índice |
| «Te duele» | Sigue en el centro, siempre visible: es seguridad |
| Reloj de sesión | Vista de movimiento; en el cuerpo solo si hay cuenta (descanso, excéntrico, carga) |
| Cámara y mando del reloj | Vista de movimiento |
| Aviso «anotadas, no estímulo» | En la guía, junto a las cifras |

## Límites

- `SalonEntrenar.tsx`, `VisorPatron.tsx` y `motor.ts` están congelados: sus cambios no suman líneas.
- Los textos fijos de cada región son anatomía general, sin citas: los revisa Bryan antes de unir.
- Va en la rama `fase4/entrenar-praxis`, apilada sobre `fase4/boton-3d`. Nada llega a producción sin su sí.
