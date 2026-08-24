# La semana programada no llega al asesorado — diseño

**2026-08-24**

Una asesorada abre la app un **lunes** y en Hoy le sale «PENDIENTE DEL MIÉRCOLES»
con la sesión de cuádriceps del microciclo anterior, mientras la semana que se le
programó el domingo —la que empieza **hoy**— sigue guardada sin activar.

Son **dos fallos encadenados**, y conviene no confundirlos porque cada uno rompe
algo distinto.

---

## Fallo 1 · La fecha que eligió el coach no activa nada

`revisarCartera` solo mira la propuesta preparada **después** de comprobar que el
microciclo en curso venció:

```ts
const cierre = evaluarCierre(activo, hoy, pendientes)
if (!cierre.vencido) return { usuario, estado: 'en-curso', ... }   // ← sale aquí
const preparada = propuestaPreparada(db, usuario.id, activo.numero + 1)
```

Con cadencia 8 el microciclo en curso casi nunca vence en lunes. Así que una
propuesta preparada para arrancar **hoy** se queda en `propuesto` hasta que al
anterior le llegue su `fechaInicio + cadenciaDias`, que puede ser tres días más
tarde. La `fechaInicio` que el coach eligió a mano —el único dato de esa
propuesta que expresa una decisión humana— no la lee nadie.

El efecto para la persona: entrena la semana vieja mientras la nueva existe.

**Regla nueva:** si hay una propuesta preparada para el número siguiente y su
`fechaInicio` ya llegó (`<= hoy`), se activa, **aunque al microciclo en curso le
queden días de cadencia**. La fecha que puso una persona manda sobre la que
calcula la cadencia. Cerrar antes no pierde nada: las sesiones y las series se
quedan dentro del microciclo cerrado (`activacion.ts`).

Lo que **no** cambia: una preparada con `fechaInicio` futura no se adelanta salvo
que el microciclo en curso ya haya vencido, que es el comportamiento de hoy y
existe para no dejar a nadie sin programación.

---

## Fallo 2 · Hoy y Entrenar responden distinto a la misma pregunta

Había dos funciones para «¿qué sesión le toca?»:

| Pantalla | Función | Criterio |
|---|---|---|
| Entrenar | `sesionDestacada` (`rutaEntrenamiento.ts`) | hoy → la siguiente por delante → la rezagada |
| Hoy | `sesionSugerida` (`calendario.ts`) | hoy → **`pendientes[0]`**, la primera del array |

`pendientes[0]` no es «la siguiente»: es la primera por `orden`. Si el lunes no
hay sesión pendiente, Hoy empuja la más antigua que quedó colgada aunque mañana
toque otra. Es exactamente el mismo bug que ya se arregló **dentro** de Entrenar
—el CTA decía una sesión y el calendario pintaba otra— y que documenta el
encabezado de `sesionDestacada`. Se arregló allí y quedó vivo aquí.

**Regla nueva:** Hoy deja de tener criterio propio. Usa `armarSemana` +
`sesionDestacada`, las mismas de Entrenar. `sesionSugerida` se borra: mientras
exista, alguien la volverá a llamar.

---

## Lo que este cambio NO arregla

**Nadie dispara el barrido.** `barrerYActivar` corre en un único sitio,
`PanelMicrociclos` — el panel del coach. No hay proceso de madrugada porque no
hay servidor propio (`revisionCartera.ts` lo dice en su cabecera). Con este
cambio la semana preparada se activa **cuando el coach abre su panel**, no a las
00:00 del día que empieza.

Es una mejora real —antes no se activaba ni abriéndolo— pero el disparador sigue
siendo humano. Hacer que la activación salga del dispositivo del asesorado es
otra decisión: le daría a la app de la persona la capacidad de escribirse su
propia prescripción, y eso se discute aparte, no se cuela dentro de este arreglo.

---

## Dos tests que hubo que reescribir, y por qué

`programarSemana.test.ts` se puso rojo, y uno de los dos casos lleva etiqueta de
aislamiento. Va explicado porque en este repo un test de aislamiento en rojo
significa por defecto que **el cambio está mal**:

- **«a cada uno se le activa la suya el día que vence»** afirmaba precisamente lo
  que se ha arreglado: que manda la cadencia y no la fecha del coach. Reescrito
  para afirmar lo nuevo —manda la fecha elegida— conservando lo que protegía: que
  a cada uno le llega la suya y con la fecha que se le puso. Se le añadió el caso
  de la víspera, que antes no existía: una preparada con fecha futura no se
  adelanta.

- **«activar la semana de uno no le mueve el microciclo a los otros»** preparaba
  a los tres asesorados la misma semana y luego comprobaba que solo se movía uno.
  Con la regla nueva se mueven los tres —porque el coach les puso a los tres el
  mismo lunes, no porque se contagien—, así que la comprobación ya no distinguía
  contagio de calendario. Ahora se le prepara a ella una semana que empieza hoy y
  a los demás una que empieza dentro de un mes: si alguno de ellos se moviera,
  sería contagio de verdad. La propiedad que vigila es la misma y ahora es la
  única explicación posible de un fallo.

Los dos tests dedicados al aislamiento (`SessionProvider.aislamiento.test.tsx` y
`data/nube/perdida-datos.test.ts`) no se tocaron y siguen verdes.
