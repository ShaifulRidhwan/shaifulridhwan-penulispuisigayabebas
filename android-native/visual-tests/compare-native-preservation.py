"""Compare unmodified static native captures; never resize, crop or retouch."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

root = Path('docs/android-rebuild/visual-comparison')
baseline = Path('android-native/baseline-evidence')
rows = []
for width in (360, 390, 393, 412):
    for screen in ('welcome', 'connection', 'portal', 'thinking', 'attachments', 'streaming', 'chat'):
        name = f'{width}-{screen}.png'
        matches = list(baseline.glob(f'**/android/{name}'))
        if len(matches) != 1:
            raise SystemExit(f'Expected one native baseline image: {name}, got {len(matches)}')
        current = root / 'android' / name
        with Image.open(matches[0]) as image:
            a = np.asarray(image.convert('RGB'), dtype=np.int16)
        with Image.open(current) as image:
            b = np.asarray(image.convert('RGB'), dtype=np.int16)
        if a.shape != b.shape:
            raise SystemExit(f'Native capture dimensions changed: {name}')
        delta = np.abs(a-b)
        # One 8-bit channel step allows rounding noise, not moved geometry,
        # altered artwork, reduced blur, resampling or changed typography.
        row = {'image': name, 'maxChannelDelta': int(delta.max()),
               'meanChannelDelta': float(delta.mean()), 'exactPixelFraction': float(np.all(delta == 0, axis=2).mean()),
               'pass': bool(delta.max() <= 1)}
        rows.append(row)
        print(json.dumps(row))
(root / 'native-preservation.json').write_text(json.dumps(rows, indent=2))
if not all(row['pass'] for row in rows):
    raise SystemExit('Native preservation comparison failed; inspect evidence before merging.')
