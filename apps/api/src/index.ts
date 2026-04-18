import express from 'express';
import cors from 'cors';
import cardsRouter from './routes/cards.js';
import detectRouter from './routes/detect.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/cards', cardsRouter);
app.use('/api/detect', detectRouter);

const PORT = Number(process.env.PORT ?? 4001);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

export default app;
