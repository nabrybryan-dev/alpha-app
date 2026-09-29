"""Read original PIEZ assets without changing their geometry or names."""
import base64, struct
from pathlib import Path
import numpy as np

ROOT=Path(__file__).parent
def load(name):
    data=base64.b64decode((ROOT/'piezas'/f'atlas-{name}.b64.txt').read_text())
    assert data[:4]==b'PIEZ'
    count=struct.unpack_from('<H',data,6)[0];offset=8;parts=[]
    def read(dtype,n):
        nonlocal offset
        a=np.frombuffer(data,dtype=dtype,count=n,offset=offset).copy()
        offset+=a.nbytes
        return a
    def align():
        nonlocal offset
        offset=(offset+3)//4*4
    for _ in range(count):
        length=struct.unpack_from('<H',data,offset)[0];offset+=2
        label=data[offset:offset+length].decode('utf-8');offset+=length;align()
        flags,nv,ni=map(int,read('<u4',3))
        origin=read('<f4',3);scale=read('<f4',3)
        if not flags&2:offset+=16
        pos=read('<u2',nv*3).reshape(-1,3).astype(np.float32)/65535*scale+origin;align()
        normal=read('i1',nv*3).reshape(-1,3).astype(np.float32)/127;align()
        color=read('u1',nv*3).reshape(-1,3);align()
        if not flags&2:offset+=nv*4;align()
        faces=read('<u4' if flags&4 else '<u2',ni).reshape(-1,3);align()
        parts.append(dict(name=label,pos=pos,normal=normal,color=color,faces=faces))
    assert offset==len(data),(offset,len(data))
    return parts

if __name__=='__main__':
    for name in ['musculos-zanatomy','esqueleto']:
        parts=load(name)
        print(name,len(parts),sum(len(p['pos']) for p in parts),'vertices')
        for p in parts:
            if any(w in p['name'].lower() for w in ['delt','pect','bice','biceps','triceps','patell','scap','humer','femur','tibia','quadr','rectus','achill','clav']):
                print(p['name'],p['pos'].mean(axis=0).round(3).tolist())
