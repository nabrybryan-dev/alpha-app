import { coeficiente1rm } from '../src/domain/ondulacion.ts'
const T = "10/11/1 10/11/2 10/11/3 10/11/4 10/12/1 10/12/2 10/12/3 10/13/2 11/12/2 12/13/1 12/13/2 12/13/3 12/13/4 12/14/2 12/14/3 12/15/2 13/15/2 13/15/3 14/15/3 15/17/2 15/17/3 15/18/2 15/18/3 16/17/2 16/18/1 2/6/2 20/25/3 5/6/2 6/10/2 6/7/1 6/7/2 6/7/3 6/8/1 6/8/2 6/8/4 7/8/2 7/8/3 8/10/2 8/10/3 8/10/4 8/11/2 8/12/2 8/9/1 8/9/2 8/9/3 8/9/4 9/10/2 9/11/2".split(' ')
const filas = T.map((t) => {
  const [rmin, diana, rir] = t.split('/').map(Number)
  const base = coeficiente1rm(diana, rir)
  return `  (${rmin}, ${diana}, ${rir}, ${(coeficiente1rm(rmin, rir) / base).toFixed(6)}, ${(coeficiente1rm(diana - 1, rir) / base).toFixed(6)})`
})
console.log(filas.join(',\n'))
console.error(`\n(${filas.length} filas · factor techo = coef(min)/coef(diana) · factor peldano = coef(diana-1)/coef(diana))`)
