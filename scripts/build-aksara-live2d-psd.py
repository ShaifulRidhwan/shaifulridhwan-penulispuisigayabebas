#!/usr/bin/env python3
"""Generate layered Photoshop PSD draft from the *approved* Aksara artwork.

It does not invent a Cubism .moc3 rig. Manual repair of occluded geometry and
open-mouth parts is mandatory before considering this art production ready.
"""
import argparse
import json
import struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 768, 1024

def xy(x,y):
    return (round(x*WIDTH/1086),round(y*HEIGHT/1448))

def mask_poly(points,blur=5):
    image=Image.new("L",(WIDTH,HEIGHT))
    ImageDraw.Draw(image).polygon([xy(x,y) for x,y in points],fill=255)
    return image.filter(ImageFilter.GaussianBlur(blur))

def mask_ellipse(rect,blur=3):
    image=Image.new("L",(WIDTH,HEIGHT))
    ImageDraw.Draw(image).ellipse((xy(rect[0],rect[1]),xy(rect[2],rect[3])),fill=255)
    return image.filter(ImageFilter.GaussianBlur(blur))

def layer(source,mask):
    image=source.copy();image.putalpha(mask)
    return image

def rle(data):
    result=bytearray();i=0
    while i<len(data):
        count=1
        while i+count<len(data) and data[i]==data[i+count] and count<128:count+=1
        if count>=3:
            result.extend((257-count,data[i]));i+=count;continue
        start=i;i+=1
        while i<len(data) and i-start<128:
            count=1
            while i+count<len(data) and data[i]==data[i+count] and count<128:count+=1
            if count>=3:break
            i+=1
        result.append(i-start-1);result.extend(data[start:i])
    return bytes(result)

def psd_channel(image,channel):
    # 8-bit per channel, PackBits compression (PSD compression=1).
    rows=[]
    for y in range(image.height):
        rows.append(rle(image.crop((0,y,image.width,y+1)).getchannel(channel).tobytes()))
    return struct.pack(">H",1)+b"".join(struct.pack(">H",len(row)) for row in rows)+b"".join(rows)

def psd_part(name,image):
    bbox=image.getchannel("A").getbbox() or (0,0,1,1)
    img=image.crop(bbox).convert("RGBA")
    channels=[]
    for index,number in enumerate((0,1,2,-1)):
        data=psd_channel(img,index)
        channels.append((number,data))
    n=name.encode("utf8")[:240]
    pascal=bytes((len(n),))+n
    pascal+=bytes((-len(pascal))%4)
    utf=name.encode("utf-16be")
    unicode_name=b"8BIMluni"+struct.pack(">II",4+len(utf),len(name))+utf
    if (4+len(utf))%2:unicode_name+=b"\0"
    extra=struct.pack(">II",0,0)+pascal+unicode_name
    left,top,right,bottom=bbox
    record=struct.pack(">iiiiH",top,left,bottom,right,len(channels))
    for number,data in channels:record+=struct.pack(">hI",number,len(data))
    record+=b"8BIMnorm"+bytes((255,0,0,0))+struct.pack(">I",len(extra))+extra
    return record,b"".join(data for _,data in channels)

def save_psd(dst,preview,parts):
    header=b"8BPS"+struct.pack(">H",1)+bytes(6)+struct.pack(">HIIHH",4,HEIGHT,WIDTH,8,3)
    records=[];channels=[]
    for name,image in reversed(parts):
        record,data=psd_part(name,image)
        records.append(record);channels.append(data)
    body=struct.pack(">h",len(parts))+b"".join(records)+b"".join(channels)
    if len(body)%2:body+=b"\0"
    layers=struct.pack(">I",len(body))+body+struct.pack(">I",0)
    from_bytes=preview.convert("RGBA").tobytes()
    # PSD merged composite stored as planar RGBA channels.
    planes=bytes(from_bytes[i] for i in range(0,len(from_bytes),4))
    for c in (1,2,3):planes+=bytes(from_bytes[i] for i in range(c,len(from_bytes),4))
    payload=header+struct.pack(">II",0,0)+struct.pack(">I",len(layers))+layers+struct.pack(">H",0)+planes
    dst.parent.mkdir(parents=True,exist_ok=True)
    dst.write_bytes(payload)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",default="bilik-antara-avatar-2d-art.webp")
    parser.add_argument("--output",default="build/live2d/aksara-celestial-layered-draft.psd")
    parser.add_argument("--layers-dir",default="build/live2d/parts")
    args=parser.parse_args()
    source=Image.open(args.source).convert("RGB").resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS)
    f=mask_poly([(465,181),(595,188),(683,252),(733,362),(744,468),(716,566),(673,629),(617,688),(547,707),(478,700),(409,663),(367,601),(348,497),(352,371),(398,261)],8)
    # Region behind moved face is approximated by dark hair, not hand-drawn
    # occlusion. This is a draft only and must be inspected by an artist.
    backdrop=Image.composite(Image.new("RGB",(WIDTH,HEIGHT),(25,25,40)),source,f).convert("RGBA")
    holes=[mask_ellipse(box,8) for box in [(356,364,508,463),(573,362,724,465),(384,343,499,390),(578,339,695,391),(468,555,616,628)]]
    skin=source
    for hole in holes:
        smooth=skin.filter(ImageFilter.GaussianBlur(22))
        skin=Image.composite(smooth,skin,hole)
    parts=[
      ("background",backdrop),
      ("back hair",layer(source,mask_poly([(12,382),(160,200),(237,190),(237,775),(348,1110),(224,1448),(0,1448)],8))),
      ("topwear",layer(source,mask_poly([(350,650),(734,649),(884,847),(1086,1448),(0,1448),(176,827)],8))),
      ("face",layer(skin,f)),
      ("eyewhite-r",layer(source,mask_ellipse((573,362,724,465),5))),
      ("eyewhite-l",layer(source,mask_ellipse((356,364,508,463),5))),
      ("irides-r",layer(source,mask_ellipse((612,390,672,451),2))),
      ("irides-l",layer(source,mask_ellipse((416,391,471,449),2))),
      ("eyebrow-r",layer(source,mask_ellipse((578,339,695,391),5))),
      ("eyebrow-l",layer(source,mask_ellipse((384,343,499,390),5))),
      ("mouth close",layer(source,mask_ellipse((468,555,616,628),5))),
      ("front hair 1",layer(source,mask_poly([(171,160),(251,72),(413,26),(537,58),(459,133),(388,230),(349,356),(327,475),(304,625),(272,731),(234,836),(196,734),(228,524),(255,321),(216,265)],7))),
      ("front hair 2",layer(source,mask_poly([(557,53),(728,67),(884,182),(929,388),(861,630),(815,844),(756,741),(739,608),(722,423),(674,328),(639,229),(580,172)],7))),
      ("headwear sun",layer(source,mask_ellipse((181,96,455,349),7))),
      ("headwear moon",layer(source,mask_ellipse((683,91,901,354),7))),
    ]
    path=Path(args.output)
    save_psd(path,source,parts)
    folder=Path(args.layers_dir);folder.mkdir(parents=True,exist_ok=True)
    for index,(name,image) in enumerate(parts):image.save(folder/("%02d_%s.png"%(index,name.replace(" ","_"))))
    (folder/"manifest.json").write_text(json.dumps({"size":[WIDTH,HEIGHT],"layers":[name for name,_ in parts],"quality":"draft-from-flattened-art","rig_complete":False},indent=2),encoding="utf8")
    print(json.dumps({"output":str(path),"bytes":path.stat().st_size,"layers":len(parts),"rig_ready":False}))
if __name__=="__main__":main()
