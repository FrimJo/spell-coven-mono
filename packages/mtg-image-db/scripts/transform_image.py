from PIL import Image
import numpy as np

# Input / output
in_path = "logo_1024x1024.png"
out_path = "logo_1024x1024_sitepalette.png"

# Your palette (hex -> 0..1 RGB)
def hex01(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0

c_card    = hex01("#080809")  # --card
c_sec     = hex01("#152535")  # --0c0c0e
c_surf3   = hex01("#0e0e10")  # --surface-3
c_brand   = hex01("#4a2d80")  # --brand
c_primary = hex01("#5c3d99")  # --primary
c_text    = hex01("#9a938c")  # --text-primary
c_text2   = hex01("#7a7570")  # --text-secondary

img = Image.open(in_path).convert("RGBA")
arr = np.array(img).astype(np.float32) / 255.0

rgb = arr[..., :3]
a   = arr[..., 3:4]

# Luminance (perceptual)
lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2])

# Piecewise remap luminance -> palette ramps
target = np.zeros_like(rgb)

m0 = lum < 0.12
m1 = (lum >= 0.12) & (lum < 0.28)
m2 = (lum >= 0.28) & (lum < 0.50)
m3 = (lum >= 0.50) & (lum < 0.75)
m4 = lum >= 0.75

target[m0] = c_card

t = (lum[m1] - 0.12) / (0.28 - 0.12)
target[m1] = c_card * (1 - t[..., None]) + c_sec * t[..., None]

t = (lum[m2] - 0.28) / (0.50 - 0.28)
target[m2] = c_sec * (1 - t[..., None]) + c_surf3 * t[..., None]

t = (lum[m3] - 0.50) / (0.75 - 0.50)
target[m3] = c_brand * (1 - t[..., None]) + c_primary * t[..., None]

t = (lum[m4] - 0.75) / (1.00 - 0.75)
target[m4] = c_primary * (1 - t[..., None]) + c_text * t[..., None]

# Keep already-bluish bright elements (sun/stars) closer to text/primary
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
bluish = (b > r * 1.1) & (b > g * 1.05) & (lum > 0.35)
t = np.clip((lum - 0.35) / (0.90 - 0.35), 0, 1)
adj = c_primary * (1 - t[..., None]) + c_text2 * t[..., None]
target[bluish] = adj[bluish]

# Mix in some original detail so the icon keeps its shading
mix = 0.72
out_rgb = target * mix + rgb * (1 - mix)

# Subtle cool tint
out_rgb = np.clip(out_rgb * np.array([0.95, 0.98, 1.05]), 0, 1)

out = np.concatenate([out_rgb, a], axis=-1)
Image.fromarray((out * 255).astype(np.uint8), "RGBA").save(out_path)

print("Saved:", out_path)
