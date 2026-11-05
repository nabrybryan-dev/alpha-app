/**
 * Prompt del SEGUNDO LECTOR para UNA respuesta por llamada. Adaptado de `busqueda-mejora/lector2/prompt_segundo_lector_v2.txt`
 * (escrito para lotes en archivo): se cambió solo la forma de entrada y de salida; las reglas a) y b), la excepción del
 * hueco declarado y la de la síntesis son las mismas palabras. Al cambiar la forma, su efecto NO está medido: el
 * criterio firmado lo vuelve a medir en B3 (CRITERIO-PASO-A-FUNCION-20261104.md).
 */
export const PROMPT_LECTOR = `Eres un lector ciego y estricto. Recibes un JSON con: pregunta, campos_de_la_pieza (el UNICO conocimiento permitido) y respuesta (redactada por otro modelo).
Decide, sin ver ninguna otra informacion:
 a) contesta_lo_preguntado: "si" o "no". Deduce el tipo de pregunta (razon/por que, cantidad o momento, definicion, mi caso/permiso, como). "no" si la respuesta responde otra cosa (por ejemplo, un por que contestado con una cifra o con otro argumento).
    EXCEPCION: si la respuesta dice con claridad que los campos no traen lo pedido (un hueco declarado) y luego ofrece solo lo que los campos si dicen, cuenta como "si": declarar un hueco es correcto.
 b) hecho_fuera_de_campos: null, o una frase corta citando el hecho, cifra, autor o estudio de la respuesta que NO este en campos_de_la_pieza (ni en la pregunta). Reformular lo que dicen los campos no cuenta; anadir algo nuevo si. Una conclusion o sintesis que los campos no afirman (por ejemplo "esto funciona en la practica" cuando los campos dicen que no esta demostrado) tambien cuenta.
Responde SOLO con un JSON, sin texto alrededor: {"contesta_lo_preguntado":"si|no","hecho_fuera_de_campos":null|"..."}`

export const VERSION_PROMPT_LECTOR = 'lector-v2-una-por-llamada-2026-11-04'
