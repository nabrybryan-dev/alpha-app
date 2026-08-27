# Informe de carga: mil usuarios, y dónde truena de verdad

**Fecha:** 2026-08-27
**Estado:** medido sobre datos sembrados. La rama de pruebas ya está borrada.

---

## El titular

**La app no revienta a los 1.000 usuarios. Revienta a los 194.**

Y no revienta la base de datos: revienta **el `localStorage` del navegador del
coach**, con una excepción sin capturar. No es que vaya lenta — es que deja de
funcionar.

## Cómo se midió

Se creó una rama de Supabase y se sembró con volumen de **1.000 asesorados**.

Un aviso primero, porque costó descubrirlo: **la rama nació vacía, con cero
tablas.** Supabase reconstruye una rama aplicando el historial de migraciones, y
en este proyecto ese historial solo tiene 2 entradas —las 0001 a la 0049 se han
aplicado siempre a mano en el SQL Editor—. Es el precio de ese flujo, y conviene
saberlo: **hoy no se puede ramificar este proyecto.**

Así que en vez de aplicar 49 migraciones se montó un **banco de pruebas mínimo**:
solo `usuarios_app`, `microciclos`, `es_coach()` y las políticas RLS tal como
quedaron tras la 0045. Es exactamente el camino que se quería pesar, sin
arrastrar lo demás.

Los blobs son sintéticos y se calibraron contra la realidad: **20.709 bytes de
media, frente a los 20.983 reales de producción**. Ni un dato de nadie.

Sembrado final, con la misma proporción que producción:

```
4.000 cerrados     79 MB
1.000 activos      20 MB
  300 propuestos    6 MB
                  ─────
                  105 MB
```

## Lo que ganó el #142, medido

| | tiempo | carga | GB/día |
|---|---|---|---|
| **antes** (la cartera entera) | 1.393 ms | **105 MB** | 196,3 |
| **después** (`activo` + `propuesto`) | 343 ms | **26 MB** | 48,1 |

**4 veces menos**, y no proyectado: medido con cinco pasadas y calentamiento
descartado.

De paso valida la aritmética del [diagnóstico](2026-08-27-donde-truena-a-mil-usuarios.md):
allí se estimaron 94 MB y lo medido son 105.

## Y aun así, el cliff

26 MB por refresco siguen siendo demasiados, y el límite que los frena no está en
Postgres. Está en `mockDb.ts:53`:

```ts
localStorage.setItem(CLAVE, JSON.stringify(estado))
```

La instantánea entera se escribe en `localStorage` en cada escritura y en cada
hidratación. **No hay ni una protección de cuota en todo el código.**

Con **26.920 bytes por asesorado** —solo de microciclos, sin contar las otras 20
tablas—:

| navegador | cuota | revienta a los |
|---|---|---|
| **Chrome / Edge** | 5 MB | **194 asesorados** |
| Firefox | 10 MB | 389 |

Hoy, con 24 asesorados, el coach ocupa **631 kB: el 12,3 % de la cuota de
Chrome**. Hay margen, pero es 8× y no 40×.

### Y falla mal, que es lo peor

`localStorage.setItem` lanza `QuotaExceededError` cuando no cabe. Ahí nadie lo
captura, así que sube por dos caminos y los dos hacen daño:

1. Desde `aplicarSnapshot`: la hidratación revienta y el coach se queda con datos
   viejos.
2. Desde `mutar`: **la escritura se pierde**. El coach registra algo y no se
   guarda.

No es una degradación progresiva que se vea venir en una gráfica. Es un muro:
funciona, funciona, funciona, y de golpe deja de guardar.

## Qué se satura, en orden

1. **El almacenamiento del navegador del coach** — 194 asesorados. El muro.
2. **El parseo en el móvil** — 26 MB de JSON que hay que `JSON.parse` cada 45 s.
3. **La red** — 0,57 MB/s sostenidos, 48 GB al día por pestaña abierta.
4. **Postgres** — 343 ms por consulta. Es lo que MENOS preocupa, y es donde
   habría mirado cualquiera.

Merece la pena subrayarlo: todo el trabajo de las migraciones 0044–0049 atacó el
lado servidor —RLS por fila, índices, la vista materializada del ranking— y
estaba bien atacarlo, pero **el techo real no estaba ahí**.

## Los arreglos, por impacto

| # | qué | cuánto da |
|---|---|---|
| 1 | **El coach no guarda microciclos ajenos en `localStorage`** — los tiene en memoria mientras mira, no en disco | quita el muro entero |
| 2 | **Capturar `QuotaExceededError`** y degradar con criterio en vez de reventar | convierte un muro en un aviso |
| 3 | **Resumen en vez de blob** para la lista del coach (137× más pequeño, ya medido) | multiplica por 100 el techo |
| 4 | Mover la instantánea a IndexedDB, sin la cuota de 5 MB | quita el límite, pero es un cambio grande |

El 2 es el más barato y el que más urge: hoy, si la cuota se llenara, **se
perderían escrituras sin que nadie se entere**. Convertir eso en un aviso legible
es media tarde de trabajo.

## Lo que NO se hizo, y por qué

**No se corrió k6.** El script está en `scripts/carga/hidratacion.k6.js` y su
workflow en `.github/workflows/carga.yml`, listos. Pero k6 mide **concurrencia**:
mil usuarios pegándole a la vez al servidor. Y el cuello que se buscaba no es de
concurrencia — es de **volumen por usuario**, y encima en el cliente, donde k6 no
mira.

Mil asesorados descargando lo suyo son mil descargas pequeñas e independientes.
El que se ahoga es **un** coach con una pestaña abierta. Eso se pesa, no se
martillea.

k6 sigue teniendo sentido para lo que viene después: cuando el coach deje de
bajarse la cartera, la pregunta pasa a ser cuánta concurrencia aguanta
PostgREST, y ahí sí es la herramienta.

## Coste

La rama estuvo viva ~30 minutos a $0,01344/hora: **menos de un céntimo**. Ya está
borrada; queda solo `main`.
