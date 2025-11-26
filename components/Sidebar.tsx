import React, { useState, useRef, useEffect } from 'react';
import { AppSection, ChatSession } from '../types';
import { SECTIONS } from '../constants';
import { Flower, X, Trash2, MessageSquarePlus, MessageSquare, ChevronRight, MoreVertical, Pin, Pencil, FileType } from 'lucide-react';

interface SidebarProps {
  currentSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onPinSession: (sessionId: string) => void;
  onExportSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
}

interface SessionItemProps { 
  session: ChatSession; 
  isActive: boolean; 
  onLoad: () => void; 
  onDelete: (e: React.MouseEvent) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string) => void;
  onExport: (id: string) => void;
  isMobile: boolean;
}

const SessionItem: React.FC<SessionItemProps> = ({ 
  session, 
  isActive, 
  onLoad, 
  onDelete, 
  onRename, 
  onPin,
  onExport, 
  isMobile 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  const handleSaveRename = () => {
    if (editTitle.trim()) {
      onRename(session.id, editTitle.trim());
    } else {
      setEditTitle(session.title); // Revert if empty
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename();
    if (e.key === 'Escape') {
      setEditTitle(session.title);
      setIsRenaming(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={() => {
           if (!isRenaming) {
             onLoad();
             if (isMobile) { /* toggle logic passed from parent ideally */ }
           }
        }}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all
          ${isActive
            ? 'bg-white dark:bg-stone-800 shadow-soft dark:shadow-none border border-stone-200/60 dark:border-stone-700 text-stone-800 dark:text-stone-100'
            : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100/50 dark:hover:bg-stone-800/50 hover:text-stone-700 dark:hover:text-stone-300'}
        `}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-sakura-500' : session.isPinned ? 'bg-amber-400' : 'bg-stone-300 dark:bg-stone-600'}`}></div>
          <div className="flex flex-col min-w-0 flex-1">
            {isRenaming ? (
              <input 
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-bold bg-white dark:bg-stone-900 border border-sakura-300 rounded px-1.5 py-0.5 outline-none text-stone-800 dark:text-stone-100 w-full"
              />
            ) : (
              <div className="flex items-center gap-2">
                 <span className="text-sm font-bold truncate block font-mixed leading-tight">{session.title}</span>
                 {session.isPinned && <Pin size={10} className="text-amber-500 fill-amber-500 rotate-45 shrink-0" />}
              </div>
            )}
            <span className="text-[10px] opacity-60 font-medium mt-0.5">{new Date(session.lastModified).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div 
          className="relative"
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1.5 rounded-lg hover:bg-stone-200/80 dark:hover:bg-stone-700 transition-colors ${isMenuOpen || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <MoreVertical size={14} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-100 dark:border-stone-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <button onClick={() => { onPin(session.id); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2">
                 <Pin size={14} className={session.isPinned ? "fill-stone-600 dark:fill-stone-300" : ""} /> {session.isPinned ? "Unpin" : "Pin Chat"}
              </button>
              <button onClick={() => { setIsRenaming(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2">
                 <Pencil size={14} /> Rename
              </button>
              <button onClick={() => { onExport(session.id); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2">
                 <FileType size={14} /> Export PDF
              </button>
              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1"></div>
              <button onClick={(e) => { onDelete(e); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                 <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ 
  currentSection, 
  onSectionChange, 
  isOpen, 
  toggleSidebar, 
  sessions,
  currentSessionId,
  onNewChat,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  onExportSession,
  onClearAllSessions
}) => {
  const pinnedSessions = sessions.filter(s => s.isPinned);
  const recentSessions = sessions.filter(s => !s.isPinned);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-30 md:hidden" 
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-80 bg-white md:bg-stone-50/50 dark:bg-stone-900 md:dark:bg-stone-950/50
        transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        flex flex-col h-full border-r border-stone-200/50 dark:border-stone-800 md:border-none
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-stone-800 dark:text-stone-100 font-display font-bold text-2xl">
            <div className="bg-sakura-500 text-white p-2 rounded-xl shadow-glow">
               <Flower className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <span>Nihongo WPS</span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden text-stone-400 hover:text-stone-600 p-2 bg-stone-100 dark:bg-stone-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="px-3 space-y-1.5 mt-2">
          {SECTIONS.map((section) => {
            const isActive = currentSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => {
                  onSectionChange(section.id);
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group
                  text-left relative overflow-hidden
                  ${isActive 
                    ? 'bg-stone-800 dark:bg-stone-800 text-white shadow-lg shadow-stone-200 dark:shadow-black/50' 
                    : 'text-stone-500 dark:text-stone-400 hover:bg-white dark:hover:bg-stone-900 hover:shadow-sm hover:text-stone-800 dark:hover:text-stone-200'}
                `}
              >
                <div className={`
                  relative z-10 p-1.5 rounded-lg transition-colors
                  ${isActive ? 'text-sakura-300' : 'text-stone-400 group-hover:text-sakura-500 bg-stone-50 dark:bg-stone-800 group-hover:bg-sakura-50 dark:group-hover:bg-stone-800'}
                `}>
                   <section.icon size={20} strokeWidth={2} />
                </div>
                <div className="flex flex-col relative z-10">
                  <span className={`font-bold text-sm font-display leading-none mb-1 ${isActive ? 'text-white' : 'text-stone-700 dark:text-stone-300'}`}>{section.label}</span>
                  <span className={`text-[10px] leading-tight ${isActive ? 'text-stone-400' : 'text-stone-400'} hidden lg:block`}>{section.description}</span>
                </div>
                
                {isActive && <ChevronRight className="ml-auto text-stone-500" size={16} />}
              </button>
            );
          })}
        </nav>

        {/* History Section */}
        <div className="flex-1 overflow-y-auto mt-6 px-3 pb-4 scrollbar-hide">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-400 dark:text-stone-600 uppercase tracking-wider">History</span>
              {sessions.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearAllSessions();
                  }}
                  className="p-1 text-stone-400 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                  title="Clear All Chats"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <button 
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) toggleSidebar();
              }}
              className="px-2 py-1 text-sakura-600 dark:text-sakura-400 hover:bg-sakura-50 dark:hover:bg-sakura-900/20 rounded-lg transition-colors flex items-center gap-1.5 group"
              title="New Chat"
            >
              <div className="bg-sakura-100 dark:bg-sakura-900/30 p-0.5 rounded group-hover:bg-sakura-200 dark:group-hover:bg-sakura-800 transition-colors">
                <MessageSquarePlus size={14} />
              </div>
              <span className="text-[10px] font-bold uppercase">New</span>
            </button>
          </div>
          
          <div className="space-y-1">
            {sessions.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 text-stone-300 dark:text-stone-700 border-2 border-dashed border-stone-200/50 dark:border-stone-800 rounded-xl mx-2">
                 <MessageSquare size={20} className="mb-2 opacity-50" />
                 <span className="text-xs font-medium">No history yet</span>
               </div>
            ) : (
              <>
                {/* Pinned Sessions */}
                {pinnedSessions.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <span className="text-[9px] font-bold text-stone-300 dark:text-stone-600 uppercase tracking-wider px-3 mb-1 block">Pinned</span>
                    {pinnedSessions.map(session => (
                      <SessionItem 
                        key={session.id} 
                        session={session} 
                        isActive={currentSessionId === session.id}
                        onLoad={() => { onLoadSession(session.id); if(window.innerWidth < 768) toggleSidebar(); }}
                        onDelete={(e) => onDeleteSession(session.id, e)}
                        onRename={onRenameSession}
                        onPin={onPinSession}
                        onExport={onExportSession}
                        isMobile={window.innerWidth < 768}
                      />
                    ))}
                  </div>
                )}

                {/* Recent Sessions */}
                {recentSessions.length > 0 && (
                  <div className="space-y-1">
                    {pinnedSessions.length > 0 && <span className="text-[9px] font-bold text-stone-300 dark:text-stone-600 uppercase tracking-wider px-3 mb-1 block">Recent</span>}
                    {recentSessions.map(session => (
                      <SessionItem 
                        key={session.id} 
                        session={session} 
                        isActive={currentSessionId === session.id}
                        onLoad={() => { onLoadSession(session.id); if(window.innerWidth < 768) toggleSidebar(); }}
                        onDelete={(e) => onDeleteSession(session.id, e)}
                        onRename={onRenameSession}
                        onPin={onPinSession}
                        onExport={onExportSession}
                        isMobile={window.innerWidth < 768}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5">
          <div className="text-[10px] text-stone-300 dark:text-stone-700 text-center font-medium font-display tracking-wide">
             Made with ❤️ for Myanmar
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;