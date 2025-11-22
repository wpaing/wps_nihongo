
import React, { useState, useEffect, useRef } from 'react';
import { AppSection, Message, VocabularyItem, Flashcard, ChatSession } from './types';
import { SECTIONS, APP_NAME } from './constants';
import { generateResponse } from './services/gemini';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import FlashcardReview from './components/FlashcardReview';
import { exportToPDF, exportToCSV, exportToTXT } from './utils/exportUtils';
import { createFlashcard, loadFlashcards, saveFlashcards } from './utils/srsUtils';
import { Menu, Download, FileText, Sheet, FileType, Minus, Plus, Type, Undo2 } from 'lucide-react';

const SESSIONS_STORAGE_KEY = 'nihongo_sensei_sessions';

const App: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<AppSection>(AppSection.READING);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState(1);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  
  // Undo State
  const [deletedSession, setDeletedSession] = useState<ChatSession | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Flashcards
  useEffect(() => { setFlashcards(loadFlashcards()); }, []);
  
  // Chat History: Load Sessions
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (storedSessions) {
        const parsed = JSON.parse(storedSessions);
        // Sort: Pinned first, then Newest date
        const sorted = parsed.sort((a: ChatSession, b: ChatSession) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastModified - a.lastModified;
        });
        setSessions(sorted);
      }
    } catch (e) { console.error(e); }
  }, []);

  // Chat History: Save Sessions
  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    else localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([]));
  }, [sessions]);

  // Sync Messages to Current Session
  useEffect(() => {
    if (messages.length === 0 && !currentSessionId) return;
    
    setSessions(prevSessions => {
      // If we have an active session, update it
      if (currentSessionId) {
        const updated = prevSessions.map(session => {
          if (session.id === currentSessionId) {
            let title = session.title;
            // Set title based on first message if it's the default "New Chat"
            if (title === 'New Chat' && messages.length > 0) {
               const firstUserMsg = messages.find(m => m.role === 'user');
               if (firstUserMsg) title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
            }
            
            return {
              ...session,
              messages: messages.map(msg => ({ ...msg, image: undefined, hasAttachment: !!msg.image })),
              lastModified: Date.now(),
              title: title,
              preview: messages[messages.length - 1]?.text.slice(0, 50) || session.preview
            };
          }
          return session;
        });
        
        // If current ID not found (race condition), do nothing until next sync
        if (!updated.find(s => s.id === currentSessionId)) return updated;

        // Re-sort: Pinned first, then Newest
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastModified - a.lastModified;
        });
      }
      return prevSessions;
    });
  }, [messages, currentSessionId]);

  const handleNewChat = () => { setMessages([]); setCurrentSessionId(null); setCurrentSection(AppSection.READING); setIsSidebarOpen(false); };
  
  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) { 
        setMessages(session.messages); 
        setCurrentSessionId(sessionId); 
        setCurrentSection(AppSection.READING); 
        setIsSidebarOpen(false); 
    }
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
  };

  const handlePinSession = (sessionId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s);
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.lastModified - a.lastModified;
      });
    });
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    if (!sessionToDelete) return;

    // 1. Save to temporary state for Undo
    setDeletedSession(sessionToDelete);
    
    // 2. Remove from list immediately
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) handleNewChat();

    // 3. Clear undo capability after 5 seconds
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setDeletedSession(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (deletedSession) {
      setSessions(prev => {
        const restored = [...prev, deletedSession];
        return restored.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastModified - a.lastModified;
        });
      });
      setDeletedSession(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    }
  };

  const handleExportSessionPDF = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      await exportToPDF(session.messages);
    }
  };

  const handleAddFlashcard = (vocab: VocabularyItem) => {
    const updatedCards = [...flashcards, createFlashcard(vocab)];
    setFlashcards(updatedCards);
    saveFlashcards(updatedCards);
  };

  const currentSectionInfo = SECTIONS.find(s => s.id === currentSection);
  const handleFontSizeChange = (delta: number) => setFontSizeLevel(prev => Math.max(0, Math.min(3, prev + delta)));

  const handleSendMessage = async (text: string, image?: string) => {
    const timestamp = Date.now();
    const newUserMsg: Message = { id: timestamp.toString(), role: 'user', text, timestamp, image };
    
    let activeSessionId = currentSessionId;
    
    // If no active session, create one immediately
    if (!activeSessionId) {
      const newSessionId = timestamp.toString();
      activeSessionId = newSessionId;
      setCurrentSessionId(newSessionId);
      setSessions(prev => [{ 
          id: newSessionId, 
          title: text.slice(0, 30) + '...', 
          lastModified: timestamp, 
          messages: [newUserMsg], 
          preview: text.slice(0, 50),
          isPinned: false
      }, ...prev]);
    }

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const { text: rawResponse, sources } = await generateResponse(text, image, currentSection);
      
      let cleanText = rawResponse;
      let extractedVocab: VocabularyItem[] = [];
      
      const jsonMatch = rawResponse.match(/\{[\s\S]*"vocabulary"[\s\S]*\}[\s]*$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.vocabulary && Array.isArray(parsed.vocabulary)) { 
              extractedVocab = parsed.vocabulary; 
              cleanText = rawResponse.replace(jsonMatch[0], '').trim(); 
          }
        } catch (e) { console.warn(e); }
      }
      
      setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'model', 
          text: cleanText, 
          timestamp: Date.now(), 
          vocabulary: extractedVocab, 
          sources 
      }]);
    } catch (error) { 
        setMessages(prev => [...prev, { 
            id: (Date.now() + 1).toString(), 
            role: 'model', 
            text: `**Error:** Unable to get response. Please try again.`, 
            timestamp: Date.now() 
        }]); 
    } finally { 
        setIsLoading(false); 
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden text-stone-800 font-sans antialiased bg-stone-50">
      
      {/* Undo Delete Toast */}
      {deletedSession && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in">
           <span>Chat deleted</span>
           <button onClick={handleUndoDelete} className="text-sakura-400 font-bold hover:text-sakura-300 flex items-center gap-1">
             <Undo2 size={16} /> Undo
           </button>
        </div>
      )}

      <Sidebar 
        currentSection={currentSection} 
        onSectionChange={(s) => { setCurrentSection(s); setIsSidebarOpen(false); }} 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        sessions={sessions} 
        currentSessionId={currentSessionId} 
        onNewChat={handleNewChat} 
        onLoadSession={handleLoadSession} 
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onPinSession={handlePinSession}
        onExportSession={handleExportSessionPDF}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative bg-stone-50/50 h-[100dvh]">
        {/* Glass Header */}
        <header className="h-16 md:h-20 absolute top-0 left-0 right-0 z-20 px-4 md:px-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-stone-100/50 transition-all">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-stone-500 hover:bg-stone-100 rounded-xl active:scale-95 transition-transform"><Menu size={24} /></button>
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 font-display tracking-tight truncate">
               <span className="text-stone-800 truncate">{APP_NAME}</span>
               <span className="hidden sm:inline text-stone-300 font-light">/</span>
               <span className="hidden sm:inline text-sakura-500 truncate">{currentSectionInfo?.label}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {currentSection === AppSection.READING && (
              <div className="hidden sm:flex items-center bg-stone-100/80 rounded-xl p-1 border border-stone-200/50">
                <button onClick={() => handleFontSizeChange(-1)} disabled={fontSizeLevel === 0} className="p-2 text-stone-500 hover:bg-white rounded-lg transition-all disabled:opacity-30"><Minus size={14} /></button>
                <div className="w-8 flex justify-center"><Type size={16} className="text-stone-400" /></div>
                <button onClick={() => handleFontSizeChange(1)} disabled={fontSizeLevel === 3} className="p-2 text-stone-500 hover:bg-white rounded-lg transition-all disabled:opacity-30"><Plus size={14} /></button>
              </div>
            )}
            {currentSection !== AppSection.FLASHCARDS && (
              <div className="relative">
                <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:border-sakura-200 hover:text-sakura-600 shadow-sm transition-all font-bold text-xs uppercase tracking-wider">
                  <Download size={16} /><span className="hidden sm:inline">Export</span>
                </button>
                {isExportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl shadow-stone-200 border border-stone-100 z-20 p-2 animate-in fade-in slide-in-from-top-2">
                       <button onClick={() => { exportToTXT(messages); setIsExportMenuOpen(false); }} disabled={messages.length === 0} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-xl text-left transition-colors"><FileText size={18} className="text-blue-400" /><span>Text File (.txt)</span></button>
                       <button onClick={() => { exportToCSV(messages); setIsExportMenuOpen(false); }} disabled={messages.length === 0} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-xl text-left transition-colors"><Sheet size={18} className="text-green-400" /><span>Spreadsheet (.csv)</span></button>
                       <button onClick={() => { exportToPDF(messages); setIsExportMenuOpen(false); }} disabled={messages.length === 0} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-xl text-left transition-colors"><FileType size={18} className="text-red-400" /><span>Document (.pdf)</span></button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 pt-16 md:pt-20 relative flex flex-col overflow-hidden">
           {currentSection === AppSection.FLASHCARDS ? (
             <div className="flex-1 overflow-y-auto bg-stone-50"><FlashcardReview allCards={flashcards} setAllCards={setFlashcards} /></div>
           ) : (
             <>
               <ChatArea messages={messages} isLoading={isLoading} currentSection={currentSection} onAddFlashcard={handleAddFlashcard} existingFlashcards={flashcards} fontSizeLevel={fontSizeLevel} />
               <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default App;
