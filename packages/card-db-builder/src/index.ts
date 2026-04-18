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
