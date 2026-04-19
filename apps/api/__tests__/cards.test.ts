import express from 'express';
import request from 'supertest';
import cardsRouter from '../src/routes/cards';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cards', cardsRouter);
  return app;
}

describe('GET /api/cards/search', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 with cards when query is valid', async () => {
    ((global as any).fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ name: 'Lightning Bolt' }] }),
    });

    const res = await request(buildApp()).get('/api/cards/search?q=lightning');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('Lightning Bolt');
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(buildApp()).get('/api/cards/search');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/cards/:name', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 with card when found', async () => {
    ((global as any).fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Lightning Bolt', mana_cost: '{R}' }),
    });

    const res = await request(buildApp()).get('/api/cards/Lightning%20Bolt');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Lightning Bolt');
  });

  it('returns 404 when card not found', async () => {
    ((global as any).fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 404, details: 'Not found' }),
    });

    const res = await request(buildApp()).get('/api/cards/NotARealCard');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
