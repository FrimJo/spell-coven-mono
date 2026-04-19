import { encodeImage } from '../src/encoder';

jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    jest.fn().mockResolvedValue({ data: new Float32Array(512).fill(0.1) })
  ),
  RawImage: class {
    constructor(
      public data: Uint8Array,
      public width: number,
      public height: number,
      public channels: number,
    ) {}
  },
}));

describe('encodeImage', () => {
  it('returns a 512-dim Float32Array', async () => {
    const fakeImageData = {
      data: new Uint8ClampedArray(4 * 4 * 4),
      width: 4,
      height: 4,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData;

    const result = await encodeImage(fakeImageData);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(512);
  });

  it('normalises the output vector to unit length', async () => {
    const fakeImageData = {
      data: new Uint8ClampedArray(4 * 4 * 4),
      width: 4,
      height: 4,
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData;

    const result = await encodeImage(fakeImageData);
    const magnitude = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));

    expect(magnitude).toBeCloseTo(1.0, 4);
  });
});
