#!/usr/bin/env python3
"""Aksara v0.5 high-fidelity PSD from locked original illustration.
Avoids Gaussian-smudged eyes/lips, excessive feather and broad oval ornaments.
Reconstructed skin is hidden beneath real named feature layers. This is
still an automated art-separation pass, not hand-repainted Cubism artwork.
"""
import argparse, importlib.util, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import cv2

spec=importlib.util.spec_from_file_location("draft",Path(__file__).with_name("build-aksara-live2d-psd.py"))
draft=importlib.util.module_from_spec(spec);spec.loader.exec_module(draft)
W,H=1086,1448
draft.WIDTH=W;draft.HEIGHT=H

def polygon(points,feather=1.2):
    m=Image.new("L",(W,H));ImageDraw.Draw(m).polygon(points,fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather))
def ellipse(rect,feather=1):
    m=Image.new("L",(W,H));ImageDraw.Draw(m).ellipse(rect,fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather))
def rgba(image,mask):
    out=image.copy().convert("RGBA");out.putalpha(mask);return out
def combine(masks):
    out=Image.new("L",(W,H))
    for m in masks:out=Image.fromarray(np.maximum(np.asarray(out),np.asarray(m)).astype("uint8"),"L")
    return out
def fill_skin(source):
    # Inpaint removes duplicate soft under-eyes and mouth shadows visible when
    # eyelid/iris/mouth art meshes move independently. Feature art stays crisp.
    mask=Image.new("L",(W,H));d=ImageDraw.Draw(mask)
    for r in ((365,351,500,476),(561,349,733,470),(471,553,618,631),
              (375,325,514,370),(561,322,710,373)):
        d.ellipse(r,fill=255)
    rgb=np.array(source.convert("RGB"))
    repaired=cv2.inpaint(rgb,np.array(mask),11,cv2.INPAINT_TELEA)
    return Image.fromarray(repaired,"RGB")
def ornament(source,region,kind):
    # Bright, metallic edge pixels are segmented inside a small precise ROI.
    # Unlike the old huge ellipses this cannot drag an entire hair background
    # across the forehead when the separate crown part moves.
    x0,y0,x1,y1=region
    rgb=np.array(source.convert("RGB"))
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    bright=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    bound=np.zeros((H,W),np.uint8)
    cv2.ellipse(bound,((x0+x1)//2,(y0+y1)//2),((x1-x0)//2,(y1-y0)//2),0,0,360,255,-1)
    if kind=="sun":
        c=(hsv[:,:,0]>=6)&(hsv[:,:,0]<=35)&(bright>=96)&(hsv[:,:,1]>65)
    else:
        c=(hsv[:,:,0]>=90)&(hsv[:,:,0]<=135)&(bright>=90)&(hsv[:,:,1]>30)
    alpha=(c.astype(np.uint8)*255)&bound
    alpha=cv2.morphologyEx(alpha,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    alpha=cv2.GaussianBlur(alpha,(3,3),.55)
    return Image.fromarray(alpha,"L")
def mouth_inside(source):
    # Small dark inner mouth behind the closed lip layer: no blurred patch.
    image=Image.new("RGBA",(W,H),(0,0,0,0));d=ImageDraw.Draw(image)
    d.ellipse((499,587,590,608),fill=(68,24,39,242))
    d.arc((502,583,591,608),180,348,fill=(156,80,86,195),width=2)
    return image

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",default="bilik-antara-avatar-2d-art.webp")
    parser.add_argument("--output",default="build/live2d/aksara-celestial-layered-draft.psd")
    parser.add_argument("--layers-dir",default="build/live2d/parts")
    args=parser.parse_args()
    original=Image.open(args.source).convert("RGB").resize((W,H),Image.Resampling.LANCZOS)
    skin=fill_skin(original)
    face=polygon([(465,181),(595,188),(683,252),(733,362),(744,468),
      (716,566),(673,629),(617,688),(547,707),(478,700),(409,663),
      (367,601),(348,497),(352,371),(398,261)],1.4)
    # Reconstruct hidden hair/neck behind moving face. A solid dark face hole
    # makes triangular seams visible around the jaw during head turns.
    small=(round(W*.38),round(H*.38))
    tiny=cv2.resize(np.array(original),small,interpolation=cv2.INTER_AREA)
    tiny_mask=cv2.resize(np.array(face),small,interpolation=cv2.INTER_AREA)
    hidden=cv2.inpaint(tiny,(tiny_mask>16).astype(np.uint8)*255,12,cv2.INPAINT_TELEA)
    hidden=cv2.resize(hidden,(W,H),interpolation=cv2.INTER_CUBIC).astype(np.float32)
    # Preserve *hair* texture in the exposed jaw silhouette. Pure inpainting
    # reconstructs only a smooth brown plane, causing a visible polygon seam.
    # Source hair is sampled from 245..330 (left) and 850..955 (right):
    # no eyes, mouth, earrings or crown should leak into the underpainting.
    rgb=np.array(original,dtype=np.float32)
    for y in range(340,760):
        fy=min(1.,max(0.,(y-340)/65.),max(0.,(760-y)/70.))
        if fy<=0:continue
        for x in range(315,540):
            progress=(x-315)/225.
            weight=.95*(1-progress)**1.28*fy
            sample_x=int(245+progress*85)
            hidden[y,x]=hidden[y,x]*(1-weight)+rgb[y,sample_x]*weight
        for x in range(590,810):
            progress=(810-x)/220.
            weight=.90*(1-progress)**1.27*fy
            sample_x=int(955-(1-progress)*105)
            hidden[y,x]=hidden[y,x]*(1-weight)+rgb[y,sample_x]*weight
    hidden=np.uint8(np.clip(hidden,0,255))
    backdrop=Image.composite(Image.fromarray(hidden,"RGB"),original,face)
    # Explicit back hair right/left give the head lateral texture overlap.
    left_back=polygon([(0,313),(159,176),(326,142),(310,595),(335,941),(300,1448),(0,1448)],2)
    right_back=polygon([(735,150),(936,210),(1086,380),(1086,1448),
                        (789,1448),(752,1080),(794,692)],2)
    dress=polygon([(360,649),(736,643),(893,787),(1086,1100),
                   (1086,1448),(0,1448),(0,1050),(178,827)],2)
    eye_left=polygon([(363,414),(376,392),(412,376),(445,374),(487,390),(506,411),
                      (483,447),(444,461),(403,456),(372,438)],1)
    eye_right=polygon([(563,410),(574,390),(611,373),(653,372),(699,383),(724,412),
                       (703,449),(657,462),(602,452),(572,435)],1)
    # Eye whites and irises must not contain 5–8px blurred borders.
    iris_l=ellipse((417,389,474,454),.5)
    iris_r=ellipse((611,388,678,454),.5)
    eyelid_l=polygon([(361,406),(377,384),(416,364),(455,366),(488,385),
                      (503,409),(486,398),(447,387),(411,387),(376,411)],1)
    eyelid_r=polygon([(560,404),(575,383),(612,363),(657,365),(703,379),
                      (725,408),(704,393),(654,385),(612,388),(575,410)],1)
    brow_l=ellipse((383,337,503,386),1)
    brow_r=ellipse((577,332,704,385),1)
    mouth=ellipse((481,574,604,626),1)
    lip_upper=polygon([(488,581),(507,578),(534,582),(544,583),
                       (564,579),(589,583),(603,595),(544,590),(497,590)],1)
    lip_lower=polygon([(489,598),(525,610),(547,612),(570,610),
                       (602,598),(582,619),(544,623),(510,618)],1)
    front_left=polygon([(171,160),(251,72),(413,26),(537,58),(459,133),
       (388,230),(349,356),(327,475),(304,625),(272,731),(234,836),
       (196,734),(228,524),(255,321),(216,265)],2)
    front_right=polygon([(557,53),(728,67),(884,182),(929,388),(861,630),
       (815,844),(756,741),(739,608),(722,423),(674,328),(639,229),(580,172)],2)
    sun=ornament(original,(167,83,459,355),"sun")
    moon=ornament(original,(660,78,929,368),"moon")

    # v0.5 structural repair: NEVER export a full static portrait behind the
    # animated parts. The old backdrop contained 100% opaque original hair,
    # eyes, costume and ornaments, making doubled / "ghost" features inevitable.
    # The app provides the environmental gradient behind the transparent rig.
    #
    # A real BACK HAIR part is kept for occlusion but gets a feature-free
    # underpainting, not the whole frozen image.
    hair_root=polygon([
      (295,1),(720,1),(802,70),(888,171),(940,305),(936,491),
      (898,648),(847,774),(819,1039),(803,1447),
      (289,1447),(260,1081),(211,830),(178,642),(165,429),
      (200,237),(249,103)],3)
    from PIL import ImageChops
    trim=ImageChops.lighter(left_back,right_back)
    hair_root=ImageChops.subtract(hair_root,trim)
    # Inpaint prominent front-hair strands and metal crown behind their
    # corresponding moving layers; otherwise those pixels duplicate.
    hidden_root=np.array(backdrop.convert("RGB"))
    moving=np.zeros((H,W),np.uint8)
    for feature in (front_left,front_right):
        moving=np.maximum(moving,np.array(feature,dtype=np.uint8))
    cv2.ellipse(moving,(315,220),(166,149),0,0,360,255,-1)
    cv2.ellipse(moving,(792,217),(135,155),0,0,360,255,-1)
    reduced=(round(W*.48),round(H*.48))
    coarse=cv2.resize(hidden_root,reduced,interpolation=cv2.INTER_AREA)
    coarse_mask=cv2.resize(moving,reduced,interpolation=cv2.INTER_NEAREST)
    coarse_repair=cv2.inpaint(coarse,(coarse_mask>24).astype(np.uint8)*255,9,cv2.INPAINT_TELEA)
    root_paint=Image.fromarray(cv2.resize(coarse_repair,(W,H),interpolation=cv2.INTER_CUBIC),"RGB")

    # PSD record order here is back -> front, tested in v0.3; don't reverse.
    parts=[
      # No full-resolution static portrait in the Cubism drawable list.
      ("back hair root",rgba(root_paint,hair_root)),
      ("back hair left",rgba(original,left_back)),
      ("back hair right",rgba(original,right_back)),
      ("topwear",rgba(original,dress)),
      ("face",rgba(skin,face)),
      ("mouth inside",mouth_inside(original)),
      ("eyewhite-l",rgba(original,eye_left)),
      ("eyewhite-r",rgba(original,eye_right)),
      ("irides-l",rgba(original,iris_l)),
      ("irides-r",rgba(original,iris_r)),
      ("upper eyelid-l",rgba(original,eyelid_l)),
      ("upper eyelid-r",rgba(original,eyelid_r)),
      ("eyebrow-l",rgba(original,brow_l)),
      ("eyebrow-r",rgba(original,brow_r)),
      ("upper lip",rgba(original,lip_upper)),
      ("lower lip",rgba(original,lip_lower)),
      ("mouth close",rgba(original,mouth)),
      ("front hair 1",rgba(original,front_left)),
      ("front hair 2",rgba(original,front_right)),
      ("headwear sun",rgba(original,sun)),
      ("headwear moon",rgba(original,moon)),
    ]
    path=Path(args.output)
    draft.save_psd(path,original,parts)
    outdir=Path(args.layers_dir);outdir.mkdir(parents=True,exist_ok=True)
    for index,(name,image) in enumerate(parts):
        image.save(outdir/("%02d_%s.png"%(index,name.replace(" ","_"))),compress_level=6)
    # Also export tight transparent ornaments for independent Pixi physics test.
    props=outdir/"accessories";props.mkdir(exist_ok=True)
    coordinates={}
    for name,mask in [("sun",sun),("moon",moon)]:
        image=rgba(original,mask)
        bbox=image.getchannel("A").getbbox()
        if bbox:
            image.crop(bbox).save(props/(name+".png"))
            coordinates[name]={"file":name+".png","bounds":list(bbox)}
    (props/"accessories.json").write_text(json.dumps({"canvas":[W,H],"sprites":coordinates,"isOverlay":True},indent=2),encoding="utf-8")
    metadata={"size":[W,H],"layers":[n for n,_ in parts],
      "quality":"high-resolution-automated-separation","fidelity":"requires-human-repaint-audit",
      "rig_complete":False,"source_is_flattened":True,"atlas_target":4096,
      "opaque_full_portrait_layer":False,"transparent_background":True}
    (outdir/"manifest.json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
    print(json.dumps({"output":str(path),"bytes":path.stat().st_size,
      "layers":len(parts),"atlas":4096,"rig_ready":False}))
if __name__=="__main__":main()
