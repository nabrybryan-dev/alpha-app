# Subir solo lo que el asesorado cambia, no el microciclo entero

**2026-08-15** · Raíz encontrada al aplicar la migración 0036.

## Qué pasó

La 0036 reescribió la categoría de 849 ejercicios en 33 microciclos. Las cuatro
comprobaciones dieron cero filas. **Poco después, `m-jacobo-2` había vuelto entero a la
taxonomía vieja**: 16 ejercicios, ninguno migrado.

No fue la migración: fue la app.

```ts
// sync.ts, antes
function subirMicrociclo(local: Db, microcicloId: string): void {
  encolar({ tabla: 'microciclos', tipo: 'upsert',
    payload: { ..., datos: microciclo } })   // el blob local ENTERO
}
```

Jacobo registró una serie. Su móvil subió su copia local completa —con las categorías de
antes— y la escribió encima de la migrada. `hidratar.ts:71` ya lo decía: *«el blob lo
escribe el último dispositivo que suba ese microciclo»*.

## Por qué importa más que esta migración

Cualquier escritura del coach sobre `microciclos.datos` —una migración, una corrección de
carga, un cambio de prescripción— **puede ser deshecha por el móvil del asesorado** sin que
nadie se entere. La app no avisa: el dato simplemente vuelve atrás.

Y no se detecta con `actualizado_en`: esa columna tiene `default now()` pero **ningún
trigger**, así que solo registra el alta. Una escritura no deja rastro.

## Lo que ya estaba bien

`cambiarEstadoEnNube` manda **solo la columna** `estado`, y su comentario explica por qué:
*«Un cambio de estado es una TRANSICIÓN, no una foto. Mandar solo la columna es lo único que
hace falta y es lo único que no puede pisar el trabajo de nadie.»*

Ese razonamiento estaba escrito y no se había aplicado al resto.

## Qué cambia

De las cuatro llamadas a `subirMicrociclo`, **una es legítima y tres no**:

| Llamada | Quién | Veredicto |
|---|---|---|
| `guardarPropuesta` | El coach crea el microciclo | **Se queda.** El microciclo es nuevo, no hay nada que pisar |
| `registrarSerie` | El asesorado entrena | Pasa a escritura quirúrgica |
| `guardarTestPost` | El asesorado termina la sesión | Pasa a escritura quirúrgica |
| `marcarParte` | El asesorado tilda el calentamiento | Pasa a escritura quirúrgica |

### Tres funciones en el servidor, tontas a propósito

`0037` añade `fijar_series_ejercicio`, `fijar_test_post` y `fijar_preparacion_sesion`.

**El cliente calcula el valor; el servidor solo lo coloca en su sitio.** Es deliberado:
`marcarParte` es un *toggle* que además materializa la plantilla de calentamiento si falta,
y `registrarSerie` reemplaza por `orden` y reordena. Replicar esas reglas en SQL sería
tenerlas escritas dos veces, y dos copias de una regla divergen — que es justo el problema
que este cambio arregla.

Las tres son `security invoker`, así que **la RLS de `microciclos` sigue mandando**: un
asesorado solo puede tocar los suyos. Y llevan `revoke execute from public` + `grant execute
to authenticated`, porque `create function` concede EXECUTE a PUBLIC y todo lo de `public`
queda expuesto como RPC a la anon key.

### La cola aprende un tipo nuevo

`OperacionPendiente` gana `tipo: 'rpc'` con el nombre de la función. `claveDeFila` colapsa
solo los `upsert`; se extiende para colapsar también los `rpc` por función + argumentos de
identidad, porque cada llamada manda el array completo de series de ese ejercicio: la última
gana y las anteriores sobran. Sin eso, cuatro series en un ejercicio dejan cuatro
operaciones en cola donde basta una.

## Lo que este cambio NO arregla

- **Dos coaches editando el mismo microciclo a la vez** siguen pisándose vía
  `guardarPropuesta`. Fuera de alcance: hoy hay un coach.
- **Lo ya revertido.** `m-jacobo-2` sigue con la taxonomía vieja y hay que reaplicarle la
  0036 después de desplegar esto, no antes: si se reaplica antes, su móvil lo vuelve a pisar.
- **`actualizado_en` sigue sin trigger.** Se deja anotado como pendiente aparte; tocarlo
  ahora mezclaría dos cambios en la capa que más daño ha hecho en este proyecto.

## Cómo se comprueba

1. Test en rojo primero: registrar una serie **no** puede cambiar la categoría de ningún
   ejercicio del microciclo. Con el código viejo falla.
2. `npm run verify` verde.
3. En la base, tras desplegar: reaplicar la 0036 sobre `m-jacobo-2` y volver a mirarlo al
   día siguiente. Si sigue migrado después de que Jacobo entrene, el arreglo funciona.
