# Las dos escaleras preautorizadas

**2026-09-04** · Ejecuta el §8 punto 1 del supuesto del 2026-08-25. Es lo único que le
falta al bucle del día para poder proponer algo: hoy **0 de 3.106 ejercicios** en
producción traen `escenarios`, así que todo cruce que pida actuar se queda sin camino.

## La idea: derivar, no inventar

El bucle no decide cuánto subir — elige entre **dos caminos que el coach autorizó por
adelantado**. Eso deja abierta la pregunta de dónde salen esos caminos, y la respuesta
fácil sería un porcentaje a ojo. Aquí no lleva ni uno:

| | de dónde sale |
|---|---|
| **techo del verde** | la carga del **extremo duro del rango que el coach ya escribió**. Si dice «8-10 @ RIR 2», hacer 8 al mismo RIR es más carga y **sigue dentro de lo prescrito**. Pasar de ahí sería salirse de la prescripción, que es para lo que existe un techo |
| **escalón del verde** | **un peldaño** de ese mismo rango: la carga de una repetición menos, redondeada al disco real |
| **suelo del rojo** | **no se deriva: se hereda** del dictamen (`seguridad_ficha.suelo_rir`). Sin suelo escrito no hay rojo — aflojar sin saber hasta dónde es el cheque en blanco que el techo evita en el otro lado (I-13) |
| **escalones del rojo** y **quitar la última serie** | **política, no aritmética.** El módulo se niega a elegir: entran por parámetro |

Todo sale de la tabla de coeficientes %1RM que ya escribe las prescripciones de esta
casa. Nada de la regla del 10 %, que además tiene un ECA en contra (informe de reingreso
del 4-sep).

## Ejemplos, con los números que salen

| prescripción | verde | rojo |
|---|---|---|
| sentadilla 100 kg · 8-10 @ RIR 2 · diana 10 | **+5 kg**, techo **112,5 kg** | RIR +1, suelo 3 |
| prensa 132,5 kg · 8-10 @ RIR 1 · diana 10 | **+7,5 kg**, techo **147,5 kg** | RIR +1, suelo 3 |
| remo 20 kg · 10-12 @ RIR 2 · diana 12 | **+2,5 kg**, techo **22,5 kg** | RIR +1, suelo 3 |
| curl 5 kg · 12-15 @ RIR 2 · diana 15 | **sin escalera** — un peldaño no llega al disco más chico | |
| cualquiera con diana ya en el mínimo | **sin escalera** — no queda margen autorizado | |
| objetivo al FALLO | **sin escalera** — el techo se calcula con el RIR pautado | |

## Una propiedad que no hubo que poner a mano

**Cuanto más cerca del fallo está la prescripción, menos margen deja el techo.** La razón
entre el coeficiente de 8 reps y el de 10 baja según se acerca el fallo: 1,1207 a RIR 3 ·
1,1138 a RIR 2 · 1,1085 a RIR 1 · 1,1029 a RIR 0.

Es la dirección correcta para una puerta de seguridad, y **sale sola de la tabla**. Yo
había supuesto lo contrario y el test me corrigió; queda escrito en su encabezado.

## Lo medido en la cartera activa (555 ejercicios)

| condición | ejercicios |
|---|---|
| con carga en kg | 333 |
| con rango de dos números | 488 |
| con RIR numérico | 530 |
| **con la diana por encima del mínimo del rango** | **248** |
| **cumplen las cuatro → tendrían escalera verde** | **219** |

**El cuello de botella es la diana**, y el reparto explica por qué:

| dónde cae la diana | ejercicios | |
|---|---|---|
| **= mínimo del rango** (extremo duro) | **233** | **48,1 %** |
| en medio del rango | 158 | 32,6 % |
| = máximo del rango | 83 | 17,1 % |
| **fuera del rango** | **10** | 2,1 % — defecto de dato, mirar aparte |

O sea que **casi la mitad de la cartera pide ya el extremo duro**: por esta regla no le
queda nada autorizado por encima, y eso no lo arregla el bucle — lo reescribe el coach.

## Las tres decisiones, contestadas por Bryan el 2026-09-04

Viven en `POLITICA_DEL_COACH` (`src/domain/escaleras.ts`), como constante y **no** como
valor por defecto: el módulo sigue negándose a elegir, y así una decisión del coach no se
disfraza nunca de aritmética.

1. **Un escalón de RIR**, no dos. El ajuste más pequeño que se nota, y nunca por debajo
   del suelo escrito en la ficha.
2. **Sí se recorta la última serie.** Se le dijo el precio y lo aceptó: con dos palancas
   moviéndose a la vez, la comparación no puede separar cuál de las dos ayudó.
   **Deuda anotada:** cuando la segunda mitad del §7.1 se pueda medir, esa comparación se
   corre **dos veces**, con recorte y sin él. En sombra no cuesta nada.
3. **El techo sale del rango, y punto.** Sin margen no hay escalera: 219 de 555 tendrían
   verde y el resto ejecuta lo pautado. No se toca ni una prescripción para esto. La
   alternativa que se descartó —el techo del microciclo siguiente— sigue siendo válida si
   algún día se quiere cobertura completa.

## Lo que sigue abierto, y no es de política

- **Los 10 ejercicios con la diana fuera de su propio rango** (2,1 %). Defecto de dato.
- **Que el ③ escriba las escaleras al prescribir.** Es el conducto que falta para que esto
  llegue a producción; hasta entonces el módulo queda sin enchufar a propósito.

## Lo que NO se hizo

**No se enchufa nada todavía.** El módulo sigue en `MODULOS_SIN_ENCHUFAR`: las tres
preguntas ya tienen respuesta, pero falta el conducto —que el ③ escriba las escaleras al
prescribir— y ese vive en `cerebro-alpha`, no aquí.

## Visto romperse

`node scripts/mutar-escaleras.mjs` → **7 mutaciones, 7 rojos**, incluida la que más
importa: si el techo dejara de salir del rango y pasara a ser un «+10 % a ojo»,
«autorizado por adelantado» dejaría de significar nada.
