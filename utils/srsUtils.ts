import { Flashcard, VocabularyItem } from "../types";

// SuperMemo 2 Algorithm simplified

// Helper to calculate next interval for UI previews without modifying card
export const getNextInterval = (card: Flashcard, quality: number): number => {
  let { repetition, interval, ef } = card;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
  } else {
    interval = 1;
  }
  return interval;
};

export const calculateReview = (card: Flashcard, quality: number): Flashcard => {
  // quality: 0 (Complete blackout) - 5 (Perfect)
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

  // EF calculation (SM-2)
  // "If the quality response was lower than 3 then start repetitions for the item from the beginning without changing the E-Factor"
  if (quality >= 3) {
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;
  }

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...card,
    repetition,
    interval,
    ef,
    nextReview,
  };
};

export const createFlashcard = (vocab: VocabularyItem, tags: string[] = []): Flashcard => {
  return {
    ...vocab,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    interval: 0,
    repetition: 0,
    ef: 2.5,
    nextReview: Date.now(), // Due immediately
    tags: tags
  };
};

export const parseCSVImports = (csvText: string): Flashcard[] => {
  const lines = csvText.split(/\r?\n/);
  const newCards: Flashcard[] = [];
  
  // Basic detection: Expects header or data
  // Formats: Kanji, Kana, Romaji, Meaning, Tags(optional)
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    // Skip likely header row if it contains "kanji" case-insensitive
    if (index === 0 && line.toLowerCase().includes('kanji')) return;

    // Handle quoted CSV values roughly
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
    
    if (parts.length >= 2) {
      const vocab: VocabularyItem = {
        kanji: parts[0] || '',
        kana: parts[1] || '',
        romaji: parts[2] || '',
        meanings: parts[3] || '',
      };
      
      const tagsString = parts[4] || '';
      const tags = tagsString ? tagsString.split(/[;|\s]+/).filter(Boolean) : [];
      
      if (vocab.kanji) {
        newCards.push(createFlashcard(vocab, tags));
      }
    }
  });
  
  return newCards;
};

// --- IndexedDB Implementation for Unlimited Storage ---

const DB_NAME = 'NihongoWPS_DB';
const STORE_NAME = 'flashcards';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check if IndexedDB is supported
    if (!('indexedDB' in window)) {
        reject(new Error("This browser doesn't support IndexedDB"));
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const LS_KEY = "nihongo_sensei_flashcards";

export const loadFlashcards = async (): Promise<Flashcard[]> => {
  // Migration Strategy: Check LocalStorage first to preserve old data
  try {
    const lsData = localStorage.getItem(LS_KEY);
    if (lsData) {
      console.log("Migrating flashcards from LocalStorage to IndexedDB...");
      const cards = JSON.parse(lsData);
      if (Array.isArray(cards) && cards.length > 0) {
          // Migrate to IDB
          await saveFlashcards(cards);
          console.log("Migration successful.");
      }
      // Clear LS to free up space and prevent re-migration
      localStorage.removeItem(LS_KEY);
      return cards;
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Load from IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IDB Load Error:", e);
    return [];
  }
};

export const saveFlashcards = async (cards: Flashcard[]) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Perform an atomic update: Clear then Put
      // This is safe within a transaction; if put fails, clear is rolled back.
      const clearReq = store.clear();
      
      clearReq.onsuccess = () => {
        if (cards.length === 0) return;
        
        // Insert all cards
        cards.forEach(card => {
             store.put(card);
        });
      };

      tx.oncomplete = () => {
        resolve();
      };
      
      tx.onerror = (event) => {
        console.error("Transaction failed", event);
        reject(tx.error);
      };
    });
  } catch (e) {
    console.error("IDB Save Error:", e);
  }
};

export const getDueCards = (cards: Flashcard[]): Flashcard[] => {
  const now = Date.now();
  return cards
    .filter(card => card.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview); // Sort by due date (oldest first)
};

export interface DeckStats {
  new: number;
  learning: number;
  review: number;
  total: number;
}

export const getDeckStats = (cards: Flashcard[]): DeckStats => {
  const now = Date.now();
  
  const newCards = cards.filter(c => c.repetition === 0);
  const reviewCards = cards.filter(c => c.repetition > 0 && c.nextReview <= now);
  
  return {
    new: newCards.length,
    learning: 0, // Simplified for this implementation
    review: reviewCards.length,
    total: cards.length
  };
};