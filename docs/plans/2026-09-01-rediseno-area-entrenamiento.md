# Plan semanal — rediseño del área de Entrenamiento

**Semana:** 1–6 de septiembre de 2026  
**Base confirmada:** `6b4f300` (anatomía, cinemática y física)  
**Preview de referencia:** https://alpha-athletics-app-git-feat-arquitectura-5254e1-coachingalpha.vercel.app

## Resultado de la semana

Integrar en la app principal el **salón de entrenamiento a pantalla completa** que ya existe en el worktree `C:\Users\ASUS\dev\alpha-salon`, y extenderlo con personalización antropométrica. El ejercicio y su sujeto anatómico ocupan el centro; la información breve vive en el escenario; el registro de la serie queda siempre al alcance; el contenido extenso aparece en un panel inferior deslizable. Las reglas nuevas de personalización deben quedar documentadas, probadas y separadas de las prescripciones aprobadas.

## Qué ya está resuelto y no se vuelve a construir

- 31 patrones de movimiento orbitables y cobertura del 99,74 % de los ejercicios reales.
- Anatomía por capas, arquitectura muscular, huesos, inserciones y rangos articulares.
- Cadena cinética, apoyos fijos, plomada, equilibrio y tempo por ejercicio.
- Registro existente de carga, repeticiones y RIR, con borrador local y sincronización.
- Cámara/encoder y visor del patrón ya conectados a `TarjetaEjercicio`.
- La generación anterior del salón está en `C:\Users\ASUS\dev\alpha-salon`, rama `salon/entrenar-4d`. Se reutilizan `SalonEntrenar`, las paredes, el registro de serie, la cámara, los implementos, el trazado espacial, el estado sin sujeto, sus pruebas y el informe de riesgos.

### Regla de integración de la generación anterior

- `alpha-salon` es una **fuente de componentes ya construidos**, no la rama final del trabajo nuevo.
- Antes de copiar una pieza se compara contra `main` para conservar las correcciones posteriores al 29 de agosto.
- No se copia el worktree completo ni se fusiona a ciegas: cada componente entra con sus pruebas y se adapta a los contratos actuales.
- El material anterior no cuenta como terminado para antropometría, personalización, dominada cerrada, peso muerto convencional, análisis posterior del encoder ni calidad gráfica nueva.

## Alcance que sí se construye

1. **Integración de la escena anterior:** trasladar selectivamente el salón 9:16, paredes, registro, cámara, implementos, trazado y estado sin sujeto desde `alpha-salon`.
2. **Encuesta antropométrica:** ocho medidas exactas, validación, persistencia aislada y perfil reutilizable.
3. **Motor personalizado:** proporciones, centro de masas, vectores y brazos de momento derivados de reglas científicas aprobadas.
4. **Cinco ejercicios:** sentadilla, press de banca plano y press militar parten de patrones existentes; se crean dominada cerrada y peso muerto convencional.
5. **Cuarta dimensión:** tiempo del movimiento y navegación por músculos/regiones, tejidos pasivos y huesos.
6. **Análisis del encoder:** lectura gráfica posterior a la grabación y comparación semanal compatible.
7. **Calidad y rendimiento:** capturas de referencia, comparación automatizada, mínimo 30 FPS y apertura máxima de 5 segundos en iPhone 15 Pro Max físico.

## Presupuesto de tokens

No existe acceso desde el repo al contador exacto de tokens de la suscripción. Para no depender de una cifra inventada, el presupuesto se administra como **100 unidades semanales** y se detiene cada fase con evidencia verificable.

| Fase | Unidades | Entregable |
|---|---:|---|
| Contrato visual y pruebas de regresión | 12 | Spec, mapa de información y tests que preservan registro/datos |
| Integrar generación anterior del salón | 14 | Escena, paredes, registro, cámara y estados recuperados con sus pruebas |
| Encuesta y persistencia antropométrica | 16 | Ocho medidas aisladas por usuario |
| Reglas y motor biomecánico individual | 22 | Centro de masas, vectores y brazos de momento trazables |
| Dominada cerrada y peso muerto convencional | 14 | Dos patrones nuevos diferenciados |
| Cuarta dimensión y análisis del encoder | 18 | Capas, tiempo y lectura posterior a la grabación |
| Rendimiento, calidad gráfica y QA | 16 | 30 FPS, apertura ≤5 s, capturas y verificación completa |

**Regla de protección:** al consumir 70 unidades, se congela cualquier mejora cosmética nueva. Las 30 restantes quedan reservadas para integración, pruebas, rendimiento y correcciones. Si la capacidad real de la suscripción se agota antes, el corte funcional es al terminar la consola de serie; el panel inferior puede quedar detrás de una bandera sin comprometer el entrenamiento actual.

## Ejecución por día

### Martes 1 — contrato y línea base

- Crear spec del salón y mapa `dato actual → nueva ubicación`.
- Medir la línea base: carga inicial, interacción, errores y tests existentes.
- Escribir primero las regresiones que impiden perder ejercicios, series, cámara o prescripción.
- Salida: estructura aprobable sin cambios de negocio.

### Miércoles 2 — escena completa

- Extraer el flujo visual de `SesionPage` a un cascarón de salón.
- Mantener montados cronómetro, preparación y estados de cierre sin mostrarlos como tarjetas superiores.
- Añadir navegación anterior/siguiente dentro de la escena y fallback si el visor no carga.
- Salida: recorrido completo con datos demo, aunque las paredes aún sean básicas.

### Jueves 3 — paredes y cuarta dimensión

- Alimentar paredes con el ejercicio real, sin cifras de maqueta.
- Distribuir texto: corto en paredes, largo en panel inferior.
- Exponer las cinco capas W sin mezclar el gesto vertical de profundidad con el gesto de abrir el panel.
- Salida: sujeto, prescripción y técnica se entienden sin abandonar el salón.

### Viernes 4 — registro dentro del salón

- Reubicar la UI de `RegistroSerie`; reutilizar su ref, borrador, cámara y guardado actuales.
- Verificar descanso, avance automático, ejercicio completado y cierre de sesión.
- Probar pérdida de conexión y retorno desde segundo plano.
- Salida: una sesión de fuerza se puede ejecutar de principio a fin.

### Sábado 5 — panel inferior y casos sin sujeto

- Mover preparación, notas, prescripción extensa, historial, ritmo y próximos al panel.
- Resolver el conflicto de gestos: órbita horizontal, profundidad anatómica vertical sobre el sujeto y apertura mediante asa inferior.
- Cubrir cardio/movilidad/cribados con el salón vacío y su información real.
- Salida: ninguna información actual queda inaccesible.

### Domingo 6 — cierre y preview

- Probar el recorrido en ancho equivalente a iPhone 15 Pro Max y Android pequeño.
- Ejecutar `npm run verify`; el total de tests no puede bajar y no puede aparecer un aviso nuevo.
- Revisar órbita 360°, áreas táctiles de 44 px, movimiento reducido, fallback WebGL y contraste.
- Publicar rama de preview; producción solo después de la aprobación explícita de Bryan.

## Orden técnico de cambio

1. Comparar `alpha-salon` contra la base actual y extraer únicamente las piezas aprobadas.
2. Integrar el cascarón en `src/features/entrenar/salon/` y conectarlo desde `SesionPage.tsx`.
3. Construir el perfil antropométrico y su persistencia antes de conectar variaciones visuales.
4. Añadir dominada cerrada y peso muerto convencional al catálogo.
5. Conectar el motor biomecánico al visor mediante salidas numéricas trazables.
6. Incorporar el análisis posterior del encoder sin modificar sus mediciones originales.
7. Ejecutar pruebas independientes, medición física y auditoría de riesgos antes de publicar preview.

## Definición de terminado

- Entrenar abre directamente en un salón a pantalla completa y no en una columna de tarjetas.
- Se puede orbitar 360° sin que una capa de interfaz tape al sujeto.
- Las cinco capas anatómicas siguen disponibles durante el gesto.
- Las paredes reflejan el ejercicio y la serie reales, no contenido fijo.
- Carga, reps y RIR se registran con el mismo resultado de datos que antes.
- Todo el contenido desplazado sigue accesible desde el panel inferior.
- Fuerza, cardio y sesiones mixtas mantienen todos sus ejercicios y bloques.
- `npm run verify` queda verde y la preview se valida antes de cualquier fusión a `main`.

## Fuera de alcance esta semana

- Rehacer el sujeto anatómico, los 31 patrones o la biomecánica ya fusionada.
- Cambiar prescripciones, progresiones, microciclos o reglas del coach.
- Crear patrones ficticios para cardio o cribados.
- Añadir implementos 3D si compromete la sesión ejecutable de principio a fin.
- Publicar en producción sin aprobación.

## Riesgos que se prueban antes de cerrar

- WebGL compite con la cámara y congela el navegador.
- El gesto vertical del sujeto abre accidentalmente el panel inferior.
- Un `transform` o `perspective` ancestro encierra la hoja fija de cámara.
- La navegación remonta el ejercicio y pierde el borrador de la serie.
- El salón funciona para fuerza pero oculta bloques cardio o sesiones sin ejercicios.
- La calidad visual reduce demasiado los FPS en un móvil real.
