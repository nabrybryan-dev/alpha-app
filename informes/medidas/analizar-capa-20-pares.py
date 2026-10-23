import json, random, statistics as st
d='salidas20/'
pares=[]
for i in range(1,21):
    a=json.load(open(f'{d}capa-{i}.json')); b=json.load(open(f'{d}hoy-{i}.json'))
    assert a['pasosConPestanaOculta']==0 and b['pasosConPestanaOculta']==0
    assert a['verticesDeLaCapa']==a['fotogramas']*912 and b['verticesDeLaCapa']==0
    pares.append((a['fotogramaCPU']['mediana'],b['fotogramaCPU']['mediana'],a['fotogramaCPU']['p90'],b['fotogramaCPU']['p90'],a['cargaCPUantes'],b['cargaCPUantes'],a['hora']))
dif=[x[0]-x[1] for x in pares]
random.seed(20261021)
boots=sorted(st.median(random.choices(dif,k=len(dif))) for _ in range(10000))
lo,hi=boots[249],boots[9749]
print('mediana d',st.median(dif),'IC95',lo,hi)
print('mediana capa',st.median(x[0] for x in pares),'sin',st.median(x[1] for x in pares))
print('p90 capa max',max(x[2] for x in pares),'sin max',max(x[3] for x in pares))
print('d>0:',sum(1 for x in dif if x>0),'d<0:',sum(1 for x in dif if x<0))
for i,x in enumerate(pares,1): print(i,x[6],x[0],x[1],round(x[0]-x[1],1),'p90',x[2],x[3],'carga',x[4],x[5])
print('cabe' if hi<1 else 'no determinable con el equipo cargado')
