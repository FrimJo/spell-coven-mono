import { identifyCard } from '../src/index';
import * as encoder from '../src/encoder';
import * as loader from '../src/loader';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));
jest.mock('../src/encoder');
jest.mock('../src/loader');

const mockEncodeImage = encoder.encodeImage as jest.MockedFunction<typeof encoder.encodeImage>;
const mockGetIndex = loader.getIndex as jest.MockedFunction<typeof loader.getIndex>;

describe('identifyCard', () => {
  beforeEach(() => {
    mockEncodeImage.mockResolvedValue(new Float32Array([1, 0, 0, 0]));
    mockGetIndex.mockResolvedValue({
      embeddings: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
      ]),
      metadata: [
        { name: 'Lightning Bolt', scryfallId: 'abc-123', set: 'lea' },
        { name: 'Counterspell', scryfallId: 'def-456', set: 'lea' },
      ],
      dims: 4,
    });
  });

  it('returns top matches sorted by confidence', async () => {
    const fakeImageData = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(64),
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData;

    const results = await identifyCard(fakeImageData);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Lightning Bolt');
    expect(results[0].scryfallId).toBe('abc-123');
    expect(results[0].confidence).toBeCloseTo(1.0, 5);
    expect(results[1].name).toBe('Counterspell');
    expect(results[1].confidence).toBeCloseTo(0, 5);
  });

  it('clamps negative similarity to 0 in confidence', async () => {
    mockEncodeImage.mockResolvedValue(new Float32Array([-1, 0, 0, 0]));

    const fakeImageData = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(64),
      colorSpace: 'srgb' as PredefinedColorSpace,
    } as ImageData;

    const results = await identifyCard(fakeImageData);
    results.forEach(r => expect(r.confidence).toBeGreaterThanOrEqual(0));
  });
});
