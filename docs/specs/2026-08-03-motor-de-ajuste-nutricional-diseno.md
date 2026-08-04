# Motor de ajuste nutricional: la comida siguiente corrige a la anterior

**Fecha:** 2026-08-03
**Estado:** propuesta, pendiente de revisión de Bryan y Manuela
**Alcance:** grande. Se propone en cuatro fases; solo la fase 1 es construible hoy sin
decisiones nuevas.

---

## 1. Qué se pide

Que el plan deje de ser una hoja que se cumple o no se cumple, y pase a ser algo que se
**recalcula en el momento**. Textualmente:

> Cuando se registra una comida, la siguiente se puede precisar o ajustar para que se siga
> cumpliendo con los macronutrientes, micronutrientes, minerales, vitaminas y calorías.

El caso de uso que lo define: alguien no hizo la primera comida de su plan, o la hizo con
más grasa de la pautada. En la segunda, tercera y cuarta el motor le dice **qué comer y
cuánto**, con alimentos que esa persona tiene en casa, para acercarse a su objetivo desde
el punto de partida en el que quedó — sabiendo que a veces ya no se llega, y que
acercarse lo máximo posible sigue valiendo.

Y el criterio de día cumplido:

| Eje | Desviación admitida |
|---|---|
| Calorías | ±5 % |
| Macronutrientes (composición) | 5–10 % |
| Vitaminas, minerales y micros | 30 % |

---

## 2. Qué ya está construido y se reutiliza

No hay que empezar de cero en casi nada. Inventario real:

| Pieza | Dónde | Estado |
|---|---|---|
| TMB, factor de actividad, TDEE, reparto de macros | `src/domain/nutricion/energia.ts` | ✅ con tests |
| Composición corporal y disponibilidad energética | `src/domain/nutricion/composicion.ts` | ✅ con tests |
| Total del día, márgenes, nutrientes parciales | `src/domain/nutricion/dia.ts`, `resumen.ts` | ✅ con tests |
| Registro de comidas de punta a punta | `src/features/nutricion/` | ✅ en producción |
| Valores de referencia de 9 micronutrientes (DRI/NASEM) | `wiki/conocimiento/micronutrientes-adecuacion.md` | ✅ investigado |
| Filtro de qué se le puede recomendar a cada persona | `herramientas/base-alimentos/filtro_persona.py` | ⚠️ en Python, fuera de la app |
| Constantes MET y fórmula de gasto | `wiki/conocimiento/calculadora-cinta-neat.md` | ✅ documentado |
| Catálogo con **22 nutrientes** por alimento | `herramientas/base-alimentos/catalogo.json` | ⚠️ la app solo empaqueta 7 |

Lo que falta es el motor que los une, más tres decisiones que no puedo tomar yo.

---

## 3. Tres choques que hay que resolver antes de construir

### 3.1 No se puede corregir a ±5 % con un dato que vale ±25 %

El registro es **autorreportado y estimado**. La propia app lo dice en cada pantalla: ±25 %
si estima a ojo, ±15 % si ya está calibrado, ±5 % solo si pesó en báscula.

Un día de 1.900 kcal registradas a ojo está realmente entre **1.425 y 2.375**. Pedirle a un
motor que corrija ese día a ±5 % (±95 kcal) es pedirle precisión de bisturí sobre una
medición hecha con la mano. El número saldría, y sería falso.

**Propuesta:** el veredicto del día viaja **con su confianza**, igual que todo lo demás en
esta app.

| Cómo registró | Margen | Veredicto posible |
|---|---|---|
| Pesado en báscula | ±5 % | **Cumplido** / no cumplido |
| Estimado y calibrado | ±15 % | **Cumplido dentro de tu margen** |
| Estimado a ojo | ±25 % | **Registrado — todavía no evaluable** |

No es una rebaja del estándar: es la única forma de que «cumplió» signifique algo. Y tiene
un efecto de lado bueno — convierte la calibración (que ya está construida y nadie usa) en
la puerta a poder medirse de verdad.

### 3.2 Los micronutrientes por día contradicen una decisión que el Cerebro ya tomó

`wiki/conocimiento/micronutrientes-adecuacion.md`, escrita el 2026-07-27, dice con estas
palabras:

> Los micronutrientes se leen como tendencia a 7–14 días, **nunca como marcador diario**. Si
> el asesorado registra ~70 % de lo que come, los totales salen sistemáticamente
> subestimados. Un marcador diario de vitaminas sería direccionalmente falso y llevaría a
> **suplementar sin necesidad**.

Meter los micros en el criterio de día cumplido va justo contra eso. Y el riesgo no es
teórico: un marcador diario de hierro en rojo empuja a comprar suplementos que nadie
necesita.

**Propuesta:** los micros **sí entran en el motor de recomendación** (al elegir qué
alimento proponer, se prefiere el que además cubre lo que va flojo) pero **no en el sello
del día**. El día se sella con calorías y macros. Los micros se evalúan a 7–14 días y se
enseñan como tendencia. Es la diferencia entre «este alimento te conviene» y «hoy fallaste
en zinc».

### 3.3 La app no lleva los nutrientes que harían falta

El catálogo fuente tiene 22 nutrientes. El que la app empaqueta tiene **7**. Y de los nueve
micronutrientes que el Cerebro eligió como criterio, la app solo lleva **uno**:

| De los 9 del criterio | Cobertura en la fuente | ¿Va en la app? |
|---|---|---|
| Hierro | 96 % | ✅ |
| Calcio | 96 % | ❌ |
| Zinc | 86 % | ❌ |
| Magnesio | 85 % | ❌ |
| B12 | 88 % | ❌ |
| Sodio | 88 % | ❌ |
| Fibra | 91 % | ❌ |
| Vitamina D | **31 %** | ❌ — y no es utilizable ni en la fuente |
| Omega-3 (EPA/DHA) | **33 %** | ❌ — ídem |

Y al revés: la app enseña **potasio y vitamina C**, que no están entre los nueve. El panel de
micros que ve el asesorado hoy mide cosas distintas de las que el Cerebro decidió medir.

El recorte fue deliberado y su motivo está escrito en `scripts/generar-indice-alimentos.mjs`:
el catálogo se empaqueta para que la búsqueda funcione **sin red** en el gimnasio, y los
nutrientes son «el 70 % del peso». Ese chunk ya es el más pesado de la app (373 kB, 61,7 kB
comprimido) y el service worker se lo descarga a **todo el mundo**, use nutrición o no.

**Propuesta:** no engordar el paquete. El mismo archivo dice que «el resto del perfil se
calcula cuando haya red». Se sirve un **segundo archivo de nutrientes, aparte y bajo
demanda**, que solo baja quien entra a nutrición. Se mantiene el registro offline intacto y
se gana el perfil completo cuando hay conexión.

Vitamina D y omega-3 quedan **fuera del criterio** hasta tener una fuente que los cubra: con
31 % y 33 % de datos, cualquier veredicto sobre ellos hablaría más de los huecos de la tabla
que de lo que come la persona.

---

## 4. El motor, pieza por pieza

### 4.1 La cifra normocalórica

Ya se calcula, pero con una sola fórmula. `cuantificacion-calorica.md` recomienda
**promediar Mifflin-St. Jeor con Katch-McArdle** cuando se conoce el % de grasa — y se
conoce, sale de la encuesta.

```
TMB      = ½ × [ Mifflin(peso, altura, edad, sexo) + Katch-McArdle(masa magra) ]
Normocal = TMB × FA(pasos, días de entreno)          ← tabla de Alpha, ya implementada
Objetivo = Normocal ± ajuste de fase                 ← lo pone Manuela, no la fórmula
```

**El peso real manda sobre la fórmula.** El Cerebro ya define el ajuste empírico: si pauta
para perder 500 g/semana y pierde 300, el mantenimiento estaba sobreestimado en ~200 kcal y
se corrige. Eso es revisión quincenal de Manuela, no del motor.

### 4.2 El estado del día, después de cada comida

El motor mantiene, en todo momento:

```
restante_kcal      = objetivo_kcal      − registrado_kcal
restante_proteina  = objetivo_proteina  − registrado_proteina
restante_carbos    = …
restante_grasa     = …
comidas_por_venir  = las que el plan pauta y aún no tienen nada dentro
```

Un restante **negativo** en grasa es el caso de Bryan: ya se pasó. No es un error, es una
entrada válida.

### 4.3 El reparto

El restante no se divide a partes iguales. Se reparte con el peso que cada comida tenía en
el plan original: si la cena pesaba el 40 % del día, sigue pesando el 40 % de lo que queda.
Así una cena no se convierte en un desayuno.

### 4.4 La recomendación

Para cada comida que queda, el motor propone **alimentos con cantidades**. Tres filtros en
cascada, en este orden — que es la jerarquía del Método Heracles:

1. **Seguridad.** Fuera lo prohibido por alergia o condición médica. Aquí *no saber no es
   permiso*: si no consta que puede comer marisco, no se le recomienda marisco.
2. **Acceso.** Solo lo que esa persona consigue y compra. Aquí *no saber sí es permiso*, o un
   perfil recién creado no podría recibir ninguna recomendación.
3. **Preferencia.** Se evita lo que dijo que no le gusta.

Esa lógica **ya está escrita y probada** en `filtro_persona.py`. Hay que portarla a
TypeScript, que es exactamente como se construyó el motor de registro.

Sobre lo que sobreviva, se puntúa cada alimento por **cuánto acerca al restante**: el que
mejor cubre proteína cuando falta proteína, el que menos grasa añade cuando la grasa ya se
pasó, y a igualdad de todo, el que además aporta el micronutriente que va flojo esta semana.

La salida es **porciones reales**, no gramos abstractos: «una pechuga mediana (150 g)», «media
taza de arroz (90 g)». Las medidas caseras ya están en el catálogo.

### 4.5 Lo que el motor NO va a hacer

Esto es lo que más me importa de todo el documento.

**No compensa un exceso a cualquier precio.** Si alguien se pasó 800 kcal en el desayuno,
el motor **no** propone tres comidas de hambre. Corrige hasta un piso y ahí se planta:

- nunca deja el día por debajo de la **TMB**;
- nunca deja la disponibilidad energética por debajo de su umbral (30 kcal/kg MLG en
  mujeres, banda 20–25 en hombres);
- nunca propone **saltarse** una comida pautada.

Si corregir entero cruzaría el piso, corrige lo que puede y lo dice: *hoy ya no cuadra del
todo, y no pasa nada*. Un motor que persiga el número por encima del piso está enseñando a
compensar, y compensar es conducta de riesgo — es literalmente lo que los interruptores de
visibilidad de la migración 0018 existen para proteger.

**No corre para todo el mundo.** Respeta la visibilidad:

- con `estado: 'en_espera'` → **no se dan recomendaciones de ajuste** hasta que Manuela mire;
- con `verContadorKcal: false` → la recomendación se da **en alimentos y porciones, sin
  cifras**: «te vendría bien añadir una porción de proteína en la cena», no «te faltan 340 kcal».

**No regaña.** El lenguaje de todas las salidas se acuerda con Manuela antes de escribirse.

---

## 5. El sello del día

```
Calorías    dentro de ±5 %                          ← con la confianza del §3.1
Macros      cada uno dentro de su banda             ← proteína ±5 %, carbos y grasa ±10 %
```

Proteína más estrecha que los otros dos porque es el macro que sostiene el resultado del
entrenamiento y el que menos margen tolera; carbos y grasa se intercambian entre sí sin
consecuencia práctica mientras las calorías cuadren.

**Los micros no sellan el día** (§3.2). Van aparte, como tendencia a 7–14 días, con su
propio umbral del 30 %.

---

## 6. Gasto energético: categorizar en vez de adivinar

### 6.1 Las dos mitades

**NEAT.** Sale de los pasos diarios (ya está en la encuesta) más el tipo de jornada —
cuánto se mueve, si trabaja de pie, si carga peso. Esa pregunta **no existe todavía** y hay
que añadirla.

**Entrenamiento.** Con las constantes MET que el Cerebro ya tiene documentadas:

```
kcal_sesión = 0,0175 × peso_kg × MET × minutos          (MET pesas ≈ 3,5)
```

Categorías por número de sesiones, duración media e intensidad, promediando lo ya
estandarizado.

### 6.2 La sesión que no se registró

Cuando llega la noche y no hay registro de una sesión pautada, **la app pregunta**:
*¿entrenaste hoy?* Con un sí basta para aplicar un **estimado mínimo** — el suelo de lo que
cuesta esa sesión — en vez de contar cero.

Contar cero es el error peor: infla la disponibilidad energética y **calla la alerta** justo
en quien entrenó y no comió. El estimado mínimo se marca como estimado y viaja con esa
etiqueta a todas partes.

---

## 7. Lo que ve Manuela

Extiende la pantalla que ya tiene (`CifrasAsesoradosPage`). Por asesorado:

- **Gasto**, partido en NEAT (pasos, jornada) y entrenamiento, y cuánto de eso es estimado
  y no medido;
- **Días sellados** de la semana, y de qué confianza es cada sello;
- **Adherencia al registro**: si dejó de anotar, qué días y desde cuándo;
- **Tendencia de micros** a 7–14 días, no del día;
- **Cuántas veces el motor tuvo que plantarse en el piso** de seguridad. Ese contador es una
  señal clínica: alguien que choca contra el piso tres veces por semana no tiene un problema
  de aritmética.

---

## 8. Fases

**Fase 1 — el esqueleto, construible ya.** Normocalórica con las dos fórmulas promediadas.
Estado del día y restante tras cada comida. Reparto por peso de cada comida. Sello del día
con calorías y macros, con su confianza. Sin recomendación de alimentos todavía.

**Fase 2 — la despensa.** Mercado con casillas junto a las comidas, resolución a catálogo,
tabla `despensa`, cola de alimentos pedidos y `alimento_extra`. Va **antes** de la
recomendación: sin saber qué tiene la persona, recomendar es adivinar.

**Fase 3 — la recomendación.** Portar `filtro_persona.py`. Servir el archivo de nutrientes
bajo demanda. Puntuación y salida en porciones reales. Los guardarraíles del §4.5 **entran
aquí, no después**.

**Fase 4 — el gasto.** Pregunta de jornada en la encuesta. Categorías. Estimado por MET.
Notificación nocturna de la sesión no registrada.

**Fase 5 — el panel de Manuela** y la tendencia de micros.

---

## 9. Decisiones tomadas (Bryan, 2026-08-03)

1. **Micros → tendencia**, no sellan el día. ✅
2. **Los 15 nutrientes que faltan se sirven aparte y bajo demanda.** ✅
3. **Un día estimado a ojo no se sella.** ✅
4. **El mercado se convierte en despensa** y sube a donde están las comidas. Ver §11.

Queda abierto solo el **texto** de lo que dice el motor: las frases que aterrizan en alguien
que acaba de romper su plan. Las propongo yo, las firma Manuela. Son cuatro momentos: cuando
falta, cuando se pasó, cuando el motor choca contra el piso de seguridad, y cuando lleva
días sin anotar.

---

## 11. Mercado y despensa

### 11.1 Qué cambia

Hoy `Mercado` es una sección de «Mi plan» con una lista de viñetas de texto plano
(`plan.listaCompras: string[]`, escrita a mano por el coach) sin casillas, sin estado y sin
relación con el catálogo. Se ve y no se toca.

Pasa a ser **el sitio donde el asesorado le cuenta a la app lo que tiene**, y se coloca junto
a las comidas, no escondido tras un chip de «Mi plan».

### 11.2 El ciclo

```
1. Alpha propone la compra        →  del plan, para 8 a 15 días
2. El asesorado marca lo comprado →  casilla por línea
3. Añade lo que ya tenía          →  busca en el catálogo
4. Lo que no aparece              →  se pide, y el staff lo añade
5. El motor recomienda            →  solo desde lo que hay en esa despensa
```

### 11.3 La lista de compra no se parsea sola

`plan.listaCompras` no son gramos limpios. Son líneas como `Pechuga de pollo (1.5 kg)`,
`Espinaca, lechuga, brócoli, zanahoria` o `Proteína en polvo (si queda poca)`: cuatro
alimentos en una línea, cantidades entre paréntesis, condicionales.

Un parser que adivine ahí se va a equivocar, y equivocarse aquí significa recomendarle a
alguien un alimento que no compró. **La resolución la hace la persona**: al marcar una línea
como comprada, elige a qué alimento del catálogo corresponde. En `Espinaca, lechuga,
brócoli, zanahoria` marca los que de verdad compró.

Es más trabajo para el asesorado la primera vez y mucho menos error después. Y el coach
sigue escribiendo la lista como quiera, en lenguaje humano.

### 11.4 La despensa NO se descuenta comida a comida

Es la decisión de diseño importante de esta sección.

Lo intuitivo sería llevar inventario: compró 1,5 kg de pollo, comió 150 g, quedan 1,35 kg.
**No.** Un inventario que se descuenta se desincroniza en tres días —nadie anota el pollo que
se comió su pareja— y a partir de ahí el motor empieza a recomendar comida que no está, o a
negarse a recomendar comida que sí está. Un dato que va derivando es peor que no tenerlo,
porque nadie sabe cuándo dejó de ser cierto.

**La despensa guarda presencia, no saldo:** *«esto lo tengo»*. Se refresca cada ciclo de
compra (8–15 días), y en cualquier momento se puede quitar algo que se acabó. La cantidad es
**opcional y orientativa** — sirve para que Manuela vea si alguien compró proteína para tres
días o para quince, no para restar.

### 11.5 El alimento que no está en el catálogo

Cuando alguien busca algo y no aparece, hoy la búsqueda es un callejón. Pasa a ser una
petición:

- El texto entra en una **cola de alimentos pedidos** que ve el staff.
- Mientras tanto, el alimento **entra igual en su despensa**, marcado *sin datos*. Se ve, y
  Manuela lo ve, pero el motor **no lo usa para calcular**: un alimento sin tabla nutricional
  no puede entrar en una recomendación de cantidades.
- El staff busca su tabla, lo añade, y a partir de ahí sirve para todos.

**Constraint operativo que hay que resolver:** el catálogo va **empaquetado en el build**. Con
el flujo de hoy, añadir un alimento exige regenerar `alimentos.json` y **volver a desplegar**
— días de latencia para un alimento que alguien pidió esta mañana.

Propuesta: una tabla `alimento_extra` en Supabase que hidrata junto al resto y se **fusiona
con el catálogo empaquetado** al leer. El paquete offline sigue siendo la base (la búsqueda
en el gimnasio no depende de red), y lo añadido después aparece en la siguiente
sincronización, sin desplegar.

### 11.6 Procedencia: cada alimento dice de dónde salió

El catálogo ya lo lleva: `origen` (767 del TCAC del ICBF, 295 de USDA, 133 recetas propias),
`origen_id`, `confianza` (`verificado` / `estimado`) y un `creado_por` que hoy está vacío en
los 1.195.

Un alimento añadido a mano **tiene que traer los cuatro**. No es burocracia: la atribución
al ICBF es obligatoria en los datos derivados de su tabla, y sin `confianza` no hay forma de
distinguir después un dato de la tabla oficial de uno copiado de una etiqueta. `creado_por`
deja de estar vacío el día que Manuela añada el primero.

### 11.7 Qué hace falta construir

| Pieza | Nuevo o existente |
|---|---|
| Sección de mercado con casillas, junto a las comidas | rehacer la actual |
| Resolución línea → alimento del catálogo | nuevo, con confirmación humana |
| Tabla `despensa` (asesorado, alimento, cantidad opcional, fecha) | migración nueva |
| Buscador para añadir lo que ya tenía | reutiliza `busqueda.ts` y `SheetBuscarAlimento` |
| Cola de alimentos pedidos + pantalla de staff | nuevo |
| Tabla `alimento_extra` y fusión con el catálogo empaquetado | nuevo |
| Filtro del motor: recomendar solo lo de la despensa | entra en `filtro_persona` portado |

---

## 10. Riesgos

**El motor puede enseñar a compensar.** Es el riesgo de fondo y la razón del §4.5. Un
sistema que corrige cada desvío en tiempo real es, visto de cerca, muy parecido a un sistema
que vigila cada bocado. La diferencia está entera en los topes y en el lenguaje.

**Precisión aparente.** Una recomendación de «142 g de pollo» sobre un registro de ±25 %
proyecta una exactitud que no existe. Por eso la salida va en porciones y no en gramos
sueltos.

**Vitamina D y omega-3 no son evaluables** con los datos que hay. Prometerlos y luego
callarlos es peor que no prometerlos.
