# El índice de regularidad del sueño

## Qué entra

Una lista de noches, cada una con la fecha del check-in y las dos horas
(`horaAcostarse`, `horaLevantarse`) en formato `HH:MM`. Las dos son opcionales en
el formulario, así que aquí llegan noches a medias y hay que aguantarlas.

**La convención, que no es obvia:** el check-in del día D describe **la noche que
terminó esa mañana**. La hora de levantarse cae en D y la de acostarse en la
víspera. Leído al revés, toda la serie queda corrida un día y el índice compara
noches que no son vecinas.

## Qué sale

`sin-datos` con el motivo y cuántas noches hay, **o** `medido` con el índice
0-100, las noches con dato y cuántos pares de días se compararon.

**Nunca sale un cero por falta de datos.** Un cero significa «te acuestas a una
hora distinta cada día», que es una acusación; «no lo sabemos» es otra cosa y se
dice con otra palabra.

## Cómo se calcula

Para cada minuto del día se mira si la persona estaba en el mismo estado
—dormida o despierta— que a esa misma hora el día anterior. El porcentaje de
minutos que coinciden se lleva a la escala publicada: **200 × acuerdo − 100**, de
modo que 100 es idéntico y 0 es lo que daría el azar. Se recorta en 0 porque
«peor que el azar» no significa nada para quien lo lee.

Un día natural solo entra si se conocen **sus dos mitades**: la noche que terminó
esa mañana y la que empieza esa tarde. Con un hueco en medio no se supone que
estaba despierta — suponerlo inflaría el parecido y el índice saldría mejor de lo
que es.

Hacen falta **siete noches con las dos horas**, y además seguidas: siete noches
sueltas por el calendario no dan número.

## Los límites, dichos antes de que alguien los descubra

El índice publicado (2024, ~60.000 personas, mejor predictor de mortalidad que
las horas dormidas) se midió con **acelerómetro en la muñeca**, minuto a minuto.
Esto sale de **dos horas escritas de memoria**: no ve las siestas, ni los
despertares de la noche, ni distingue estar en la cama de estar dormido. Es la
misma cuenta sobre un dato más pobre. Por eso lo que se enseña es la **tendencia**
—mejorando, estable, empeorando—, no el decimal.

## Lo que este módulo NO hace, a propósito

**No recomienda a qué hora despertarse.** Las calculadoras de ciclos de 90
minutos no tienen base: los ciclos reales van de 80 a 150 minutos y cambian
dentro de la misma noche. Hay una prueba que se pone roja si alguien mete aquí
una función de ciclos, despertares o alarmas.

## Visto romperse

Cinco mutaciones, **cinco cazadas** (una de ellas obligó a escribir una prueba
nueva): devolver un cero en vez de `sin-datos`; olvidarse de la medianoche y
contar 23:00→07:00 como dieciséis horas; suponer despierto lo que no se sabe;
cambiar la escala publicada por un porcentaje de acuerdo a secas —que convertía
la semana más caótica posible en un «50, vas regular»—; y contar una noche a
medias como noche.
