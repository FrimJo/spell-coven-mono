import { Router, type Request, type Response } from 'express';

const router = Router();

// IMPORTANT: specific routes before wildcard routes
// GET /api/cards/search?q=...
router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing query parameter "q"' });
  }

  try {
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(200).json({ success: true, data: [] });
      }
      return res.status(response.status).json({ success: false, error: 'Scryfall error' });
    }

    const json = (await response.json()) as { data?: unknown[] };
    return res.status(200).json({ success: true, data: json.data ?? [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/cards/:name — wildcard, must come after /search
router.get('/:name', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Missing card name' });
  }
  try {
    const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      return res.status(response.status).json({ success: false, error: 'Scryfall error' });
    }

    const json = await response.json();
    return res.status(200).json({ success: true, data: json });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
