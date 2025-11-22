
import { Flashcard, VocabularyItem } from "../types";

// SuperMemo 2 Algorithm simplified
export const calculateReview = (card: Flashcard, quality: number): Flashcard => {
  // quality: 0 (Complete blackout) - 5 (Perfect)
  // Anki Buttons Mapping: 
  // Again (1) -> quality < 3 (reset)
  // Hard (2) -> quality 3
  // Good (3) -> quality 4
  // Easy (4) -> quality 5

  let { repetition, interval, ef } = card;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    repetition += 1;
  } else {
    repetition = 0;
    interval = 1;
  }

  // EF calculation
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...card,
    repetition,
    interval,
    ef,
    nextReview,
  };
};

export const createFlashcard = (vocab: VocabularyItem): Flashcard => {
  return {
    ...vocab,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    interval: 0,
    repetition: 0,
    ef: 2.5,
    nextReview: Date.now(), // Due immediately
  };
};

// Local Storage Keys
const STORAGE_KEY = "nihongo_sensei_flashcards";

export const loadFlashcards = (): Flashcard[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load flashcards", e);
    return [];
  }
};

export const saveFlashcards = (cards: Flashcard[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error("Failed to save flashcards", e);
  }
};

export const getDueCards = (cards: Flashcard[]): Flashcard[] => {
  const now = Date.now();
  return cards.filter(card => card.nextReview <= now);
};

export interface DeckStats {
  new: number;
  learning: number;
  review: number;
  total: number;
}

export const getDeckStats = (cards: Flashcard[]): DeckStats => {
  const now = Date.now();
  let stats = { new: 0, learning: 0, review: 0, total: cards.length };

  cards.forEach(card => {
    if (card.repetition === 0) {
      stats.new++;
    } else if (card.repetition < 3) {
      // Young cards (Learning)
      if (card.nextReview <= now) stats.learning++;
    } else {
      // Mature cards (Review)
      if (card.nextReview <= now) stats.review++;
    }
  });

  // Normalize: "Learning" in this context basically means due items that aren't "New" or "Mature"
  // For simplicity in this app:
  // New: Never studied (repetition 0)
  // Review: Due (nextReview <= now) AND studied at least once
  
  const newCards = cards.filter(c => c.repetition === 0);
  const reviewCards = cards.filter(c => c.repetition > 0 && c.nextReview <= now);
  
  return {
    new: newCards.length,
    learning: 0, // Simplified for this UI
    review: reviewCards.length,
    total: cards.length
  };
};
