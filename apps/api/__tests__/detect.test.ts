import express from 'express';
import request from 'supertest';

jest.mock('@repo/card-detection', () => ({
  identifyCard: jest.fn(async () => [
    { name: 'Lightning Bolt', scryfallId: 'abc-123', confidence: 0.97 },
  ]),
}));

import detectRouter from '../src/routes/detect';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/detect', detectRouter);
  return app;
}

// 1x1 white PNG
const WHITE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

describe('POST /api/detect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with matches when image is provided', async () => {
    const res = await request(buildApp())
      .post('/api/detect')
      .send({ image: WHITE_PNG_BASE64 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toEqual({
      name: 'Lightning Bolt',
      scryfallId: 'abc-123',
      confidence: 0.97,
    });
  });

  it('returns 400 when image is missing', async () => {
    const res = await request(buildApp()).post('/api/detect').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
