---
name: tests-primero-sin-cobertura
description: Procedimiento para refactorizar o corregir un archivo que no tiene tests. Escribir primero tests que pasen contra el código VIEJO, y solo después tocarlo. Usar antes de modificar cualquier archivo de src/ sin su .test al lado.
---

# Tests primero cuando no hay cobertura

Antes de tocar un archivo de `src/` que no tenga su `.test` al lado: **escribe los
tests primero, y compruébalos contra el código viejo.**

No es ceremonia. Es lo único que convierte «creo que es equivalente» en «es
equivalente», y en este proyecto lo que se rompe no se ve: se convierte en una carga
mal registrada, una duración inventada o un dato de otro asesorado.

## El procedimiento

1. **Escribe los tests describiendo lo que el código hace HOY**, no lo que debería
   hacer. Incluye los casos borde que encuentres leyéndolo.
2. **Córrelos contra el código sin tocar.** Tienen que pasar. Si alguno falla, o
   entendiste mal el código o encontraste un bug: párate y decide cuál de los dos es.
3. **Si vas a corregir un fallo**, añade además el test que lo reproduce. Ese nace
   ROJO, y verlo fallar con el valor exacto del fallo es la prueba de que reproduce lo
   que crees.
4. **Ahora sí, cambia el código.**
5. **Los mismos tests, otra vez.** Los que nacieron verdes siguen verdes; los rojos se
   ponen verdes. **Si tienes que cambiar un test que nació verde, cambiaste
   comportamiento** — y eso ya no es un refactor.

## Por qué, con dos casos reales

**`Stepper`** (el input de carga, reps y RIR). Cero tests, y es donde se registra lo
que luego lee el coach. Se escribieron 8, pasaron contra el código viejo, y solo
entonces se quitó el efecto. Los mismos 8 pasaron después.

De paso, escribirlos obligó a leerlo entero, y ahí apareció el arreglo: el `value` del
input ya era `editando ? texto : String(valor)`, o sea que **el texto ya se derivaba**.
El efecto no pintaba nada; solo servía para que el texto estuviera al día al enfocar.
Se movió al `onFocus`. Ese hallazgo no vino de saber React: vino de leer el archivo con
la atención que exige escribir sus tests.

**`CronometroSesion`**. Cero tests, y alimenta la `duracionMin` que sube al servidor.
Se escribieron 7: cuatro nacieron verdes documentando lo que ya hacía bien, dos
nacieron rojos con una sesión de 3 días —fallaban con `259200` segundos exactos, el
fallo reproducido al segundo— y **uno fija el límite por el otro lado**: una sesión de
2 horas es dura pero real, y tiene que conservarse.

Ese último es el que importa recordar: **un test que impide que el arreglo se pase de
listo.** Sin él, «descartar cronómetros viejos» podría haber borrado entrenos largos
legítimos y nadie se habría enterado.

## Qué probar

- El comportamiento observable, no la implementación. Si el test se rompe al mover una
  línea de sitio, está probando lo que no debe.
- Los dos lados de cada límite: lo que hay que descartar **y** lo que hay que conservar.
- Los casos borde reales del dominio, no los abstractos: alguien entrena en un sótano
  sin señal, abre la app en el vestuario, cierra sesión a media serie, comparte el
  teléfono.

## Qué NO demuestran los tests

Que el código hace lo que su autor dijo. **No** que sea correcto para el Método
Heracles ni para el criterio nutricional. Los coeficientes, los topes y los umbrales
los confirma Bryan. Dilo cuando entregues.
