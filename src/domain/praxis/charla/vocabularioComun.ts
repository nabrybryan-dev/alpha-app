// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * Palabras comunes del español para el vocabulario permitido de la charla (ver `vocabularioPermitido.ts`):
 * artículos, preposiciones, pronombres, conectores, interrogativos, verbos frecuentes y números en letra de uno a diez.
 * Es una lista FIJA y corta a propósito: lo propio del dominio sale de las piezas aprobadas, no de aquí.
 * NO lleva ningún nombre de persona ni palabras que identifiquen (lugares, marcas, oficios raros).
 */
export const PALABRAS_COMUNES: readonly string[] = (
  'el la los las un una unos unas lo al del de a en con sin sobre entre hacia hasta desde por para segun tras ante bajo contra durante mediante ' +
  'yo tu usted el ella nosotros ustedes ellos ellas me te se nos les le mi mis tu tus su sus nuestro nuestra este esta esto estos estas ese esa eso esos esas aquel ' +
  'y e o u ni pero sino que como cuando donde cual cuales quien quienes cuanto cuanta cuantos cuantas cuanto porque pues aunque si no tambien tampoco ya aun todavia ' +
  'mas menos muy poco poca pocos pocas mucho mucha muchos muchas tan tanto bastante demasiado casi solo solamente siempre nunca a veces ' +
  'algo nada alguien nadie todo toda todos todas cada otro otra otros otras mismo misma varios varias ambos ' +
  'que cual como cuando donde cuanto por que para que ' +
  'es son soy eres somos era eran fue fueron sea sean ser estar esta estan estoy estas estamos estaba estaban estuvo esten ' +
  'hay haber ha han he has habia hubo habra hacer hace hacen hago haces hacemos hizo hacia ' +
  'tener tiene tienen tengo tienes tenemos tenia tuvo ' +
  'poder puede pueden puedo puedes podemos podria podrian ' +
  'deber debe deben debo debes debemos debria ' +
  'querer quiere quieren quiero quieres queremos quisiera ' +
  'saber sabe saben se sabes ' +
  'ir va van voy vas vamos iba ' +
  'ver ve ven veo vez veces dar da dan doy ' +
  'decir dice dicen digo ' +
  'pasar pasa pasan ' +
  'poner pone ponen pongo ' +
  'dejar deja dejo ' +
  'llevar lleva llevo ' +
  'seguir sigue siguen sigo ' +
  'usar usa usan uso ' +
  'ayudar ayuda ayudan ' +
  'servir sirve sirven ' +
  'depender depende dependen ' +
  'cambiar cambia cambio ' +
  'sentir siento siente ' +
  'pensar pienso piensa ' +
  'creer creo cree ' +
  'necesitar necesito necesita necesitan ' +
  'importar importa ' +
  'significa significar ' +
  'bien mal mejor peor bueno buena buenos buenas malo mala ' +
  'primero primera segundo segunda tercero ultimo ultima ' +
  'cero uno una dos tres cuatro cinco seis siete ocho nueve diez ' +
  'aqui alli ahi ahora antes despues luego entonces hoy ayer manana ' +
  'asi tal tales ' +
  'puntos'
)
  .split(/\s+/)
  .filter(Boolean)
