# Anexo al riesgo 1 · ¿se alcanza desde el registro nuevo del salón?

Comprobado con código en marcha el 2026-08-29 sobre `salon/entrenar-4d`. No es una lectura:
se montaron dos pestañas de verdad y se miró qué quedaba.

---

## Veredicto

**SÍ. El riesgo 1 se alcanza desde el registro nuevo del salón.**

Se pierde **la serie 1** —la que guardó la primera pestaña—. La borra la segunda pestaña, que
guarda su serie con el **mismo `orden`**, y `registrarSerie` reemplaza por `orden`. Desaparece
del disco, de la cola de subida y del servidor. Nadie ve un error.

Dos matices, los dos medidos:

1. **El mecanismo que describe `RIESGOS.md` ya no es el que rompe.** Las dos causas que cita
   —el blob que se escribe desde la copia en memoria y el colapso de la cola por `claveRpc`—
   están cerradas: con órdenes distintos las dos series sobreviven (caso 1). Lo que rompe es
   otra cosa, el `orden` colisionado, y `RIESGOS.md` no lo menciona.
2. **El salón no añade un camino de escritura nuevo, pero sí acerca el fallo.** El cálculo del
   `orden` es idéntico en las dos pantallas (`RegistroSerieSalon.tsx:68` y `SesionPage.tsx:186`,
   los dos `ejercicio.series.length + 1`). Lo que cambia es dónde vive el botón: el registro del
   salón está montado en la pantalla de aterrizaje de `/entrenar`
   (`router.tsx:45` → `RutaPage.tsx:113` → `SalonEntrenar.tsx:338-351`), siempre visible y sobre
   un ejercicio que elige el propio salón sin preguntar. Abrir `/entrenar` dos veces basta;
   antes hacía falta navegar hasta `/entrenar/sesion/:id` en las dos pestañas.

---

## La secuencia exacta que pierde la serie 1

1. El asesorado abre `/entrenar` en la pestaña A y en la pestaña B (o móvil + tablet). Las dos
   pintan el salón, las dos montan `RegistroSerieSalon` sobre el mismo ejercicio —el primero sin
   terminar, que lo elige `SalonEntrenar.tsx:96-99` sin preguntar—, y las dos muestran el mismo
   botón: **«Guardar serie 1»**.
2. En A teclea 100 kg y pulsa. `RegistroSerieSalon.tsx:68` calculó `orden = 0 + 1 = 1`. Se
   escribe la serie `#1 = 100 kg` en el disco y se encola con `p_series: [#1=100]`.
3. B no se entera. **No hay ni un `addEventListener('storage')` en todo `src/`** —grep vacío—, así
   que su copia del ejercicio sigue diciendo `series: []` y su botón sigue diciendo
   «Guardar serie 1». `RutaPage.tsx:48` llama a `useDbVersion()`, pero eso solo refresca **dentro
   de la misma pestaña**: la suscripción es al `Set` de oyentes en memoria de `mockDb.ts:23`, que
   no cruza de pestaña.
4. En B teclea 200 kg y pulsa. Su `orden` también sale **1**.
5. `mockDb.ts:355` hace `[...e.series.filter((x) => x.orden !== serie.orden), serie]`. Como el
   `orden` coincide, el filtro **tira la serie de A** y deja la de B.
6. `subirSeries` (`sync.ts:807-825`) reconstruye el envío leyendo el estado local ya pisado y
   encola `p_series: [#1=200]`. Esa operación reemplaza a la anterior por `claveRpc`
   (`cola.ts:148-169`), así que la serie de A tampoco queda en la cola ni en descartes.
7. `fijar_series_ejercicio` (`0037…sql:29-57`) hace
   `jsonb_set(e, '{series}', coalesce(p_series, '[]'::jsonb))`: **reemplaza** el array. El
   servidor se queda con una sola serie.

Al final del ejercicio el asesorado ha hecho dos series y en la base hay **una**.

---

## La prueba

Archivo temporal `tmp-dos-pestanas-riesgo1.test.tsx` en la raíz del repo, cuatro casos, corrido
con `npx vitest run`. **Ya está borrado**: no queda en el árbol.

Cómo se simularon las dos pestañas: `vi.resetModules()` entre una y otra e importar `sync.ts` y
`mockDb.ts` otra vez. Eso da a cada pestaña su propia instancia de `crearMockDb()` —y por tanto
su propia `ref.actual`, la copia en memoria— sobre el **mismo `localStorage`**, que es exactamente
la diferencia entre dos pestañas reales. `fetch` devuelve error siempre, así que lo encolado se
queda en la cola y se puede leer.

- **Caso 1** — órdenes distintos a mano: A escribe `orden 1`, B escribe `orden 2` desde su copia
  vieja. Sirve para saber si el mecanismo que cita `RIESGOS.md` sigue vivo.
- **Caso 2** — el cálculo real: cada pestaña hace `series.length + 1` sobre **su** copia.
- **Caso 3** — el salón de verdad: se montan dos `RegistroSerieSalon` con las props de dos copias
  tomadas a la vez, se teclea 100 y 200 kg en los steppers y se pulsa el botón de cada uno.
- **Caso 4** — control: la misma pestaña guarda las dos series seguidas. Si este también perdiera
  una, el fallo no sería de las dos pestañas.

### Salida real

```
CASO 1 · lo que B sigue viendo tras guardar A: []
CASO 1 · EN DISCO: #1=100kg #2=200kg
CASO 1 · EN COLA : #1=100kg #2=200kg
CASO 1 · ops de fijar_series_ejercicio en cola: 1

CASO 2 · ordenA=1 ordenB=1
CASO 2 · EN DISCO: #1=200kg
CASO 2 · EN COLA : #1=200kg

CASO 3 · boton de A: Guardar serie 1
CASO 3 · disco tras A: #1=100kg
CASO 3 · boton de B: Guardar serie 1
CASO 3 · EN DISCO al final: #1=200kg

CASO 4 · orden1=1 orden2=2
CASO 4 · EN DISCO: #1=100kg #2=200kg
CASO 4 · EN COLA : #1=100kg #2=200kg

Test Files  1 passed (1)
     Tests  4 passed (4)
```

### Qué dice cada línea

- **Caso 1 no pierde nada.** Con órdenes distintos el disco y la cola acaban con las dos series.
  Las dos causas citadas en `RIESGOS.md` están cerradas: `mockDb.ts:213-215` —`mutar` hace
  `transformar(cargar())`, es decir **relee el disco** antes de transformar, no usa `ref.actual`—,
  y el colapso de la cola por `claveRpc` no daña porque la única operación que sobrevive ya lleva
  el array fusionado (`#1=100 #2=200` en una sola op). La cita de `RIESGOS.md` a
  «`mockDb.ts:52-79` escribe el blob completo» describe `guardar()`, que sí escribe el blob
  entero, pero el blob que escribe salió de releer el disco un instante antes.
- **Caso 2 pierde la serie 1.** Las dos pestañas calculan `orden = 1` y queda `#1=200kg`. Los
  100 kg de A no están ni en el disco ni en la cola.
- **Caso 3 lo reproduce con los componentes reales.** Los dos botones dicen literalmente
  «Guardar serie 1». Tras A el disco tiene `#1=100kg`; tras B tiene `#1=200kg`. La serie de A ya
  no existe.
- **Caso 4 descarta la explicación alternativa.** En una sola pestaña los órdenes salen 1 y 2 y
  las dos series sobreviven. El fallo es de la divergencia entre pestañas, no de `registrarSerie`.

---

## Qué queda en la base

Después de la secuencia de arriba, en los tres sitios queda **una sola serie**, la de la pestaña
que guardó la última:

- **`localStorage['alpha-db-v2']`** — el ejercicio queda con `series: [{orden:1, cargaKg:200, …}]`.
  Un solo elemento.
- **`localStorage['alpha-cola-sync']`** — una única operación
  `rpc:fijar_series_ejercicio:m-test:ej-1` con `p_series: [{orden:1, cargaKg:200, …}]`. La
  operación anterior, la que llevaba los 100 kg, fue reemplazada por `claveRpc`. **No pasa por
  descartes**: `integrarEnCola` la sustituye en el array, no la aparta, así que
  `alpha-cola-descartes` queda vacía y `descartesPendientes()` devuelve 0. No hay ningún sitio
  desde el que rescatarla.
- **`microciclos.datos` en Supabase** — cuando esa única operación llegue,
  `fijar_series_ejercicio` deja el array del ejercicio en `[{orden:1, cargaKg:200, …}]`. La serie
  de 100 kg no llegó nunca al servidor.

El asesorado ve una serie donde hizo dos, y el motor de progresión de la semana siguiente calcula
sobre ese único dato.

---

## Qué lo cortaría

El arreglo que propone `RIESGOS.md` —«que la pestaña relea el estado del disco justo antes de
construir el envío»— **ya está puesto** (`mockDb.ts:214`) y no basta, porque el `orden` viene
decidido desde arriba, en la interfaz, antes de que la escritura relea nada.

Lo que sí cortaría, por orden de coste:

1. Que `registrarSerie` **no reciba el `orden`** y lo calcule dentro de `mutar`, sobre el estado
   recién releído del disco: `orden = e.series.length + 1`. Con eso el caso 2 se comporta como el
   caso 4 y las dos series sobreviven. Es un cambio en `mockDb.ts:345-363` y en las dos pantallas
   que hoy lo pasan.
2. Que una pestaña se entere de la otra: un `addEventListener('storage')` que dispare los oyentes
   de `mockDb.ts:23`. No arregla la carrera —dos pulsaciones simultáneas siguen colisionando—,
   pero cierra el caso normal, que es que pasen minutos entre serie y serie.
