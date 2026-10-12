import json,base64,pathlib,zlib
root=pathlib.Path(__file__).resolve().parent
def decode_group(key):
    files=list((root/'chunks').glob(key+'-*.json'))
    parts=[json.loads(p.read_text()) for p in files]
    if not parts: raise ValueError('No parts: '+key)
    parts.sort(key=lambda p:p['index'])
    head=parts[0]
    if [p['index'] for p in parts]!=list(range(head['chunks'])): raise ValueError('Incomplete parts: '+key)
    if any((p['checksum'],p['byteLength'],p['chunks'])!=(head['checksum'],head['byteLength'],head['chunks']) for p in parts): raise ValueError('Snapshot changed: '+key)
    packed=base64.b64decode(''.join(p['data'] for p in parts),validate=True)
    if head['encoding']=='zlib-utf8-base64':
        data=zlib.decompress(packed)
        if len(data)!=head['byteLength'] or zlib.adler32(data)!=head['checksum']:raise ValueError('Integrity failed: '+key)
        result=json.loads(data)
        (root/(key+'.json')).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
        return result
    if len(packed)%2:raise ValueError('Odd packed length')
    codes=[int.from_bytes(packed[i:i+2],'big') for i in range(0,len(packed),2)]
    reset=head['encoding']=='lzw16-reset-utf8-base64'
    d={i:bytes([i]) for i in range(256)}; nxt=257 if reset else 256
    w=d[codes[0]] if codes else b''; out=[w]
    for code in codes[1:]:
        if reset and code==256:
            d={i:bytes([i]) for i in range(256)};nxt=257;w=None;continue
        if w is None:
            w=d[code];out.append(w);continue
        if code in d: entry=d[code]
        elif code==nxt: entry=w+w[:1]
        else: raise ValueError('Invalid LZW code')
        out.append(entry)
        if nxt<65536:d[nxt]=w+entry[:1];nxt+=1
        w=entry
    data=b''.join(out)
    if len(data)!=head['byteLength'] or zlib.adler32(data)!=head['checksum']: raise ValueError('Integrity failed: '+key)
    result=json.loads(data)
    if result.get('schema')=='figma-content-inventory-v2':
        result['components']=[]
        for r in result['componentRows']:
            n=result['nodeRows'][r[0]]
            c={'nodeIndex':r[0],'id':n[0],'type':n[1],'name':result['names'][n[2]],'parentId':result['nodeRows'][n[3]][0] if n[3]>=0 else result['page']['id'],'key':r[1],'description':r[2],'descriptionMarkdown':r[3],'variantProperties':r[4],'width':r[5],'height':r[6],**result['componentFormats'][r[7]]}
            result['components'].append(c)
        del result['componentRows'];del result['componentFormats']
    (root/(key+'.json')).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    return result
if __name__=='__main__':
    keys=sorted(set(p.stem.rsplit('-',1)[0] for p in (root/'chunks').glob('*.json')))
    results=[]
    for k in keys:
        try:
            r=decode_group(k)
            results.append({'key':k,'page':r.get('page'),'nodes':len(r.get('nodes',[])),'variables':len(r.get('variables',[]))})
        except Exception as e:results.append({'key':k,'error':str(e)})
    print(json.dumps(results,ensure_ascii=False))
