import { topK } from '../src/search';

describe('topK', () => {
  it('returns k results sorted by descending similarity', () => {
    const stored = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
    ]);
    const query = new Float32Array([1, 0, 0, 0]);
    const dims = 4;

    const results = topK(query, stored, dims, 2);

    expect(results[0]!.index).toBe(0);
    expect(results[0]!.similarity).toBeCloseTo(1.0, 5);
    expect(results[1]!.index).toBe(1);
    expect(results.length).toBe(2);
  });

  it('clamps k to number of stored vectors', () => {
    const stored = new Float32Array([1, 0, 0, 1, 0, 0]);
    const query = new Float32Array([1, 0, 0]);
    const results = topK(query, stored, 3, 10);
    expect(results.length).toBe(2);
  });

  it('returns results sorted by descending similarity even for partial overlap', () => {
    const sqrt2 = Math.SQRT1_2;
    const stored = new Float32Array([
      sqrt2, sqrt2, 0, 0,
      1, 0, 0, 0,
      0, 0, 1, 0,
    ]);
    const query = new Float32Array([1, 0, 0, 0]);
    const dims = 4;

    const results = topK(query, stored, dims, 3);

    expect(results[0]!.index).toBe(1);
    expect(results[0]!.similarity).toBeCloseTo(1.0, 5);
    expect(results[1]!.index).toBe(0);
    expect(results[1]!.similarity).toBeCloseTo(sqrt2, 5);
    expect(results[2]!.index).toBe(2);
    expect(results[2]!.similarity).toBeCloseTo(0, 5);
  });
});
