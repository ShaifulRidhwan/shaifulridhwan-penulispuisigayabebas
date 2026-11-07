#!/usr/bin/env python3
"""AKSARA Live2D v0.6: cohesive raster-art rig source.

Rebuild from the approved hand-detailed cinematic portrait (not vectors).
The earlier PSD accidentally stacked independent eyelid/lip/face cutouts,
original eye/iris and stray crown/background duplicates. This conservative
prototype prioritizes one connected head and clean face over large motion.
Not a substitute for Cubism Editor manual redraw/mesh quality assurance.
"""
import argparse, importlib.util, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W,H=1086,1448

def mask_poly(points,blur=1.4):
    im=Image.new("L",(W,H),0)
    ImageDraw.Draw(im).polygon(points,fill=255)
    if blur: im=im.filter(ImageFilter.GaussianBlur(blur))
    return im

def eye_mask(box):
    # Neutral eye is a single complete photo-detailed layer: no second eyelid
    # or iris cutout can ever overprint the first eye.
    a=Image.new("L",(W,H),0)
    ImageDraw.Draw(a).ellipse(box,fill=255)
    return a.filter(ImageFilter.GaussianBlur(2.2))

def masked(rgb,alpha):
    image=rgb.copy().convert("RGBA")
    image.putalpha(alpha)
    return image

def repair_underlay(src,areas):
    # Feature-free skin in the face underneath actual moving eye/lip layers.
    # Inpainting does not copy duplicate irises or lips onto the base face.
    m=np.zeros((H,W),np.uint8)
    draw=Image.new("L",(W,H),0)
    pen=ImageDraw.Draw(draw)
    for rect in areas:
        pen.ellipse(rect,fill=255)
    m=np.array(draw)
    m=cv2.dilate(m,np.ones((5,5),np.uint8))
    raw=np.array(src.convert("RGB"))
    coarse=cv2.resize(raw,(round(W*.7),round(H*.7)),interpolation=cv2.INTER_AREA)
    cm=cv2.resize(m,(round(W*.7),round(H*.7)),interpolation=cv2.INTER_NEAREST)
    clean=cv2.inpaint(coarse,(cm>10).astype("uint8")*255,9,cv2.INPAINT_TELEA)
    clean=cv2.resize(clean,(W,H),interpolation=cv2.INTER_CUBIC)
    # Use exact original pixels everywhere except the requested facial holes.
    expanded=cv2.GaussianBlur(m,(0,0),3)/255.
    repaired=np.uint8(np.clip(raw*(1-expanded[...,None])+clean*expanded[...,None],0,255))
    return Image.fromarray(repaired,"RGB")

def compose(layers):
    output=Image.new("RGBA",(W,H))
    for _,part in layers:output=Image.alpha_composite(output,part)
    return output

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",default="bilik-antara-avatar-2d-art.webp")
    ap.add_argument("--output",default="build/live2d-v06/aksara-cohesive.psd")
    ap.add_argument("--parts-dir",default="build/live2d-v06/parts")
    args=ap.parse_args()
    src=Image.open(args.source).convert("RGB").resize((W,H),Image.Resampling.LANCZOS)
    # Head and ornament sit in ONE coherent textured part. Thus crown, bangs,
    # face, ears and cheeks cannot lag behind one another during head turns.
    # Hair/body ownership is gradually handed off at the neck below the jaw.
    contour=[
      (348,0),(691,0),(781,46),(850,93),(900,180),(917,330),
      (941,475),(903,586),(831,713),(775,791),(687,827),
      (388,827),(308,766),(240,685),(159,555),(169,387),
      (188,258),(229,153),(287,68)
    ]
    head=mask_poly(contour,2)
    h=np.asarray(head,dtype=np.float32).copy()
    # Feather 36 pixels only at the junction of neck and shoulders.
    for y in range(744,828):
        h[y,:]*=1-(y-744)/84.
    h=np.uint8(np.clip(h,0,255))
    head=Image.fromarray(h,"L")

    # The lower portrait is the actual robe and long hair. A complementary
    # alpha transition yields one owner per pixel in the neck overlap.
    # Never draw a second frozen original portrait behind the head.
    body=Image.new("L",(W,H))
    mask_arr=np.zeros((H,W),np.float32)
    y0,y1=704,838
    for y in range(y0,H):
        a=min(1,max(0,(y-y0)/(y1-y0)))
        mask_arr[y,:]=255*a
    # The body is clipped to its real visible silhouette, not a screen rectangle.
    silhouette=mask_poly([
      (250,682),(351,667),(452,716),(625,715),(738,664),
      (846,746),(945,855),(1085,892),(1085,1447),(0,1447),
      (0,899),(119,824)
    ],4)
    mask_arr=np.minimum(mask_arr,np.asarray(silhouette,dtype=np.float32))
    # Long hair begins above the robe. Its original raster strands are owned
    # by the body underlay, rather than cut away along a polygonal head edge.
    left_hair=mask_poly([
      (0,625),(89,477),(228,304),(327,290),(381,445),
      (374,817),(432,1174),(334,1447),(0,1447)
    ],6)
    right_hair=mask_poly([
      (752,295),(891,385),(991,520),(1085,662),
      (1085,1447),(738,1447),(706,996),(716,653)
    ],6)
    mask_arr=np.maximum(mask_arr,np.asarray(left_hair,dtype=np.float32))
    mask_arr=np.maximum(mask_arr,np.asarray(right_hair,dtype=np.float32))
    # The central face is not duplicated in the lower layer.
    # Safe left/right hair underpainting is naturally occluded by the
    # intact coherent head at neutral pose.
    # Exclude duplicates: a pixel already fully owned by moving head is not
    # simultaneously owned by the still torso. Small underpaint near join
    # remains for disocclusion, but it cannot show when head is neutral.
    body.putdata(np.uint8(np.clip(mask_arr,0,255)).flatten().tolist())

    # Separate expression parts only once. No upper-eyelid/lower-lip duplicate.
    eye_l_box=(363,370,514,458)
    eye_r_box=(569,368,726,458)
    mouth_box=(472,562,614,628)
    eye_l=eye_mask(eye_l_box)
    eye_r=eye_mask(eye_r_box)
    mouth=eye_mask(mouth_box)
    neutral_face=repair_underlay(src,[eye_l_box,eye_r_box,mouth_box])
    # The crown and long bangs remain painted exactly as originally authored.
    layers=[
      ("topwear",masked(src,body)),
      ("face",masked(neutral_face,head)),
      ("eyewhite-l",masked(src,eye_l)),
      ("eyewhite-r",masked(src,eye_r)),
      ("mouth close",masked(src,mouth))
    ]
    # A neutral-pose pixel comparison guards against the accidental static
    # duplicate and gross clipping, but artistic review is still required.
    composed=compose(layers)
    # Reject opaque geometric gaps through the highlighted hair on both sides.
    for x,y in [(110,570),(180,650),(60,780),(940,630),(925,730)]:
        if composed.getpixel((x,y))[3]<210:
            raise RuntimeError("Visible hair cutout at (%d,%d)"%(x,y))

    face_roi=(368,250,738,665)
    original=np.asarray(src.crop(face_roi).convert("RGB"),dtype=np.float32)
    neutral=np.asarray(composed.crop(face_roi).convert("RGBA"),dtype=np.float32)
    visible=neutral[:,:,3]>245
    if visible.mean()<.86:
        raise RuntimeError("Facial coverage has holes: "+str(visible.mean()))
    mae=float(np.abs(original[visible]-neutral[:,:,:3][visible]).mean())
    if mae>13:
        raise RuntimeError("Neutral face deviates from approved art: MAE %.2f"%mae)
    folder=Path(args.parts_dir);folder.mkdir(parents=True,exist_ok=True)
    for i,(name,part) in enumerate(layers):
        part.save(folder/("%02d_%s.png"%(i,name.replace(" ","_"))))
    preview=folder/"neutral-preview.png"
    composed.save(preview)
    (folder/"manifest.json").write_text(json.dumps({
        "name":"AKSARA cohesive raster rig v0.6",
        "source":"locked cinematic fantasy woman artwork",
        "parts":[x[0] for x in layers],
        "part_count":len(layers),"atlas":4096,
        "static_full_portrait_drawable":False,
        "independent_duplicate_eyelid":False,
        "independent_duplicate_lip":False,
        "feature_layered":True,"neutral_face_mae":round(mae,2),
        "manual_rig_review_required":True
    },indent=2),encoding="utf8")
    draft_path=Path(__file__).with_name("build-aksara-live2d-psd.py")
    spec=importlib.util.spec_from_file_location("aksara_psd",draft_path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.WIDTH=W;module.HEIGHT=H
    output=Path(args.output)
    module.save_psd(output,src,layers)
    print(json.dumps({"psd":str(output),"size":output.stat().st_size,
        "layers":len(layers),"neutral_face_mae":round(mae,2),
        "notes":"Conservative raster test rig, not manual Cubism-quality rig."}))
if __name__=="__main__":main()
