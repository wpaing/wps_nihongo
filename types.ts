
export enum AppSection {
  READING = 'reading',
  FLASHCARDS = 'flashcards',
}

export interface VocabularyItem {
  kanji: string;
  kana?: string; // Hiragana or Katakana reading
  romaji: string;
  meanings: string;
}

export interface Flashcard extends VocabularyItem {
  id: string;
  interval: number; // days
  repetition: number;
  ef: number; // ease factor, default 2.5
  nextReview: number; // timestamp
}

export interface WebSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // Base64 string
  hasAttachment?: boolean; // Flag to indicate if an image was present but stripped for storage
  vocabulary?: VocabularyItem[];
  sources?: WebSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastModified: number;
  messages: Message[];
  preview: string; // Short text preview
  isPinned?: boolean;
}

export interface UserSettings {
  apiKey: string | null;
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv', // For Google Sheets import
  TXT = 'txt', // For Docs import
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

// --- Gamification Types ---

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  unlockedAt?: number;
}

export interface UserProgress {
  currentStreak: number;
  lastActiveDate: string; // ISO Date string YYYY-MM-DD
  cardsReviewed: number;
  messagesSent: number;
  flashcardsAdded: number;
  unlockedAchievements: string[]; // IDs of unlocked achievements
}
