# Rendimiento — plantilla de acta

Copia este archivo, ponle fecha y aparato en el nombre
(`rendimiento-2026-09-08-iphone-bryan.md`) y rellénalo. Un acta sin las tres primeras
líneas de contexto no se puede releer dentro de un mes: 30 fps en un iPhone 15 con la sala
de Blender puesta y 30 fps en un Android de 2019 sin ella son dos medidas distintas.

## Cómo se levanta

1. Abre la app con la bandera: `…/entrenar?medir=1`. Aparece un recuadro abajo a la
   izquierda con las cifras vivas. **Sin la bandera el medidor no existe**: no crea nodo,
   no escucha nada y no pide un solo fotograma.
2. Usa la pantalla como se usa de verdad, al menos un minuto: gira la sala, cambia de
   ejercicio, atraviesa el cuerpo hasta el hueso y vuelve, deja la app en segundo plano y
   vuelve a ella.
3. Pulsa **Copiar informe**. El JSON queda en el portapapeles. (Si el navegador no deja
   copiar, el propio recuadro abre un cuadro de texto con el informe seleccionado.)
4. Pégalo abajo.

## Contexto

- **Aparato y navegador**:
- **Pantalla medida** (y qué se hizo):
- **Versión / commit**:

## Los siete campos

| Campo | Valor | Qué dice |
|---|---|---|
| **fps** | | Los fotogramas por segundo de la MEDIANA, no del total: los que se ven la mitad del rato. Por debajo de 50 el salón se lee a tirones. |
| **Tiempo de fotograma (p50 / p95)** | / | La media miente. El p95 es cómo se ve de verdad: 58 fps de media con un fotograma de 300 ms cada dos segundos se ve como un tirón. |
| **Fotogramas lentos (> 33 ms)** | | Cuántos pasaron de dos fotogramas de 60 fps. Es el tamaño del problema, no su gravedad. |
| **Memoria observable (MB)** | | Montón de JS, y solo en Chromium. `—` no es cero: es que este navegador no lo cuenta. Lo que importa no es la cifra, es que no CREZCA sola. |
| **Cambios de ejercicio** | | Cuántas veces se cambió mientras se medía. Sin esto no se sabe si el p95 malo es de dibujar o de reconstruir mallas. |
| **Capas visitadas** | | Qué escalones del eje W se llegaron a ver. Medir sin atravesar el cuerpo no mide el eje W. |
| **Vueltas desde segundo plano** | | Cuántas veces volvió la app. Es donde aparecen los fallos raros: con la app detrás el navegador congela los temporizadores. |

## El JSON, pegado tal cual

```json
(pega aquí lo que copió el botón «Copiar informe»)
```

## Qué se decide con esto

Una frase por cada cifra que esté fuera de lo esperado, y qué se va a hacer. Un acta sin
esta sección es una lista de números.

-
