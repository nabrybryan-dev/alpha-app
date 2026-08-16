# De dónde sale la lista de compra

**Fecha:** 2026-08-16
**Estado:** diseñado, sin implementar.
**Desbloquea:** la migración `0024` (despensa), escrita el 2026-08-05 y sin aplicar
desde entonces. Y con ella `src/domain/nutricion/despensa.ts`, que lleva once días
con 8 exportaciones y 0 consumidores.

---

## 1. La pregunta que bloqueaba

El plan de agosto dejó la despensa parada en una sola cosa, y no era técnica
(`docs/plans/2026-08-03-continuacion-motor-nutricional.md` §6):

> **De dónde sale la lista de compra por asesorado** — hoy `plan.listaCompras` es
> texto libre escrito a mano por el coach.

El spec §11 daba por hecho que seguiría siendo texto humano —`Espinaca, lechuga,
brócoli, zanahoria`— y que resolverlo a alimentos del catálogo lo haría la
persona, marcando lo que compró.

**Contestada el 2026-08-16, y la respuesta cambia el diseño:** la lista **sale de
la encuesta**, ya estructurada.

## 2. De dónde sale, entonces

Tres entradas, en este orden:

1. **Lo que la persona declara en la encuesta:** qué alimentos consume más y
   **cuántas veces por semana**. Sale con `alimento_id` del catálogo, no como
   texto.
2. **Los cambios que propone la nutricionista:** alimentos más favorables para el
   objetivo, que sustituyen o acompañan a los declarados. Es el motor de
   bioequivalencias que ya está en producción (PR #42).
3. **La cantidad que la persona dice que compra**, en sus propias unidades.

Con eso y la longitud del ciclo se estima cuánto hace falta, y el asesorado ve un
esquema de lo que tiene en la nevera.

**El texto libre desaparece del camino.** Esto elimina el problema que más pesaba
en el spec §11: ya no hay una lista humana que interpretar.

## 3. Lo que esto NO es

La `0024` es tajante y sigue siéndolo:

> **GUARDA PRESENCIA, NO SALDO.** No hay columna de «restante» y no la va a haber.

La cantidad es **una foto al empezar el ciclo**, no un contador que baja con cada
comida. No se descuenta nada. Cuando arranca el ciclo siguiente, se vuelve a
preguntar.

El motivo está escrito en la migración y no ha cambiado: un inventario que se
descuenta se desincroniza en tres días —nadie anota el pollo que se comió su
pareja— y a partir de ahí el motor recomienda comida que no está, o se niega a
recomendar comida que sí está. **Un dato que va derivando es peor que no tenerlo,
porque nadie sabe cuándo dejó de ser cierto.**

Lo que la persona pidió —«un promedio para aplicar recomendaciones prácticas en la
inmediatez, y resolver las discrepancias cuando coma algo diferente»— se cumple
con la foto. No hace falta el saldo, y el saldo lo rompería.

## 4. El ciclo: 8 o 15 días, no 7

Decidido el 2026-08-16: **la compra se alinea con la programación.**

`despensa.ts` ya lo dice: *«Las programaciones van a 8 o a 15 días»*, y el cerebro
ondula cada 8. Si la compra fuera a 7, se desfasaría un día por ciclo: al sexto,
la compra iría casi una semana por delante del plan que debería abastecer.

`DIAS_CICLO_MAXIMO = 15` ya existe en `despensa.ts` y no cambia.

**Campo nuevo en la encuesta:** `cicloCompra`, de tipo `opcion`, con dos valores —
8 o 15 días.

## 5. Las cantidades: las dice la persona

### El problema, medido

| | |
|---|---|
| Alimentos en el catálogo | **1.198** |
| Con alguna medida casera en `alimento_medidas` | **357** |
| **Sin ninguna** | **841** |

«Pollo, 3 veces por semana» × 15 días = 6,4 raciones. Pero **¿cuánto es una ración
de pollo?** Para el 70% del catálogo la base no tiene respuesta.

Las salidas descartadas, y por qué:

- **Ración media por grupo** (proteínas 120 g, verduras 80 g…): cubre todo el
  catálogo, pero fabrica un número con pinta de medido. Es justo lo que la `0024`
  prohíbe en su cabecera sobre los pedidos sin tabla nutricional.
- **Estimar solo los 357**: honesto, pero deja sin cifra a la mayoría de la lista,
  que es precisamente lo que se quería ver.

### La decisión

**La persona dice cuánto compra, en sus unidades.** «Una bandeja», «media libra»,
«un paquete». Nada inventado.

### Y las unidades que no sabemos convertir

`despensa.cantidad_g` es numérica, así que «una bandeja» no entra tal cual. Pero la
`0024` **ya tiene el patrón** para lo que no se puede resolver, y se reutiliza tal
cual:

| Caso ya resuelto en la 0024 | El caso nuevo |
|---|---|
| Alimento que no está en el catálogo | Unidad que no sabemos convertir |
| Entra con `alimento_id` nulo y `texto_pedido` | Entra con `cantidad_g` nula y el texto de la unidad |
| Se ve, el staff lo ve, el motor lo deja fuera del cálculo | Igual |
| Va a la cola `alimentos_pedidos` | Va a una cola equivalente |

Y tiene una propiedad que las otras dos salidas no tienen: **cada resolución
compone**. Cuando alguien define qué es una bandeja de pollo, esa medida entra en
`alimento_medidas` y sirve para todos los demás asesorados a partir de entonces.
Los 841 sin medida no son una pared, son una cola que se vacía sola con el uso.

**Regla que se hereda de la `0024` sin discusión:** un item cuya cantidad no se
pudo convertir se **ve** en la despensa, pero **no entra en ningún cálculo**. Sin
tabla, una cantidad recomendada sería un número inventado con pinta de medido.

## 6. Lo que hay que construir

### 6.1 · Encuesta — tres campos nuevos

**`cicloCompra`** — tipo `opcion`, valores 8 o 15 días. Trivial: encaja en los
tipos que ya existen.

**`despensaEs`** — tipo `opcion`: «solo para mí» o «para toda la casa». Y es el
campo que decide si la cantidad significa algo, así que **no es opcional**.

Una factura de 2 kg de pollo no dice lo mismo si vive sola que si vive con su
pareja y dos hijos: en el segundo caso describe una nevera compartida, y el plan
describe a una persona.

La regla que sale de ahí:

| `despensaEs` | en los cálculos | en pantalla |
|---|---|---|
| solo para mí | entra | cantidad: «pollo · ~1,2 kg» |
| para toda la casa | **no entra** | **solo presencia: «hay pollo»** |

Es exactamente el mismo trato que la `0024` le da a lo que no sabe resolver.

**Decidido el 2026-08-16: cuando la despensa es de la casa, la pantalla no enseña
la cantidad.** Ni siquiera marcada como orientativa.

La alternativa —enseñarla con una etiqueta de «aproximado»— parece más informativa
y es peor: un número en pantalla se usa para decidir, diga lo que diga la etiqueta
de al lado. Nadie lee la letra pequeña de su propia nevera. Si el número no puede
sostener una decisión, no se enseña; y «hay pollo» ya sostiene la única decisión
que importa aquí, que es no recomendar lo que no está.

La cantidad se sigue **guardando** —la nutricionista la ve, y sirve para saber si
alguien compró proteína para tres días o para quince— pero no viaja a la pantalla
del asesorado.

**Lo que NO se hace: preguntar cuántos viven en casa y dividir.** Nadie come un
cuarto de la nevera. Esa división es el número medio con pinta de medido que este
spec lleva rechazando desde §5, y encima con apariencia de precisión, que es lo
que la vuelve peligrosa. Si es de la casa, la despensa vale como **presencia** —
«hay pollo» — que ya es útil para no recomendar lo que no está.

**`alimentosQueMasConsume`** — y este **no encaja en ningún tipo actual**. Hoy
`TipoCampo` es `'numero' | 'fecha' | 'opcion' | 'multiple' | 'texto'`, y esto es
una **lista repetible de tres cosas**: alimento del catálogo + veces por semana +
cantidad que compra (texto libre).

Es la única pieza de la encuesta que exige tipo nuevo. Va con su propia tanda y
sus tests, no de pasada dentro de otra cosa.

### 6.2 · Capa de datos

Lo que el plan de agosto ya identificaba como pendiente, sin cambios:

- `DespensaRepo` en `repos.ts` + `mockDb`
- sync
- **y su fallback en `hidratar.ts`**, que es donde este repo ya borró datos tres
  veces

### 6.3 · Pantalla

La sección de mercado con casillas, junto a las comidas.

### 6.4 · Migración

La **`0024` se aplica tal como está**. Nada de lo decidido aquí la contradice:
`cantidad_g` sigue siendo orientativa y nullable, `texto_pedido` sigue siendo la
cola del staff, y el `check` de alimento-o-pedido sigue valiendo.

Ojo al número: la carpeta va por `0040`. Si hace falta una migración nueva para la
cola de unidades, será la siguiente libre — **mirar la carpeta, no fiarse de este
documento**, que envejece.

## 7. Orden sugerido

1. `cicloCompra` en la encuesta — es el campo barato y no depende de nada.
2. Aplicar la `0024`.
3. `DespensaRepo` + `mockDb` + sync + fallback en `hidratar.ts`, con los tests de
   pérdida de datos delante.
4. `alimentosQueMasConsume`, con su tipo nuevo y su tanda propia.
5. La pantalla de mercado.
6. Enganchar la despensa al motor de cambios (#42), que es donde esto paga: las
   sugerencias dejan de proponer lo que no hay en casa.

El punto 6 es el que la persona pidió —«resolver las discrepancias cuando coma algo
diferente»— y no se puede hacer antes, porque necesita los cinco anteriores.

## 7bis. Fase 2 · La foto de la factura

Propuesta del 2026-08-16, **posterior a lo de arriba y sin bloquearlo**.

La idea: un botón para fotografiar la factura del mercado. La factura trae producto
y cantidad, así que la despensa se llenaría con evidencia en vez de con memoria.

### Por qué merece la pena

- **El dato declarado es el eslabón débil.** «¿Cuántas veces por semana comes
  pollo?» se contesta de memoria, y la memoria en nutrición miente hacia donde le
  conviene a quien responde. La factura dice lo que se compró, cuánto y cuándo.
- **La fricción se desploma**, y eso decide si la funcionalidad se usa o se
  abandona a la tercera semana.
- **La mitad ya está construida**: migración `0022` con el bucket privado
  `adjuntos-chat`, `src/data/nube/adjuntos.ts` con sus tests y
  `src/lib/comprimirImagen.ts`. Subir una foto privada y comprimida no hay que
  inventarlo.

### Por qué no como vía única, y no con OCR

1. **Vuelve el problema que la encuesta acababa de eliminar.** Una línea de factura
   dice `PECHUGA POLLO BDJ X KG`. Convertir eso a un `alimento_id` es interpretar
   texto humano, pero peor que en el spec §11: abreviado, sin estándar, distinto en
   cada supermercado.
2. **Lo fresco muchas veces no da factura** — plaza, carnicería, tienda de barrio —
   y es la mitad del carro que más pesa nutricionalmente.
3. **Una factura enseña más de lo que queremos guardar**: alcohol, medicamentos,
   anticonceptivos, cuánto gasta. Y si el OCR es un servicio externo, esa imagen
   sale de nuestra infraestructura. Para una app con datos de salud eso es un
   cambio de categoría, no un detalle.

### Cómo se hace, entonces

> **La foto entra como evidencia, no como dato.** Se sube, se ve, y una persona
> confirma la lista: la asesorada al llegar del mercado, o la nutricionista.

Que es, otra vez, el patrón que la `0024` ya tiene. Lo que gana esta versión:

- Se construye con lo que ya existe.
- Cero riesgo de inventar cantidades: nadie confirma lo que no reconoce.
- Funciona igual con factura de supermercado, con papel de la plaza o sin nada.
- **Acumula el corpus.** Cada confirmación es un par `línea de factura → alimento_id
  + gramos`. A los tres meses hay cientos de pares reales de los supermercados que
  usa esta gente — que es lo que haría viable un OCR automático **después**, con
  datos propios en vez de un modelo genérico.

El OCR es la parte cara, la que depende de terceros, y la única que se puede
posponer sin bloquear nada.

### Lo que la factura no sustituye

La encuesta dice **qué come habitualmente**, que es lo que la nutricionista
necesita para proponer cambios. La factura dice **qué hay en casa este ciclo**. Son
dos preguntas distintas y la segunda no contesta la primera.

## 8. Lo que queda abierto

- **Quién marca lo que se compró de verdad.** El spec §11 decía que la persona
  marca casillas al volver del mercado. Con la lista saliendo de la encuesta, ¿se
  mantiene ese paso o la despensa se llena sola al empezar el ciclo? Cambia la
  pantalla, no el modelo de datos. La fase 2 lo responde de una forma: la
  confirmación de la factura ES ese paso.
- **Si la persona cambia de `despensaEs` a mitad de ciclo** —se muda, deja de
  vivir sola— ¿qué pasa con las cantidades ya guardadas? Lo barato es que la regla
  se aplique al leer y no al escribir: se guarda siempre, y lo que decide si se
  calcula y si se enseña es el valor de HOY. Así un cambio de respuesta no obliga a
  reescribir nada. Queda apuntado porque es una decisión de implementación con
  consecuencias, no un detalle.
- **Qué pasa con el catálogo empaquetado.** El spec §11 ya lo apuntaba: los
  alimentos van dentro del build, así que añadir uno exige redesplegar. Su
  propuesta —una tabla `alimento_extra` que se fusiona al leer— sigue pendiente y
  ahora pesa más, porque la cola de unidades sin resolver va a crecer con el uso.
