import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { identifyCard } from '@repo/card-detection';

const router = Router();

// 5 MB cap on the decoded image bytes — protects the encoder from oversized
// uploads. Larger payloads return 413.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// POST /api/detect
// Body: { image: string (base64-encoded image bytes) }
router.post('/', async (req: Request, res: Response) => {
  const { image } = req.body ?? {};

  if (!image || typeof image !== 'string') {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid "image" (base64 string) in body' });
  }

  try {
    const buf = Buffer.from(image, 'base64');

    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({
        success: false,
        error: `Image exceeds maximum size of ${MAX_IMAGE_BYTES} bytes`,
      });
    }

    // Resize to fit within 512px on the longer side (preserving aspect ratio)
    // before handing off to the encoder, which performs the final 224x224 CLIP
    // resize internally. ensureAlpha + raw produces an RGBA buffer matching
    // the ImageData shape the encoder expects.
    const { data, info } = await sharp(buf)
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageData = {
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      width: info.width,
      height: info.height,
      colorSpace: 'srgb' as const,
    };

    const matches = await identifyCard(imageData as unknown as ImageData);
    return res.status(200).json({ success: true, data: matches });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
