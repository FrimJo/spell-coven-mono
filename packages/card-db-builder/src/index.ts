import { fetchLegalCards, SUPPORTED_FORMATS } from './scryfall';
import { buildIndex } from './builder';

function parseFormat(): string {
  const arg = process.argv.find(a => a.startsWith('--format='))?.split('=')[1] ?? 'standard';
  if (!(SUPPORTED_FORMATS as readonly string[]).includes(arg)) {
    throw new Error(
      `Invalid --format=${arg}. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    );
  }
  return arg;
}

async function main() {
  const format = parseFormat();
  console.log(`Fetching ${format}-legal cards from Scryfall...`);
  const cards = await fetchLegalCards(format);
  console.log(`Found ${cards.length} cards. Building embeddings...`);
  await buildIndex(cards, format);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
