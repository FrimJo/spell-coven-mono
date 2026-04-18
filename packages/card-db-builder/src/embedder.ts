import { pipeline, RawImage } from '@xenova/transformers';
import sharp from 'sharp';

let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getExtractor() {
  if (!extractor) {
    console.log('Loading CLIP model (first run downloads ~350 MB)...');
    extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
  }
  return extractor;
}

function normalise(vec: Float32Array): Float32Array {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return mag === 0 ? vec : vec.map(v => v / mag);
}

const IMAGE_HEADERS = {
  'User-Agent': 'spell-casters-mtg/0.1 (https://github.com/tonylam07/spell-casters-mtg)',
};

export async function embedImageUrl(imageUrl: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(imageUrl, { headers: IMAGE_HEADERS });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();

    // Resize to 224×224 and convert to raw RGB (3 channels — what RawImage expects for CLIP)
    const { data, info } = await sharp(Buffer.from(arrayBuffer))
      .resize(224, 224)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rawImage = new RawImage(new Uint8Array(data), info.width, info.height, 3);

    const extract = await getExtractor();
    const output = await (extract as any)(rawImage);
    return normalise(new Float32Array(output.data));
  } catch (err) {
    if (process.env.DEBUG_EMBED) {
      console.error('  embed error:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}
