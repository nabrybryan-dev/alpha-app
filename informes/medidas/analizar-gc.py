import json, glob, collections, sys
sys.stdout.reconfigure(encoding='utf-8')
for f in sorted(glob.glob('trazas/*.trace.json')):
    d = json.load(open(f, encoding='utf-8'))
    ev = d['traceEvents'] if isinstance(d, dict) else d
    nombres = collections.Counter(e.get('name') for e in ev if 'GC' in str(e.get('name')) or 'Scaveng' in str(e.get('name')))
    gc = [e for e in ev if e.get('name') in ('MajorGC','MinorGC') and e.get('ph')=='X']
    # tareas largas del renderer
    tareas = [e for e in ev if e.get('name')=='RunTask' and e.get('ph')=='X' and e.get('dur',0) > 50000]
    # tiempo GC dentro de la pagina: eventos V8.GC_* con dur
    v8gc = [e for e in ev if str(e.get('name','')).startswith('V8.GC') and e.get('ph')=='X']
    tot = sum(e['dur'] for e in gc)/1000
    mx = max((e['dur'] for e in gc), default=0)/1000
    def solapa(t):
        return sum(1 for g in gc if g['ts'] < t['ts']+t['dur'] and g['ts']+g['dur'] > t['ts'])
    print(f, 'GC', len(gc), 'tot ms', round(tot,1), 'max ms', round(mx,2),
          '| tareas>50ms', len(tareas), 'max', round(max((t['dur'] for t in tareas), default=0)/1000,1),
          'con GC dentro', sum(1 for t in tareas if solapa(t)), '| nombres GC', dict(list(nombres.items())[:5]))
