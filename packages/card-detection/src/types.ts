export interface CardMatch {
  name: string;
  scryfallId: string;
  confidence: number;
}

export interface CardMetadata {
  name: string;
  scryfallId: string;
  set: string;
}

export interface CardIndexVersion {
  version: string;
  format: string;
  count: number;
  builtAt: string;
}
