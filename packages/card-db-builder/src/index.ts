// Bun emulates web globals (self, document, etc.). transformers.js detects
// "browser" via `typeof self !== 'undefined'` and tries OffscreenCanvas
// instead of sharp. Delete these before any transformers import to force
// the Node code path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (globalThis as any).self;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (globalThis as any).document;

import { fetchStandardCards } from './scryfall';
import { buildIndex } from './builder';

async function main() {
  console.log('Fetching Standard-legal cards from Scryfall...');
  const cards = await fetchStandardCards();
  console.log(`Found ${cards.length} cards. Building embeddings...`);
  await buildIndex(cards);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
