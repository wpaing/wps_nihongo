
import React, { useState, useEffect, useMemo } from 'react';
import { Flashcard } from '../types';
import { calculateReview, getDueCards, saveFlashcards, getDeckStats, DeckStats } from '../utils/srsUtils';
import { RotateCcw, BrainCircuit, Trophy, Volume2, Download, Trash2, Undo2, Info, Book, Sparkles, Search, Edit, PlayCircle, LayoutGrid, List, X, Check } from 'lucide-react';
import { exportVocabToAnki } from '../utils/exportUtils';

interface FlashcardReviewProps {
  allCards: Flashcard[];
  setAllCards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
  onReviewComplete?: () => void;
}

type ViewMode = 'dashboard' | 'review' | 'browser';

const FlashcardReview: React.FC<FlashcardReviewProps> = ({ allCards, setAllCards, onReviewComplete }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<DeckStats>({ new: 0, learning: 0, review: 0, total: 0 });
  
  // Review State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [history, setHistory] = useState<{ index: number; card: Flashcard }[]>([]);
  
  // Browser State
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const due = getDueCards(allCards);
    setDueCards(due);
    setStats(getDeckStats(allCards));
  }, [allCards]);

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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  };

  // --- LOGIC: BROWSER ---

  const filteredCards = useMemo(() => {
    return allCards.filter(c => 
      c.kanji.includes(searchQuery) || 
      c.meanings.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.kana && c.kana.includes(searchQuery))
    );
  }, [allCards, searchQuery]);

  const startEditing = (card: Flashcard) => {
    setEditingId(card.id);
    setEditValue(card.meanings);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updatedAllCards = allCards.map(c => c.id === editingId ? { ...c, meanings: editValue } : c);
    setAllCards(updatedAllCards);
    saveFlashcards(updatedAllCards);
    setEditingId(null);
  };

  const deleteCard = (id: string) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      const updatedAllCards = allCards.filter(c => c.id !== id);
      setAllCards(updatedAllCards);
      saveFlashcards(updatedAllCards);
    }
  };

  // --- RENDERERS ---

  if (viewMode === 'dashboard') {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto p-6 animate-in fade-in">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-3">
            <BrainCircuit className="text-stone-800" />
            Decks
          </h2>
          <button 
            onClick={() => exportVocabToAnki(allCards)} 
            className="flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-sakura-600 transition-colors"
            title="Export compatible with Anki Import"
          >
            <Download size={18} />
            Export Package
          </button>
        </div>

        {/* Deck Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-soft overflow-hidden">
          <div className="bg-stone-800 p-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold mb-1">Nihongo Vocabulary</h3>
              <p className="text-stone-400 text-sm">{allCards.length} cards total</p>
            </div>
            <div className="flex gap-4">
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
             {dueCards.length > 0 ? (
               <>
                 <div className="flex gap-8 mb-8 w-full max-w-md justify-center">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-blue-500">{stats.new}</span>
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-1">New</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-red-500">{stats.learning}</span>
                      <span className="text-xs font-bold text-red-500 uppercase tracking-wider mt-1">Learn</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-green-500">{stats.review}</span>
                      <span className="text-xs font-bold text-green-500 uppercase tracking-wider mt-1">Due</span>
                    </div>
                 </div>
                 
                 <button 
                   onClick={handleStartSession}
                   className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all transform hover:scale-105 flex items-center gap-3"
                 >
                   <PlayCircle size={24} fill="currentColor" className="text-blue-800" />
                   Study Now
                 </button>
               </>
             ) : (
               <div className="text-center py-8">
                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                   <Check size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-stone-800 mb-2">Congratulations!</h3>
                 <p className="text-stone-500">You have finished this deck for now.</p>
               </div>
             )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-stone-50 rounded-xl p-6 border border-stone-100">
              <h4 className="font-bold text-stone-700 mb-2 flex items-center gap-2"><Info size={16} /> About SRS</h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                This app uses a Spaced Repetition System similar to Anki. 
                Items are scheduled based on how well you know them.
                Use the export button to move your progress to the Anki desktop/mobile app.
              </p>
           </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'browser') {
    return (
      <div className="flex flex-col h-full p-6 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setViewMode('dashboard')} className="p-2 hover:bg-stone-100 rounded-lg"><Undo2 size={20} /></button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search cards..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-400"
            />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-soft border border-stone-100 overflow-hidden flex flex-col">
           <div className="overflow-y-auto flex-1">
             <table className="w-full text-left text-sm">
               <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                 <tr>
                   <th className="px-6 py-3 border-b border-stone-200">Kanji</th>
                   <th className="px-6 py-3 border-b border-stone-200">Kana</th>
                   <th className="px-6 py-3 border-b border-stone-200">Meaning</th>
                   <th className="px-6 py-3 border-b border-stone-200 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-stone-100">
                 {filteredCards.map(card => (
                   <tr key={card.id} className="hover:bg-stone-50 group">
                     <td className="px-6 py-4 font-jp font-bold text-lg">{card.kanji}</td>
                     <td className="px-6 py-4 font-jp text-stone-600">{card.kana || '-'}</td>
                     <td className="px-6 py-4 font-mm text-stone-700">
                       {editingId === card.id ? (
                         <div className="flex gap-2">
                           <input 
                             value={editValue} 
                             onChange={(e) => setEditValue(e.target.value)}
                             className="flex-1 border border-sakura-300 rounded px-2 py-1"
                           />
                           <button onClick={saveEdit} className="text-green-600"><Check size={16} /></button>
                           <button onClick={() => setEditingId(null)} className="text-red-500"><X size={16} /></button>
                         </div>
                       ) : (
                         <span className="line-clamp-2">{card.meanings}</span>
                       )}
                     </td>
                     <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => startEditing(card)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                         <button onClick={() => deleteCard(card.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  }

  // --- VIEW MODE: REVIEW (STUDY) ---
  const currentCard = dueCards[currentCardIndex];

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in">
        <div className="bg-stone-800 p-8 rounded-full mb-8 shadow-xl text-white">
            <Trophy size={48} />
        </div>
        <h2 className="text-3xl font-bold text-stone-800 mb-4 font-display">Session Finished</h2>
        <p className="text-stone-500 mb-8">You have reviewed all due cards.</p>
        <button onClick={() => setViewMode('dashboard')} className="px-8 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl transition-colors">
          Return to Deck
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-100">
      {/* Study Header */}
      <div className="h-14 bg-white border-b border-stone-200 flex items-center justify-between px-6">
         <div className="flex items-center gap-4">
             <span className="text-stone-400 font-bold text-xs uppercase tracking-widest">
                {stats.new > 0 ? <span className="text-blue-500">{stats.new}</span> : null}
                {stats.learning > 0 ? <span className="text-red-500 ml-2">{stats.learning}</span> : null}
                {stats.review > 0 ? <span className="text-green-500 ml-2">{stats.review}</span> : null}
             </span>
         </div>
         <div className="flex gap-2">
           <button onClick={() => setViewMode('dashboard')} className="text-stone-400 hover:text-stone-800 text-sm font-bold">Exit</button>
         </div>
      </div>

      {/* Study Area */}
      <div className="flex-1 flex items-center justify-center p-4">
         <div className="w-full max-w-2xl">
            <div 
              onClick={() => !isFlipped && setIsFlipped(true)}
              className="bg-white rounded-3xl shadow-xl min-h-[400px] flex flex-col items-center justify-center p-10 text-center cursor-pointer relative overflow-hidden"
            >
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {/* Front Content */}
                    <div className="mb-8">
                       <h2 className="text-6xl font-bold text-stone-800 font-jp mb-4">{currentCard?.kanji}</h2>
                       <button 
                         onClick={(e) => currentCard && handleSpeak(currentCard.kanji, e)} 
                         className="mx-auto p-2 text-stone-300 hover:text-stone-600 rounded-full transition-colors"
                       >
                         <Volume2 size={24} />
                       </button>
                    </div>

                    {/* Back Content (Hidden/Revealed) */}
                    {isFlipped && (
                      <div className="w-full pt-8 border-t border-stone-100 animate-in fade-in slide-in-from-bottom-2">
                         <p className="text-2xl text-sakura-500 font-jp font-medium mb-4">{currentCard?.kana || currentCard?.romaji}</p>
                         <p className="text-xl text-stone-600 font-mm leading-relaxed">{currentCard?.meanings}</p>
                      </div>
                    )}
                </div>

                {!isFlipped && <div className="absolute bottom-6 text-stone-300 text-xs font-bold uppercase tracking-widest">Show Answer</div>}
            </div>

            {/* Answer Buttons */}
            {isFlipped && (
              <div className="grid grid-cols-4 gap-3 mt-6 animate-in slide-in-from-bottom-4">
                  <button onClick={() => handleRating(1)} className="py-3 bg-stone-200 hover:bg-stone-300 rounded-xl text-stone-700 font-bold text-sm">Again <span className="block text-[10px] font-normal opacity-60">&lt; 1m</span></button>
                  <button onClick={() => handleRating(2)} className="py-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-white font-bold text-sm">Hard <span className="block text-[10px] font-normal opacity-60">2d</span></button>
                  <button onClick={() => handleRating(4)} className="py-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-white font-bold text-sm">Good <span className="block text-[10px] font-normal opacity-60">3d</span></button>
                  <button onClick={() => handleRating(5)} className="py-3 bg-white border border-stone-200 hover:border-blue-400 text-blue-600 rounded-xl font-bold text-sm">Easy <span className="block text-[10px] font-normal opacity-60">4d</span></button>
              </div>
            )}
         </div>
      </div>
      
      <div className="h-12 flex items-center justify-center text-stone-300 text-xs">
        {history.length > 0 && <button onClick={handleBack} className="hover:text-stone-500 flex items-center gap-1"><Undo2 size={12} /> Undo</button>}
      </div>
    </div>
  );
};

export default FlashcardReview;
