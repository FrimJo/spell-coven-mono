import { pipeline, RawImage } from '@huggingface/transformers';

// v3's pipeline return type is a huge discriminated union; using `any` here
// avoids "TS2590: Expression produces a union type that is too complex" in
// downstream typechecks. We narrow at the call site with the `extract as any`
// cast in encodeImage.
let extractor: any = null;

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

// transformers v3 expects RawImage rather than a browser ImageData. The CLIP
// builder uses 3-channel RGB (alpha stripped via sharp); to mirror that, we
// drop the alpha channel from the incoming RGBA ImageData before constructing
// the RawImage. The CLIP processor handles the final 224×224 resize internally.
function imageDataToRawImage(imageData: ImageData): RawImage {
    const { data, width, height } = imageData;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgb[j] = data[i]!;
        rgb[j + 1] = data[i + 1]!;
        rgb[j + 2] = data[i + 2]!;
    }
    return new RawImage(rgb, width, height, 3);
}

export async function encodeImage(imageData: ImageData): Promise<Float32Array> {
    const extract = await getExtractor();
    const rawImage = imageDataToRawImage(imageData);
    const output = await (extract as any)(rawImage);
    return normalise(new Float32Array(output.data));
}
