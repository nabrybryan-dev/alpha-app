# La sesión lleva fecha

**2026-09-04** · Bryan pidió empezar por aquí después de preguntar si la ondulación
flexible del día a día ya funcionaba en la app.

## El problema, medido

`Sesion.dia` guarda **el nombre del día de la semana** — «LUNES», «MARTES» —, que es el
hueco que pidió el plan. Barrido sobre la base de producción el 2026-09-04:

| | |
|---|---|
| sesiones en la cartera | **607** |
| con `dia` puesto | 312 |
| **con `dia` que sea una fecha** | **0** |
| sesiones activas | 107 |
| activas con alguna marca de preparación fechada | **33** |

O sea que el único rastro fechado que deja hoy el asesorado es
`preparacion[].hechoEn`, y **tres de cada cuatro sesiones activas no lo tienen**.

## Por qué importa ahora

`src/domain/bucleDelDia.ts` —la ondulación flexible intra-semana, aprobada por el coach
el 2026-08-25 y **en sombra** hasta que una corrida la avale— decide cruzando dos cosas:
cómo rindió la persona y **cómo venía ese día**. «Cómo venía» sale del check-in diario,
que se guarda con `fecha` (`CheckinDiario.fecha`).

Sin una fecha en la sesión no hay por dónde emparejarlos. Y el despliegue pactado (§7 del
supuesto) es correr un microciclo entero **calculando sin enseñar** y comparar si esos
ajustes habrían reducido la discrepancia. Esa corrida, hecha hoy, decidiría sobre el 30 %
de los días y saldría con un número que parece malo cuando lo que falla es el reloj.

## La decisión

Un campo nuevo, `Sesion.fecha`, `AAAA-MM-DD`.

**Se llama igual que el del check-in a propósito**, y las dos salen de la misma función
(`hoyIso()`, en `src/lib/fecha.ts`): fecha **local** del dispositivo, nunca UTC. En Bogotá
(UTC−5) una sesión de las ocho de la tarde con `toISOString()` saldría fechada al día
siguiente, y se emparejaría con el check-in equivocado. Hay una prueba con esa hora exacta.

**La escribe la app, no el plan, y una sola vez.** La pone la primera acción que ocurre
dentro de la sesión —marcar un calentamiento, anotar una serie o guardar el test— y no se
vuelve a tocar. Si alguien abre el martes y anota el jueves, manda el martes: es el mismo
criterio que la casa ya usaba con la primera marca de `preparacion`. La regla vive en dos
sitios (cliente y SQL) y no es una duplicación: la cola de sync reintenta, y un reintento
que llegue el jueves no puede reescribir el martes.

## Lo que hubo que tocar, y por qué no era una línea

1. **`src/lib/fecha.ts`** — `hoyIso` sale de `dbInstance` porque también lo necesita
   `mockDb`, y `dbInstance` importa a `mockDb`. `dbInstance` lo reexporta: las 22 pantallas
   que ya lo importaban de allí no cambian.
2. **`mockDb.ts`** — el sello en las tres escrituras. En `registrarSerie` solo se sella la
   sesión **que contiene el ejercicio**: esa función recorre todas para encontrarlo, y
   sellarlas de paso pondría el lunes en las cinco sesiones de la semana.
3. **`sync.ts` + migración `0052`** — las tres escrituras del asesorado suben **solo su
   rama**, nunca el blob (lección del 2026-08-15), así que un campo nuevo no viaja solo.
   Va en su propia llamada, `fijar_fecha_sesion`, en vez de ampliar la firma de las tres
   funciones que llevan meses en producción. La clave de cola junta las de la misma sesión.
4. **`plantilla-carga-microciclo.sql`** — `fecha` es **ejecución**, así que
   `tmp_sesion_en_limpio()` la quita. Sin esto sería el fósil de julio otra vez y con la
   peor cara: una semana que nadie ha empezado, naciendo con el martes pasado escrito, y el
   cruce emparejando dos días distintos sin que nada falle a la vista.
5. **`comprobar-fosiles.sql`** — columna nueva `fechas_fosiles`: una `fecha` anterior al
   `fechaInicio` de su propio microciclo viene heredada.

## Lo que NO se hizo

- **No se enchufa `bucleDelDia`.** Sigue en `MODULOS_SIN_ENCHUFAR`. Esto solo le pone el
  reloj que le faltaba; el interruptor lo abre la corrida en sombra, y a esa le falta
  todavía dónde apuntar lo que decide.
- **No se rellena hacia atrás.** Las 607 sesiones que ya existen se quedan sin fecha. La
  única que se podría deducir es la de las 33 que tienen marca de preparación, y adivinar
  el resto sería fabricar evidencia — que es el pecado que este mismo campo viene a evitar.

## Visto romperse

`node scripts/mutar-fecha-de-sesion.mjs` — **10 mutaciones, 10 rojos**. Entre ellas la que
sobrevivió al primer intento: `sesionDelEjercicio` devolviendo «la primera» en vez de «la
que tiene ese ejercicio» era invisible porque la sesión buena estaba en la posición 0 del
fixture. El check no protegía nada hasta que se le puso delante una sesión de cardio.

Dos guardas de `perdida-datos.test.ts` contaban el total de la cola (`toBe(1)`) y una
operación más las ponía en rojo. **No se han relajado: se han afinado** para hablar de la
operación de series, que es lo que ese archivo defiende. Comprobado apagando `subirSeries`:
la guarda sigue cazando la pérdida.
