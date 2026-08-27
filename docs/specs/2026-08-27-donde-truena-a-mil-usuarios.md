# Dónde truena a mil usuarios

**Fecha:** 2026-08-27
**Estado:** diagnóstico cerrado. El arreglo, propuesto y sin implementar.

---

## Por qué esto no salió de una prueba de carga

Había un script de k6 listo (`scripts/carga/hidratacion.k6.js`) y un workflow
para correrlo. No se corrió, y la decisión fue deliberada: **montar una rama de
Supabase y sembrarla con volumen de 1.000 usuarios habría costado dinero y horas
para confirmar algo que 43 días de datos reales ya decían.**

Las estadísticas de producción llevan midiendo desde el 2026-07-15. Eso es una
muestra de comportamiento real —cuándo entrena la gente, cada cuánto registra,
qué toca el coach— que ninguna simulación reproduce. La prueba de carga sigue
siendo útil, pero para lo que viene DESPUÉS de arreglar esto: hoy mediría un
cuello que ya sabemos dónde está.

## El cliff no es un número de usuarios: es un rol

Aquí está lo que hace este caso distinto de un diagnóstico normal. La app no se
degrada poco a poco al crecer la cartera. **Se rompe por una persona.**

Para una **asesorada**, RLS acota a lo suyo: su hidratación es pequeña y lo
seguirá siendo con un millón de usuarios en la base. Para el **coach**,
`es_coach()` es cierto y RLS no acota nada: se lleva la cartera entera en cada
refresco, cada 45 segundos, por pestaña abierta.

Medido sobre la base real:

| | hoy (24 asesorados) | con 1.000 |
|---|---|---|
| JSON de `microciclos` | 2.316 kB | **94 MB** |
| por hidratación del coach | 2.316 kB | **94 MB** |
| sostenido, una sola pestaña | — | **2,09 MB/s** |
| al día, un solo coach | — | **176,7 GB** |

Un microciclo pesa **20.983 bytes** de media: es un blob JSON con todas las
sesiones, ejercicios y series. Son solo 4,7 filas por asesorado, así que el
problema no se ve contando filas — se ve pesándolas.

## Por qué la firma no le salva

El PR #136 hizo que la hidratación se salte las tablas que no cambiaron. Para la
asesorada eso funciona: sus microciclos solo cambian cuando ella entrena.

Para el coach, no. Medido sobre 43 días:

```
microciclos:  135,4 cambios al día  con 24 asesorados
              = 5,6 por asesorado y día
```

A 1.000 usuarios son **~5.640 cambios al día: uno cada 15 segundos**. El coach
refresca cada 45. Su firma de `microciclos` no estará quieta prácticamente
nunca, así que se bajará los 94 MB en casi todos los refrescos.

**No es un fallo de la firma.** La firma hace lo correcto: dice la verdad, y la
verdad es que la tabla cambió. Lo que está mal es que un cambio en el microciclo
de UNA persona obligue a rebajarse el de las mil.

## Qué se satura primero, y no es lo que se suele mirar

No es CPU de Postgres, ni conexiones, ni falta de índices. Todo eso ya se atacó
entre el 26 y el 27 de agosto —el RLS por fila pasó de ~1.100 barridos por
hidratación a ~20, el ranking de 23 ms a 0,17—.

**Lo que se satura es el ancho de banda y el navegador del coach.** 94 MB de
JSON hay que transferirlos, parsearlos y meterlos en `localStorage` —que tiene
un límite típico de 5-10 MB por origen— cada 45 segundos, en un móvil.

La app no daría un error de servidor. Daría una pestaña que se muere.

## El arreglo, y ya hay precedente en este repo

El coach no necesita las sesiones de las mil personas para pintar su lista.
Necesita saber quién es, en qué microciclo va, en qué estado y cuánto lleva
hecho. Las sesiones las necesita **al abrir a una persona**, no antes.

Medido, comparando el blob completo contra ese resumen:

| | con 1.000 usuarios | al día |
|---|---|---|
| completo | 94 MB | 176,7 GB |
| **resumen** | **704 kB** | **1,29 GB** |

**137 veces más pequeño.**

Y no es una idea nueva aquí: es exactamente lo que hizo la migración **0013** con
la nutricionista. `checkins_nutricion` es una vista que le entrega tres columnas
en vez de la fila entera, precisamente para no darle lo que no necesita. Esto es
lo mismo, con `microciclos` y con el coach.

## Lo que hay que decidir antes de implementarlo

No es un refactor mecánico, y por eso queda propuesto y no hecho:

1. **El tipo local cambia.** Hoy `SeedDb.microciclos` es `Microciclo[]`, con sus
   sesiones dentro. Si al coach le llegan resúmenes, cualquier pantalla suya que
   lea `sesiones` se rompe. Hay que decidir entre un campo aparte
   (`resumenesMicrociclo`) o cargar el blob a demanda al abrir a alguien.
2. **Qué necesita de verdad cada pantalla del coach.** Hay que mirarlas una a
   una antes de recortar; recortar de más es una pantalla en blanco.
3. **La asesorada no se toca.** Para ella la hidratación actual está bien y el
   salto por tabla ya la cubre.

## Y entonces, ¿la prueba de carga?

Sigue en pie y merece correrse **después** de esto. Ahora mismo confirmaría lo
que ya sabemos. Cuando el coach deje de bajarse la cartera entera, la pregunta
«¿dónde truena ahora?» vuelve a no tener respuesta conocida, y ahí sí hace falta
medirla.

Con una condición que ya está escrita en `2026-08-27-prueba-de-carga.md`: la
rama nace vacía, y sobre cero filas Postgres elige planes distintos. Hay que
sembrarla con volumen o el informe dirá que todo va perfecto.
