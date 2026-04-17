import { pipeline } from '@xenova/transformers';

let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getExtractor() {
    if (!extractor) {
        extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
    }
    return extractor;
}

function normalise(vec: Float32Array): Float32Array {
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vec;
    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) out[i] = vec[i]! / magnitude;
    return out;
}

export async function encodeImage(imageData: ImageData): Promise<Float32Array> {
    const extract = await getExtractor();
    const output = await (extract as any)(imageData);
    return normalise(new Float32Array(output.data));
}
