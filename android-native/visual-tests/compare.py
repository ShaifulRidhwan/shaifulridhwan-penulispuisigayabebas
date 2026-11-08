"""Evidence-only comparison. No absent screenshot may pass. Controls have separate ROIs."""
import json,pathlib,sys
import numpy as np
from PIL import Image,ImageChops
from skimage.metrics import structural_similarity
root=pathlib.Path(__file__).resolve().parents[2]/'docs/android-rebuild/visual-comparison'
out=root/'diff';out.mkdir(exist_ok=True)
rows=[]
for web in sorted((root/'web').glob('*.png')):
 native=root/'android'/web.name
 if not native.exists():
  rows.append(dict(screen=web.stem,status='MISSING_NATIVE',similarity=None));continue
 a=Image.open(web).convert('RGB');b=Image.open(native).convert('RGB')
 if a.size!=b.size:
  rows.append(dict(screen=web.stem,status='VIEWPORT_MISMATCH',web=a.size,android=b.size));continue
 x=np.asarray(a);y=np.asarray(b)
 score=structural_similarity(x,y,channel_axis=2,data_range=255)*100
 # Component ROIs are derived from measured web geometry, not chosen after seeing a score.
 measured=json.loads(web.with_suffix('.json').read_text());regions=[]
 for e in measured['elements']:
  if e['id'] not in ['voiceLive','connection','codeEngineStatus','codeAITerminalOpen','composer','thoughtMode','sendBtn','portalCard','multiAiDialog','codeEngineMenu','aksaraAITerminal','attachmentDialog','thoughtModeDialog','aksaraMicPermission'] and e['cls'] not in ['topbar aksara-header','bubble']:continue
  r=e['rect'];left=max(0,round(r['x']));top=max(0,round(r['y']));right=min(a.width,round(r['x']+r['width']));bottom=min(a.height,round(r['y']+r['height']))
  if right-left<7 or bottom-top<7:continue
  v=structural_similarity(x[top:bottom,left:right],y[top:bottom,left:right],channel_axis=2,data_range=255)*100
  regions.append(dict(component=e['id'] or e['cls'],ssim_percent=round(v,3)))
 passed=score>=98 and all(r['ssim_percent']>=98 for r in regions)
 rows.append(dict(screen=web.stem,status='PASSED' if passed else 'MISMATCH',ssim_percent=round(score,3),mae=float(np.abs(x.astype(float)-y).mean()),components=regions))
 pair=Image.new('RGB',(a.width*2,a.height));pair.paste(a);pair.paste(b,(a.width,0));pair.save(out/(web.stem+'-pair.png'))
 delta=np.abs(x.astype(float)-y).mean(axis=2);heat=np.zeros_like(x);heat[:,:,0]=np.minimum(delta*5,255).astype('uint8');Image.fromarray(heat).save(out/(web.stem+'-heat.png'))
(root/'results.json').write_text(json.dumps(rows,indent=2))
(root/'REPORT.md').write_text('# Native versus web visual comparison\n\nSSIM is measured image similarity, not acceptance proof. Every control ROI must also meet 98%. Manual geometry, typography and glass inspection remains required.\n\n| Screen | SSIM % | Result |\n|---|---|---|\n'+'\n'.join(f"| {r['screen']} | {r.get('ssim_percent','—')} | {r['status']} |" for r in rows))
print(json.dumps(rows,indent=2))
if not rows or any(r['status']!='PASSED' for r in rows):sys.exit(1)
