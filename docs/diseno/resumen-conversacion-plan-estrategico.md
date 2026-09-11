# Resumen de conversación y plan estratégico del Salón 4D

Fecha de consolidación: 2026-09-02

Este documento reúne las decisiones de diseño y programación conversadas, los problemas
observados en las capturas móviles, los errores cometidos durante la implementación y las
correcciones identificadas. No es un certificado de terminado.

## 1. Objetivo del producto

La pestaña `/entrenar` debe ser un salón de entrenamiento 4D, no un dashboard con un
modelo aislado. El usuario debe poder:

- ver un sujeto completo dentro de una habitación reconocible;
- identificar suelo, paredes, estación/cámara y material del ejercicio;
- orbitar horizontalmente el sujeto;
- atravesar verticalmente el eje W, de la piel al hueso, cuando exista un patrón;
- registrar la serie sin que la interfaz tape el cuerpo;
- abrir la cámara y conservar una lectura clara en móvil vertical.

## 2. Decisiones de diseño confirmadas

### Composición de la pantalla

- Marco de referencia inicial: móvil vertical de 390 × 844 px.
- El centro debe quedar libre de tarjetas y textos invasivos.
- El sujeto ocupa aproximadamente el 60 % del área central y se ve completo.
- La sala se lee mediante suelo, pared de fondo, paredes laterales, perspectiva y estación.
- Los rótulos superiores se reducen a indicadores pequeños.
- Los detalles, controles y registro viven en una bandeja inferior plegable.
- La navegación inferior permanece accesible y no cubre el sujeto.

### Lenguaje visual

- Fondo negro/carbono, grises grafito y acentos rojos profundos.
- Iluminación cinematográfica con separación del sujeto respecto del fondo.
- Retícula de suelo y líneas rojas solo cuando aportan orientación o medición.
- No usar una pared curva gigante como elemento dominante.
- No usar una imagen estática como sustituto de la escena funcional.

### Referencias visuales

Se generó una plancha 2×2 de referencias con cuatro vistas:

1. frontal con sujeto, rack y suelo;
2. lateral con cámara/trípode y marcas de posición;
3. entrenamiento con controles en bandeja inferior;
4. vista del eje W con líneas discretas y cuerpo completo.

La plancha es referencia de composición, no un asset final ni una autorización para
reemplazar el WebGL por una ilustración.

## 3. Arquitectura técnica prevista

- `SalonEntrenar.tsx` orquesta los huecos de la pantalla y los gestos.
- `VisorPatron.tsx` monta el canvas, anima el sujeto y recibe `w`.
- `motor.ts` contiene el motor WebGL.
- `escena/sala.ts` contiene geometría de sala y estación 3D.
- `sala/ArquitecturaSala.tsx` dibuja la arquitectura 9:16 en SVG por encima del canvas,
  sin capturar puntero.
- `paredes/ParedesDelSalon.tsx` coloca rótulos, cámara, material y tabla de series.
- `PanelInferior` y `BarraRegistro` concentran el contenido largo y el guardado.

La regla de interacción es ortogonal: arrastre horizontal = órbita; arrastre vertical =
Eje W. Sin sujeto/patrón no debe aparecer el eje W.

## 4. Qué ocurrió en las pruebas visuales

Las capturas enviadas mostraron varias versiones problemáticas:

- el sujeto aparecía enorme, parcial o ausente;
- se veían bandas curvas grises en lugar de una habitación;
- el suelo y la estación no eran reconocibles;
- el centro podía convertirse en un rectángulo claro vacío;
- los rótulos laterales y superiores ocupaban demasiado espacio;
- en una versión se mostró una cáscara HTML que simulaba salón, pero no era la escena real;
- en otra visita la sesión era metabólica, sin ejercicio 3D, y por contrato no había sujeto
  ni eje W, lo que hizo difícil evaluar la composición.

## 5. Errores cometidos

### Errores de diseño

1. Se trataron imágenes conceptuales como si fueran una especificación suficientemente
   precisa para construir la pantalla.
2. Se intentó resolver la falta de legibilidad aumentando contraste y radio de una sala
   cilíndrica, sin verificar la proyección móvil.
3. Se permitió que demasiados rótulos y tarjetas convivieran con el área central.
4. Se entregaron enlaces de prueba antes de certificar visualmente la escena.
5. Se añadió temporalmente una cáscara HTML con formas simplificadas. Fue retirada de la
   visualización y no debe considerarse una solución de producción.

### Errores de programación/proceso

1. La validación se apoyó demasiado en jsdom; jsdom no pinta WebGL ni calcula layout real.
2. La suite tenía una prueba roja del salón (`sin sujeto en el centro no hay eje W`) y no
   se bloqueó la entrega por ese resultado.
3. El informe existente ya advertía que nunca se había validado el visor en un iPhone,
   pero aun así se intentó entregar una URL como si estuviera terminada.
4. `Motor.subir()` reconstruye y vuelve a subir arrays completos durante la animación;
   el informe midió hasta 24,1 ms en escritorio y no había medición equivalente en móvil.
5. No existía manejo de `webglcontextlost`/`webglcontextrestored`.
6. La sesión de demo podía ser metabólica, sin sujeto 3D, mientras se intentaba evaluar
   justamente el salón 3D.

## 6. Correcciones aplicadas hasta ahora

- Se dejó de montar la pared cilíndrica WebGL dentro de `VisorPatron` para evitar que se
  convierta en bandas gigantes.
- La habitación visual principal quedó delegada a `ArquitecturaSala.tsx`, que ya contiene
  la perspectiva 9:16, suelo, techo, paredes, retícula y aristas.
- El canvas conserva el sujeto y la estación/trípode, sin duplicar la pared.
- Se añadió manejo de pérdida y recuperación del contexto WebGL en `VisorPatron.tsx`.
- En modo `demo`, si la sesión calculada es metabólica o no tiene ejercicios, se selecciona
  una sesión de fuerza disponible para que el salón 3D pueda inspeccionarse. Producción no
  cambia esta regla.
- `npm run typecheck` y `npm run build` pasan después de estas correcciones.
- `VisorPatron.test.tsx` pasa sus 9 pruebas.

## 7. Estado actual conocido

No se puede declarar terminado todavía porque:

- no hay una captura validada en un navegador móvil WebGL desde esta sesión;
- no se ha comprobado que la nueva composición haga visibles simultáneamente sujeto,
  suelo, estación y habitación;
- la prueba general del salón mantiene un fallo de fixture/seed metabólico;
- el rendimiento de `Motor.subir()` en teléfono sigue sin medirse;
- falta comprobar órbita, eje W, cámara, bandeja inferior y navegación en el dispositivo;
- hay que eliminar completamente cualquier código provisional muerto antes del cierre.

## 8. Criterio verificable de terminado

El trabajo solo puede marcarse terminado cuando se cumpla todo lo siguiente en el código y
en una prueba de navegador móvil:

1. `/entrenar` muestra un sujeto completo, suelo, paredes, estación y material sin bandas
   gigantes ni rectángulos vacíos.
2. El centro no contiene tarjetas invasivas; los controles quedan en la bandeja inferior.
3. El arrastre horizontal orbita y el vertical cambia W solo con patrón.
4. El sujeto no queda oculto por paredes, rótulos, registro ni navegación.
5. La pérdida de WebGL muestra un estado recuperable y no deja la pantalla negra sin
   explicación.
6. `npm run typecheck`, `npm run build` y toda la suite relevante quedan verdes.
7. No quedan marcadores de prueba, cáscaras falsas, comentarios de relleno ni código muerto.

## 9. Próximo orden de trabajo

1. Validar la nueva demo en un navegador real con la sesión de fuerza de demo.
2. Corregir proporciones y z-index a partir de una captura de 390 × 844 px.
3. Reducir rótulos a chips mínimos y trasladar el resto a la bandeja inferior.
4. Verificar los cuatro gestos/acciones: órbita, W, cámara y registro.
5. Resolver la prueba roja del salón sin invertir su criterio.
6. Medir rendimiento en un móvil real o establecer una ruta de degradación medible.
7. Recién entonces publicar un enlace final.

## 10. Enlaces y herramientas mencionados

- Demo local: `http://192.168.1.82:5174/entrenar`.
- Preview remoto mencionado anteriormente: `https://alpha-athletics-app-git-feat-arquitectura-5254e1-coachingalpha.vercel.app/entrenar`.
- Figma: herramienta recomendada para fijar la composición exacta de la pantalla móvil.
- Blender/Spline: herramientas opcionales para explorar assets o escenas 3D, no sustitutos
  de la integración funcional.

La prioridad acordada es no volver a entregar un enlace hasta que la escena se vea y se
pueda interactuar con ella en un navegador real.
