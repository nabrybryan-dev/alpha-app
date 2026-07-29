---
description: Diagnosticar un fallo de raíz y archivarlo en el Cerebro de Programación
---

Diagnosticar un fallo de la app siguiendo el protocolo del Cerebro de Programación.
Fallo reportado: **$ARGUMENTS**

**Antes de proponer cualquier arreglo**, en este orden:

1. **Busca si ya pasó.** Lee
   `../../Cerebro Programacion Alpha/wiki/index.md` y revisa `incidentes/`. Puede
   estar archivado con su causa raíz y su prevención.
2. **Reproduce y observa** antes de tocar nada: consola, red, estado en
   localStorage, qué rol tenía la sesión. No empieces a editar con una hipótesis sin
   verificar.
3. **Formula la causa raíz, no el síntoma.** «La pantalla se queda en blanco» es un
   síntoma. Pregunta por qué hasta llegar al mecanismo.
4. **Verifica la hipótesis contra el código real** (léelo, no lo asumas) y contra la
   librería si hace falta. Para el comportamiento de una API externa, consulta
   Context7 en vez de recordarla de memoria.
5. **Propón la corrección mínima + su prueba de regresión.** El patrón del repo es
   escribir primero el test que documenta el fallo en rojo, y arreglarlo después.
6. **Comprueba el aislamiento.** Si el fallo o el arreglo tocan sesión, roles o
   sincronización, corre y razona sobre
   `SessionProvider.aislamiento.test.tsx` y `data/nube/perdida-datos.test.ts`.
7. **Archiva el caso** en
   `../../Cerebro Programacion Alpha/wiki/incidentes/` con la plantilla del cerebro
   (raíz → solución → cómo prevenirlo), sin datos personales de asesorados, y anexa
   la línea correspondiente a `wiki/log.md`. Un fallo diagnosticado y no archivado se
   vuelve a pagar entero la próxima vez.

Jerarquía ante conflictos: seguridad y privacidad → integridad de datos →
fiabilidad → fluidez → simplicidad → novedad.
