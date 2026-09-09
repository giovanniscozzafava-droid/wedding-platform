#!/usr/bin/env python3
"""Copia i ritagli in frontend/public/album-swatches e genera swatches.generated.ts (chiave → URL)."""
import json, os, shutil
S = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(S, 'swatches-out')
FE = os.path.expanduser('~/Repository/wedding-platform/frontend')
DST = os.path.join(FE, 'public', 'album-swatches')
TS = os.path.join(FE, 'src', 'components', 'album', 'catalog', 'swatches.generated.ts')
man = json.load(open(os.path.join(SRC, 'manifest.json')))
if os.path.isdir(DST): shutil.rmtree(DST)
shutil.copytree(SRC, DST, ignore=shutil.ignore_patterns('manifest.json'))
entries = {}
for group in ('materials', 'logos', 'tones'):
    for k, rel in man[group].items(): entries[k] = '/album-swatches/' + rel
lines = ['// GENERATO da scratchpad/gen-swatches-ts.py: ritagli del catalogo DesignAlbum 2022 (150 dpi).',
         '// Chiavi: «mat:<materiale>» tessera del materiale, «<materiale>:<colore>» campione colore,',
         '// «cod.NN» logo (pag. 34–37), tonalità del logo (pag. 37). Non modificare a mano.',
         'export const SWATCH: Record<string, string> = {']
for k in sorted(entries): lines.append(f"  '{k}': '{entries[k]}',")
lines.append('}')
lines.append('export const swatchUrl = (key?: string | null): string | undefined => (key ? SWATCH[key] : undefined)')
open(TS, 'w').write('\n'.join(lines) + '\n')
total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DST) for f in fs)
print(len(entries), 'voci ·', round(total / 1024), 'KB in public/album-swatches')
