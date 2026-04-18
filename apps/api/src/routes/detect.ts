import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { identifyCard } from '@repo/card-detection';

const router = Router();

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

    const { data, info } = await sharp(buf)
      .resize(224, 224, { fit: 'fill' })
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
