
import { UserProgress, Achievement } from "../types";

// --- Constants ---

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_step', title: 'First Step', description: 'Send your first message', icon: 'Footprints' },
  { id: 'scholar', title: 'Scholar', description: 'Send 20 messages', icon: 'BookOpen' },
  { id: 'collector', title: 'Collector', description: 'Add 10 flashcards', icon: 'Library' },
  { id: 'memory_master', title: 'Memory Master', description: 'Review 50 flashcards', icon: 'BrainCircuit' },
  { id: 'on_fire', title: 'On Fire', description: 'Reach a 3-day streak', icon: 'Flame' },
  { id: 'dedicated', title: 'Dedicated', description: 'Reach a 7-day streak', icon: 'Trophy' },
];

// --- Logic ---

export const checkStreak = (progress: UserProgress): { streak: number, isNewDay: boolean } => {
  const today = new Date().toISOString().split('T')[0];
  const lastActive = progress.lastActiveDate;

  if (lastActive === today) {
    return { streak: progress.currentStreak, isNewDay: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastActive === yesterdayStr) {
    // Continue streak
    return { streak: progress.currentStreak + 1, isNewDay: true };
  } else {
    // Broken streak (unless it's the very first day)
    return { streak: 1, isNewDay: true };
  }
};

export const checkNewAchievements = (progress: UserProgress): Achievement[] => {
  const newUnlocks: Achievement[] = [];

  ACHIEVEMENTS.forEach(ach => {
    if (progress.unlockedAchievements.includes(ach.id)) return;

    let unlocked = false;
    switch (ach.id) {
      case 'first_step': unlocked = progress.messagesSent >= 1; break;
      case 'scholar': unlocked = progress.messagesSent >= 20; break;
      case 'collector': unlocked = progress.flashcardsAdded >= 10; break;
      case 'memory_master': unlocked = progress.cardsReviewed >= 50; break;
      case 'on_fire': unlocked = progress.currentStreak >= 3; break;
      case 'dedicated': unlocked = progress.currentStreak >= 7; break;
    }

    if (unlocked) {
      newUnlocks.push(ach);
    }
  });

  return newUnlocks;
};

// --- Storage ---
const STORAGE_KEY = "nihongo_sensei_progress";

export const loadProgress = (): UserProgress => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to load progress", e);
  }
  
  return {
    currentStreak: 1,
    lastActiveDate: new Date().toISOString().split('T')[0],
    cardsReviewed: 0,
    messagesSent: 0,
    flashcardsAdded: 0,
    unlockedAchievements: []
  };
};

export const saveProgress = (progress: UserProgress) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};
