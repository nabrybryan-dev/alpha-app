El salón de `/entrenar` pasa a seguir el kit «Sala de entrenamiento» del handoff. Lo que el
kit aporta es **cómo se distribuye la información**; la sala, su mobiliario, sus espacios y
el sujeto no se han tocado.

La idea que gobierna los siete commits, en las palabras del encargo: **desaparecer la mayor
cantidad de letras y cuadros que tapen el salón**, y que lo que quede se toque en vez de
leerse en controles puestos encima.

## Lo que se ve

**De cinco cuadros de pared a UNO.** En el muro quedan el código de sala, el nombre del
ejercicio en trazo con sus dos ecos de canto, y un único hueco que se turnan el cronómetro
y la carga. Se fueron la tabla de series, «a continuación», el mando de registrar, la
marquesina del ritmo y el reflector de la cámara — ninguno perdió su dato.

**La prescripción rodea al sujeto.** Series, repeticiones, descanso y RIR son cuatro postes
con su base y un cartel que siempre mira a cámara. Y la clave de que el salón siga
despejado: **la cifra entra, se lee tres segundos y se retira**; lo que permanece es el
poste. Tocar una la deja fija.

**La ficha sale del borde izquierdo.** Se tira y aparece, siguiendo al dedo. Dentro se
llena carga, reps y RIR, y ahí mismo se guarda. Al guardar: se cierra, sale la frase sobre
la sala, y **el descanso arranca solo** —salvo en la última serie, porque el descanso es el
que va entre series del mismo ejercicio—.

**Todo se toca.** El mando del reloj va desnudo, sin aro ni etiquetas: se tira a un lado y
lo que cambia se lee **en la pared**, nunca sobre el mando. La semana es un tambor con
inercia. Las capas del cuerpo se atraviesan **hundiendo el dedo** en el sujeto. Y con el
dedo dentro, tirar a un lado pasa de ejercicio.

**La sala respira** ±2,5° cuando nadie la toca, y **se retira** un 12 % mientras sube la
lectura larga de abajo — que ahora explica cada prescripción en tres niveles: qué es, por
qué importa, y la señal que se mira.

## Lo que se decidió y conviene saber

- **Las cuatro estaciones en corro del kit no caben aquí.** Con una ventana horizontal de
  12,18°, un cartel a 45° del eje cae en x=523 de una pantalla de 390, en cualquier radio
  entre 1,0 y 3,2 m. Viven en el espacio del sujeto y lo que las ata a la sala es el azimut.
- **No se ha traído el `scroll-snap`** de la maqueta: un contenedor con scroll vertical se
  comería el arrastre vertical sobre el sujeto, que aquí es el eje W y en la maqueta no
  existe. Sí se ha traído el efecto que importa, la sala retirándose.
- **Se pierden dos cosas, y van dichas:** pausar y añadir 15 s al descanso (ahora es un
  modo del reloj de la pared, no una barra con mandos), y cambiar de capa con teclado — un
  gesto de presión no tiene equivalente. Si hace falta, el sitio no es devolver la escalera
  de botones: es que las capas se recorran desde la ficha.

## Lo que destapó mirar la pantalla, no los tests

Cada tanda salió verde antes de estar bien. Lo que solo dijo la foto o la medida:

- «Sin kilos» arriba y «La semana pasada · 20 KG» debajo: dos datos ciertos que juntos
  decían uno falso.
- «SERIE 1 DE 3» escrito dos veces —muro y mando— y luego otra vez dentro del propio cajón.
- Reps y RIR en dos columnas: dentro de los 232 px del cajón **la cifra medía cero píxeles**
  y seguía en el DOM.
- Los puntos de ejercicio existían, medían 350×4 y se pintaban debajo del tirador del panel.
- El vaivén de la cámara era **código muerto** —vivía en una rama que nunca se ejecutaba— y,
  al arreglarlo, seguía quieto porque el bucle trabaja en segundos y el vaivén en
  milisegundos.

Y un agujero del entorno de prueba que costó una vuelta: **en jsdom un `PointerEvent` no
transporta `clientX` ni `clientY`**. Llegan vacías, el desplazamiento sale `NaN` y el
manejador se ejecuta entero sin mover nada.

## Estado

`npm run verify` en verde: **3.179 pruebas**, 0 errores, 6 avisos (delta cero). Cuatro
guardianes del repo cazaron la limpieza y los cuatro están atendidos: código huérfano,
clases de animación sin consumir, el inventario de recuadros y la auditoría de campos —los
que salieron del muro siguen montados con `sr-only`, así que se oyen y se cuentan.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_018AcBuSR9b9ePtiakvTTkHa
