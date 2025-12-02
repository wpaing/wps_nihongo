import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, VocabularyItem } from '../types';
import { calculateReview, getDueCards, saveFlashcards, getDeckStats, DeckStats, parseCSVImports, createFlashcard, getNextInterval } from '../utils/srsUtils';
import { BrainCircuit, Trophy, Volume2, Download, List, Check, Search, Undo2, Info, X, Edit, PlayCircle, Trash2, Tag, Upload, Plus, Filter, Mic } from 'lucide-react';
import { exportVocabToAnki } from '../utils/exportUtils';
import PronunciationModal from './PronunciationModal';

interface FlashcardReviewProps {
  allCards: Flashcard[];
  setAllCards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
  onReviewComplete?: () => void;
}

type ViewMode = 'dashboard' | 'review' | 'browser';

const FlashcardReview: React.FC<FlashcardReviewProps> = ({ allCards, setAllCards, onReviewComplete }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, review: 0, total: 0 });
  
  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null); // If null, we are adding new
  const [pronunciationCard, setPronunciationCard] = useState<Flashcard | null>(null);

  // Review State
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [history, setHistory] = useState<{ index: number; card: Flashcard }[]>([]);
  
  // Browser State
  const [searchQuery, setSearchQuery] = useState('');

  // Derived: Available Tags
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    allCards.forEach(card => card.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allCards]);

  useEffect(() => {
    // Filter due cards based on tag if active
    const filteredAll = activeTag 
      ? allCards.filter(c => c.tags?.includes(activeTag))
      : allCards;

    const due = getDueCards(filteredAll);
    setDueCards(due);
    setStats(getDeckStats(filteredAll));
  }, [allCards, activeTag]);

  // --- LOGIC: CARD MANAGEMENT ---

  const handleSaveCard = (cardData: VocabularyItem & { tags: string[] }) => {
    if (editingCard) {
      // Update existing
      const updatedAllCards = allCards.map(c => c.id === editingCard.id ? { ...c, ...cardData } : c);
      setAllCards(updatedAllCards);
      saveFlashcards(updatedAllCards);
    } else {
      // Create new
      const newCard = createFlashcard(cardData, cardData.tags);
      const updatedAllCards = [...allCards, newCard];
      setAllCards(updatedAllCards);
      saveFlashcards(updatedAllCards);
    }
    setIsEditModalOpen(false);
    setEditingCard(null);
  };

  const handleDeleteCard = (id: string) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      const updatedAllCards = allCards.filter(c => c.id !== id);
      setAllCards(updatedAllCards);
      saveFlashcards(updatedAllCards);
      if (viewMode === 'review') {
         // If deleting during review, handle index shift
         if (currentCardIndex >= dueCards.length - 1) {
            setSessionComplete(true);
         }
      }
    }
  };

  const handleBulkImport = (csvText: string) => {
    const newCards = parseCSVImports(csvText);
    if (newCards.length > 0) {
      const updatedAllCards = [...allCards, ...newCards];
      setAllCards(updatedAllCards);
      saveFlashcards(updatedAllCards);
      alert(`Successfully imported ${newCards.length} cards.`);
      setIsImportModalOpen(false);
    } else {
      alert("No valid cards found. Please check format: Kanji, Kana, Romaji, Meaning, Tags");
    }
  };

  // --- LOGIC: REVIEW ---

  const handleStartSession = () => {
    if (dueCards.length > 0) {
      setViewMode('review');
      setSessionComplete(false);
      setCurrentCardIndex(0);
      setHistory([]);
      setIsFlipped(false);
    }
  };

  const handleRating = (rating: number) => {
    const currentCard = dueCards[currentCardIndex];
    if (!currentCard) return;
    
    setHistory(prev => [...prev, { index: currentCardIndex, card: { ...currentCard } }]);
    
    const updatedCard = calculateReview(currentCard, rating);
    // Update in main list
    const updatedAllCards = allCards.map(c => c.id === currentCard.id ? updatedCard : c);
    
    setAllCards(updatedAllCards);
    saveFlashcards(updatedAllCards);
    
    if (onReviewComplete) onReviewComplete();
    
    if (currentCardIndex < dueCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setSessionComplete(true);
    }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    const updatedAllCards = allCards.map(c => c.id === lastAction.card.id ? lastAction.card : c);
    setAllCards(updatedAllCards);
    saveFlashcards(updatedAllCards);
    setCurrentCardIndex(lastAction.index);
    setSessionComplete(false);
    setIsFlipped(false);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleSpeak = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  };

  const openPronunciationModal = (e: React.MouseEvent, card: Flashcard) => {
    e.stopPropagation();
    setPronunciationCard(card);
    setIsPronunciationModalOpen(true);
  };

  // Helper for button labels
  const formatInterval = (days: number) => {
      if (days <= 1) return '< 1d';
      return `${days}d`;
  }

  // --- RENDERERS ---

  if (viewMode === 'dashboard') {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 font-display flex items-center gap-3">
            <BrainCircuit className="text-stone-800 dark:text-stone-100" />
            Decks
          </h2>
          <div className="flex gap-2">
            <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-bold text-stone-600 dark:text-stone-300 hover:border-sakura-400 dark:hover:border-sakura-600 transition-colors shadow-sm"
              >
                <Upload size={16} /> Import
            </button>
            <button 
              onClick={() => exportVocabToAnki(allCards)} 
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-bold text-stone-600 dark:text-stone-300 hover:border-sakura-400 dark:hover:border-sakura-600 transition-colors shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* Deck Card */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-soft dark:shadow-none overflow-hidden">
          <div className="bg-stone-800 dark:bg-stone-900 p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Nihongo Vocabulary</h3>
              <p className="text-stone-400 text-sm">Spaced Repetition System</p>
            </div>
            <div className="flex gap-3">
               {availableTags.length > 0 && (
                 <div className="relative group">
                    <select 
                      value={activeTag || ''} 
                      onChange={(e) => setActiveTag(e.target.value || null)}
                      className="appearance-none pl-9 pr-8 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm font-medium transition-colors outline-none cursor-pointer text-stone-200"
                    >
                      <option value="">All Tags</option>
                      {availableTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                 </div>
               )}
               <button 
                 onClick={() => setViewMode('browser')}
                 className="p-2 bg-stone-700 hover:bg-stone-600 rounded-lg transition-colors"
                 title="Browse Cards"
               >
                 <List size={20} />
               </button>
            </div>
          </div>
          
          <div className="p-8 flex flex-col items-center">
             
             {/* Stats Grid */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex flex-col items-center border border-blue-100 dark:border-blue-800">
                  <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.new}</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-1">New</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex flex-col items-center border border-red-100 dark:border-red-800">
                  <span className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.learning}</span>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mt-1">Learning</span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl flex flex-col items-center border border-green-100 dark:border-green-800">
                  <span className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.review}</span>
                  <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mt-1">Due</span>
                </div>
                <div className="bg-stone-100 dark:bg-stone-700/50 p-4 rounded-xl flex flex-col items-center border border-stone-200 dark:border-stone-600">
                  <span className="text-3xl font-bold text-stone-600 dark:text-stone-300">{stats.total}</span>
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mt-1">Total</span>
                </div>
             </div>

             {dueCards.length > 0 ? (
               <button 
                 onClick={handleStartSession}
                 className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all transform hover:scale-105 flex items-center gap-3"
               >
                 <PlayCircle size={24} fill="currentColor" className="text-blue-800 dark:text-blue-200" />
                 Study Now
               </button>
             ) : (
               <div className="text-center py-4">
                 <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mx-auto mb-4">
                   <Check size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2">All caught up!</h3>
                 <p className="text-stone-500 dark:text-stone-400">You have no cards due for review.</p>
               </div>
             )}
          </div>
        </div>

        {/* CSV Import Modal */}
        {isImportModalOpen && (
          <ImportModal 
            onClose={() => setIsImportModalOpen(false)} 
            onImport={handleBulkImport} 
          />
        )}
      </div>
    );
  }

  if (viewMode === 'browser') {
    const filteredCards = allCards.filter(c => 
      c.kanji.includes(searchQuery) || 
      c.meanings.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.kana && c.kana.includes(searchQuery)) ||
      (c.tags && c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    return (
      <div className="flex flex-col h-full p-4 md:p-6 animate-in slide-in-from-bottom-4">
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={() => setViewMode('dashboard')} className="p-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-stone-600 dark:text-stone-300 border border-transparent hover:border-stone-200 dark:hover:border-stone-700 transition-colors"><Undo2 size={20} /></button>
            <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Browser</h2>
          </div>
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search cards by kanji, meaning, or tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 text-stone-800 dark:text-stone-100 shadow-sm"
            />
          </div>
          <button 
            onClick={() => { setEditingCard(null); setIsEditModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sakura-600 hover:bg-sakura-500 text-white rounded-xl font-bold shadow-md shadow-sakura-900/20 transition-all shrink-0"
          >
            <Plus size={18} /> Add Card
          </button>
        </div>

        <div className="flex-1 bg-white dark:bg-stone-800 rounded-2xl shadow-soft dark:shadow-none border border-stone-200 dark:border-stone-700 overflow-hidden flex flex-col">
           <div className="overflow-y-auto flex-1">
             <table className="w-full text-left text-sm text-stone-700 dark:text-stone-300">
               <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                 <tr>
                   <th className="px-6 py-4 border-b border-stone-200 dark:border-stone-700">Kanji</th>
                   <th className="px-6 py-4 border-b border-stone-200 dark:border-stone-700 hidden sm:table-cell">Kana</th>
                   <th className="px-6 py-4 border-b border-stone-200 dark:border-stone-700">Meaning</th>
                   <th className="px-6 py-4 border-b border-stone-200 dark:border-stone-700 hidden md:table-cell">Tags</th>
                   <th className="px-6 py-4 border-b border-stone-200 dark:border-stone-700 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                 {filteredCards.map(card => (
                   <tr key={card.id} className="hover:bg-stone-50 dark:hover:bg-stone-700/50 group transition-colors">
                     <td className="px-6 py-4 font-jp font-bold text-lg text-stone-800 dark:text-stone-100 align-top">{card.kanji}</td>
                     <td className="px-6 py-4 font-jp text-stone-600 dark:text-stone-300 hidden sm:table-cell align-top">{card.kana || '-'}</td>
                     <td className="px-6 py-4 font-mm text-stone-700 dark:text-stone-300 align-top">
                       <span className="line-clamp-2">{card.meanings}</span>
                     </td>
                     <td className="px-6 py-4 hidden md:table-cell align-top">
                       <div className="flex flex-wrap gap-1">
                         {card.tags?.map((tag, i) => (
                           <span key={i} className="px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 text-xs rounded-full border border-stone-200 dark:border-stone-600">
                             {tag}
                           </span>
                         ))}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-right align-top">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditingCard(card); setIsEditModalOpen(true); }} className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit size={16} /></button>
                         <button onClick={() => handleDeleteCard(card.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16} /></button>
                       </div>
                     </td>
                   </tr>
                 ))}
                 {filteredCards.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-12 text-center text-stone-400">No cards found matching "{searchQuery}"</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>

        {/* Add/Edit Modal */}
        {isEditModalOpen && (
          <EditCardModal 
             card={editingCard} 
             onSave={handleSaveCard} 
             onClose={() => { setIsEditModalOpen(false); setEditingCard(null); }} 
          />
        )}
      </div>
    );
  }

  // --- VIEW MODE: REVIEW (STUDY) ---
  const currentCard = dueCards[currentCardIndex];

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in">
        <div className="bg-stone-800 dark:bg-stone-700 p-8 rounded-full mb-8 shadow-xl text-white">
            <Trophy size={48} />
        </div>
        <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-4 font-display">Session Finished</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8">You have reviewed all due cards.</p>
        <button onClick={() => setViewMode('dashboard')} className="px-8 py-3 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 font-bold rounded-xl transition-colors">
          Return to Deck
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-100 dark:bg-stone-900">
      {/* Study Header */}
      <div className="h-14 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between px-6">
         <div className="flex items-center gap-4">
             <span className="text-stone-400 font-bold text-xs uppercase tracking-widest">
                {stats.new > 0 ? <span className="text-blue-500">{stats.new}</span> : null}
                {stats.learning > 0 ? <span className="text-red-500 ml-2">{stats.learning}</span> : null}
                {stats.review > 0 ? <span className="text-green-500 ml-2">{stats.review}</span> : null}
             </span>
         </div>
         <div className="flex gap-2">
           {currentCard && (
             <button onClick={() => { setEditingCard(currentCard); setIsEditModalOpen(true); }} className="text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700" title="Edit current card">
                <Edit size={16} />
             </button>
           )}
           <button onClick={() => setViewMode('dashboard')} className="text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 text-sm font-bold">Exit</button>
         </div>
      </div>

      {/* Study Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
         <div className="w-full max-w-2xl flex flex-col items-center">
            <div 
              onClick={() => !isFlipped && setIsFlipped(true)}
              className="w-full bg-white dark:bg-stone-800 rounded-[2.5rem] shadow-2xl shadow-stone-200/60 dark:shadow-black/50 min-h-[450px] flex flex-col items-center justify-center p-8 md:p-12 text-center cursor-pointer relative overflow-hidden transition-all duration-300 hover:shadow-3xl border border-white dark:border-stone-700"
            >
                <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                    {/* Front Content */}
                    <div className="flex flex-col items-center gap-6 mb-8 w-full">
                       <h2 className="text-5xl md:text-7xl font-bold text-stone-800 dark:text-stone-100 font-jp leading-tight break-words max-w-full">
                         {currentCard?.kanji || <span className="text-stone-200 text-4xl">???</span>}
                       </h2>
                       
                       <button 
                         onClick={(e) => { e.stopPropagation(); currentCard && handleSpeak(currentCard.kanji, e); }} 
                         className="p-3 text-stone-300 hover:text-sakura-500 dark:text-stone-600 dark:hover:text-sakura-400 rounded-full transition-all hover:bg-sakura-50 dark:hover:bg-stone-700"
                         title="Listen"
                       >
                         <Volume2 size={32} />
                       </button>
                    </div>

                    {/* Divider & Back Content */}
                    {isFlipped && (
                      <div className="w-full pt-8 border-t border-stone-100 dark:border-stone-700 animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-2">
                         <div className="text-2xl md:text-3xl text-sakura-500 font-jp font-bold mb-2">
                            {currentCard?.kana || currentCard?.romaji || <span className="opacity-50 text-sm">No Reading</span>}
                         </div>
                         <div className="text-lg md:text-xl text-stone-500 dark:text-stone-400 font-mm leading-relaxed max-w-lg mx-auto">
                            {currentCard?.meanings || <span className="opacity-50 text-sm">No Meaning</span>}
                         </div>
                         {currentCard?.tags && currentCard.tags.length > 0 && (
                            <div className="flex justify-center gap-2 mt-4">
                                {currentCard.tags.map((tag, i) => (
                                    <span key={i} className="text-xs px-2 py-1 bg-stone-100 dark:bg-stone-700 rounded-full text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                        <Tag size={10} /> {tag}
                                    </span>
                                ))}
                            </div>
                         )}
                         {/* Pronunciation Practice Button */}
                         <div className="mt-6 flex justify-center">
                            <button
                              onClick={(e) => currentCard && openPronunciationModal(e, currentCard)}
                              className="flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-sakura-100 dark:hover:bg-sakura-900/30 hover:text-sakura-600 transition-colors text-sm font-bold shadow-sm"
                            >
                              <Mic size={16} /> Practice Pronunciation
                            </button>
                         </div>
                      </div>
                    )}
                </div>

                {!isFlipped && (
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                        <span className="text-stone-300 dark:text-stone-600 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Tap to Reveal</span>
                    </div>
                )}
            </div>

            {/* Answer Buttons */}
            {isFlipped && currentCard && (
              <div className="grid grid-cols-4 gap-3 mt-8 w-full animate-in slide-in-from-bottom-4">
                  <button onClick={() => handleRating(1)} className="flex flex-col items-center justify-center py-4 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 rounded-2xl text-stone-800 dark:text-stone-200 font-bold text-sm transition-colors group shadow-sm">
                      <span>Again</span>
                      <span className="text-[10px] font-normal opacity-50 group-hover:opacity-100">{formatInterval(getNextInterval(currentCard, 1))}</span>
                  </button>
                  <button onClick={() => handleRating(3)} className="flex flex-col items-center justify-center py-4 bg-stone-800 dark:bg-stone-700 hover:bg-stone-700 dark:hover:bg-stone-600 rounded-2xl text-stone-100 font-bold text-sm transition-colors shadow-lg shadow-stone-800/20">
                      <span>Hard</span>
                      <span className="text-[10px] font-normal opacity-50 text-stone-400">{formatInterval(getNextInterval(currentCard, 3))}</span>
                  </button>
                  <button onClick={() => handleRating(4)} className="flex flex-col items-center justify-center py-4 bg-stone-800 dark:bg-stone-700 hover:bg-stone-700 dark:hover:bg-stone-600 rounded-2xl text-stone-100 font-bold text-sm transition-colors shadow-lg shadow-stone-800/20">
                      <span>Good</span>
                      <span className="text-[10px] font-normal opacity-50 text-stone-400">{formatInterval(getNextInterval(currentCard, 4))}</span>
                  </button>
                  <button onClick={() => handleRating(5)} className="flex flex-col items-center justify-center py-4 bg-white dark:bg-stone-800 border-2 border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-stone-200/50 dark:shadow-none">
                      <span>Easy</span>
                      <span className="text-[10px] font-normal opacity-50">{formatInterval(getNextInterval(currentCard, 5))}</span>
                  </button>
              </div>
            )}
         </div>
      </div>
      
      <div className="h-12 flex items-center justify-center text-stone-300 dark:text-stone-600 text-xs">
        {history.length > 0 && <button onClick={handleBack} className="hover:text-stone-500 dark:hover:text-stone-400 flex items-center gap-1"><Undo2 size={12} /> Undo</button>}
      </div>

      {isEditModalOpen && editingCard && (
        <EditCardModal 
             card={editingCard} 
             onSave={(data) => {
                 const updated = allCards.map(c => c.id === editingCard.id ? { ...c, ...data } : c);
                 setAllCards(updated);
                 saveFlashcards(updated);
                 setEditingCard(null); // Just close for review mode, we updated state directly
                 setIsEditModalOpen(false);
             }} 
             onClose={() => { setIsEditModalOpen(false); setEditingCard(null); }} 
        />
      )}

      {isPronunciationModalOpen && pronunciationCard && (
        <PronunciationModal 
          card={pronunciationCard} 
          onClose={() => { setIsPronunciationModalOpen(false); setPronunciationCard(null); }} 
        />
      )}
    </div>
  );
};

// --- Sub Components ---

const ImportModal: React.FC<{ onClose: () => void, onImport: (text: string) => void }> = ({ onClose, onImport }) => {
  const [text, setText] = useState('');
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white dark:bg-stone-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-stone-100 dark:border-stone-700 flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-900">
             <h3 className="font-bold text-lg text-stone-800 dark:text-stone-100">Import Flashcards</h3>
             <button onClick={onClose} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg"><X size={20} className="text-stone-500" /></button>
          </div>
          <div className="p-6 flex flex-col gap-4 overflow-y-auto">
             <p className="text-sm text-stone-500 dark:text-stone-400">
               Paste CSV data or upload a file. <br/>
               Format: <code>Kanji, Kana, Romaji, Meaning, Tags</code>
             </p>
             <input type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm text-stone-500 dark:text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sakura-50 file:text-sakura-700 hover:file:bg-sakura-100" />
             <textarea 
               value={text} 
               onChange={(e) => setText(e.target.value)} 
               placeholder="食べる, たべる, taberu, To eat, verb;n5"
               className="w-full h-40 p-4 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-200"
             />
          </div>
          <div className="p-4 border-t border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-stone-500 dark:text-stone-400 font-bold hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition-colors">Cancel</button>
             <button onClick={() => onImport(text)} disabled={!text.trim()} className="px-6 py-2 bg-sakura-600 hover:bg-sakura-500 text-white font-bold rounded-xl shadow-lg shadow-sakura-900/20 disabled:opacity-50 transition-colors">Import</button>
          </div>
       </div>
    </div>
  );
};

const EditCardModal: React.FC<{ card: Flashcard | null, onSave: (data: VocabularyItem & { tags: string[] }) => void, onClose: () => void }> = ({ card, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    kanji: card?.kanji || '',
    kana: card?.kana || '',
    romaji: card?.romaji || '',
    meanings: card?.meanings || '',
    tags: card?.tags ? card.tags.join(', ') : ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.split(/[,\s]+/).filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in">
       <div className="bg-white dark:bg-stone-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-100 dark:border-stone-700 flex flex-col">
          <div className="p-5 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-900">
             <h3 className="font-bold text-lg text-stone-800 dark:text-stone-100">{card ? 'Edit Card' : 'New Card'}</h3>
             <button onClick={onClose} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg"><X size={20} className="text-stone-500" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
             <div>
               <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Kanji</label>
               <input autoFocus required value={formData.kanji} onChange={e => setFormData({...formData, kanji: e.target.value})} className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-100 font-jp text-lg" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Kana</label>
                  <input value={formData.kana} onChange={e => setFormData({...formData, kana: e.target.value})} className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-100 font-jp" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Romaji</label>
                  <input value={formData.romaji} onChange={e => setFormData({...formData, romaji: e.target.value})} className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-100" />
                </div>
             </div>
             <div>
               <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Meaning</label>
               <textarea required rows={3} value={formData.meanings} onChange={e => setFormData({...formData, meanings: e.target.value})} className="w-full p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-100 font-mm resize-none" />
             </div>
             <div>
               <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">Tags (comma separated)</label>
               <div className="relative">
                  <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="noun, n5, food" className="w-full pl-10 pr-3 py-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400 dark:text-stone-100 text-sm" />
               </div>
             </div>
             
             <div className="flex justify-end gap-3 mt-4">
               <button type="button" onClick={onClose} className="px-5 py-2.5 text-stone-500 dark:text-stone-400 font-bold hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors">Cancel</button>
               <button type="submit" className="px-8 py-2.5 bg-sakura-600 hover:bg-sakura-500 text-white font-bold rounded-xl shadow-lg shadow-sakura-900/20 transition-colors">Save</button>
             </div>
          </form>
       </div>
    </div>
  );
};

export default FlashcardReview;