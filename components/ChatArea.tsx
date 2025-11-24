
import React, { useRef, useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, AppSection, VocabularyItem, Flashcard } from '../types';
import { SECTIONS } from '../constants';
import { Bot, User, Plus, Check, FileText, Sheet, FileType, Copy, Image as ImageIcon, Globe, ExternalLink, Sparkles } from 'lucide-react';
import { exportVocabToPDF, exportVocabToCSV, exportVocabToTXT } from '../utils/exportUtils';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  currentSection: AppSection;
  onAddFlashcard: (vocab: VocabularyItem) => void;
  existingFlashcards: Flashcard[];
  fontSizeLevel: number; // 0: sm, 1: base, 2: lg, 3: xl
}

const getTextFromChildren = (children: React.ReactNode): string => {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return children.toString();
  if (Array.isArray(children)) return children.map(getTextFromChildren).join('');
  if (React.isValidElement(children)) return getTextFromChildren((children.props as any).children);
  return '';
};

const CopyButton = ({ text, alwaysVisible = false }: { text: string, alwaysVisible?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center backdrop-blur-sm
        ${copied 
          ? 'bg-green-100 text-green-600 opacity-100' 
          : `hover:bg-stone-100/80 hover:text-stone-700 ${alwaysVisible ? 'text-stone-400 bg-white/50 opacity-100' : 'text-stone-400 opacity-0 group-hover:opacity-100'}`}
      `}
      title="Copy text"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  isLoading, 
  currentSection, 
  onAddFlashcard,
  existingFlashcards,
  fontSizeLevel
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sectionInfo = SECTIONS.find(s => s.id === currentSection);

  const isVocabSaved = (vocab: VocabularyItem) => {
    return existingFlashcards.some(
      card => card.kanji === vocab.kanji && card.meanings === vocab.meanings
    );
  };

  const getFontSizeClasses = () => {
    switch (fontSizeLevel) {
      case 0: return { container: 'text-sm', prose: 'prose-sm' };
      case 1: return { container: 'text-base', prose: 'prose-base' };
      case 2: return { container: 'text-lg', prose: 'prose-lg' };
      case 3: return { container: 'text-xl', prose: 'prose-xl' };
      default: return { container: 'text-base', prose: 'prose-base' };
    }
  };

  const { container: textClass } = getFontSizeClasses();

  const markdownComponents = useMemo(() => ({
    h3: ({ children }: any) => {
       return (
         <div className="flex items-center gap-3 mt-8 mb-4">
           <div className="h-px flex-1 bg-stone-200"></div>
           <h3 className="text-sm font-bold text-stone-600 font-display bg-stone-50 px-4 py-1.5 rounded-full border border-stone-200/60 uppercase tracking-wider shadow-sm">
             {children}
           </h3>
           <div className="h-px flex-1 bg-stone-200"></div>
         </div>
       );
    },
    ul: ({ children }: any) => (
      <ul className="space-y-3 my-4 pl-1">{children}</ul>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-3 text-stone-700 font-mm leading-loose relative group pl-2 border-l-2 border-stone-100 hover:border-sakura-300 transition-colors py-1">
         <div className="w-1.5 h-1.5 rounded-full bg-sakura-400 mt-2.5 shrink-0 opacity-60"></div>
         <span className="flex-1">{children}</span>
         <div className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <CopyButton text={getTextFromChildren(children)} />
         </div>
      </li>
    ),
    strong: ({ children }: any) => (
      <span className="font-bold text-sakura-700 bg-sakura-50 px-1.5 py-0.5 rounded-md mx-0.5 font-jp border border-sakura-100/50">{children}</span>
    ),
    p: ({ children }: any) => {
      const text = getTextFromChildren(children).trim();
      if (!text) return <p>{children}</p>;

      const isJPLine = text.startsWith('JP:') || text.startsWith('JP：');
      const isMMLine = text.startsWith('MM:') || text.startsWith('MM：');

      if (isJPLine) {
        const cleanText = text.replace(/^(JP:|JP：)\s*/, '');
        return (
          <div className="group relative my-5 bg-white rounded-xl p-6 shadow-soft border-l-4 border-sakura-500">
            <p className="font-jp text-xl leading-[1.9] text-stone-800 font-medium tracking-wide">{children}</p>
            <div className="absolute top-4 right-4">
              <CopyButton text={cleanText} alwaysVisible />
            </div>
          </div>
        );
      } else if (isMMLine) {
         const cleanText = text.replace(/^(MM:|MM：)\s*/, '');
         return (
           <div className="group relative mb-8 pl-6">
             <p className="font-mm text-lg leading-loose text-stone-600 italic border-l-2 border-stone-200 pl-5 py-1">{children}</p>
             <div className="absolute top-0 right-0">
                <CopyButton text={cleanText} alwaysVisible />
             </div>
           </div>
         );
      }

      return (
        <div className="group relative">
          <p className="mb-4 font-mm leading-loose text-stone-700">{children}</p>
          <div className="absolute right-0 top-0">
             <CopyButton text={text} />
          </div>
        </div>
      );
    },
  }), []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
      <div className="max-w-4xl mx-auto space-y-8 pb-36 md:pb-40">
        
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-700 mt-8">
             <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-sakura-200 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className={`relative p-6 md:p-8 rounded-[2.5rem] bg-white shadow-soft border border-stone-100 transform transition-transform duration-500 group-hover:scale-105`}>
                   {sectionInfo ? <sectionInfo.icon size={48} className="text-sakura-500 md:w-16 md:h-16" strokeWidth={1.5} /> : <Sparkles size={64} className="text-sakura-500" strokeWidth={1.5} />}
                </div>
             </div>
             
             <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-4 font-display tracking-tight">မင်္ဂလာပါ <span className="text-sakura-500">Mingalaba</span></h2>
             
             <p className="max-w-lg text-base md:text-lg font-mixed text-stone-500 leading-relaxed mb-10 px-4">
               {currentSection === AppSection.READING 
                 ? "Upload images, documents, or ask questions directly. I will explain Japanese grammar in Myanmar context."
                 : "Start your learning journey today."}
             </p>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md px-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
                   <div className="bg-stone-50 p-2.5 rounded-xl"><ImageIcon size={20} className="text-stone-500" /></div>
                   <span className="text-sm font-bold text-stone-600">Image Analysis</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
                   <div className="bg-stone-50 p-2.5 rounded-xl"><FileText size={20} className="text-stone-500" /></div>
                   <span className="text-sm font-bold text-stone-600">Grammar Explanations</span>
                </div>
             </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border
              ${msg.role === 'user' 
                ? 'bg-stone-800 border-stone-800 text-white' 
                : 'bg-white border-stone-200 text-sakura-500'}
            `}>
              {msg.role === 'user' ? <User size={18} strokeWidth={2.5} /> : <Bot size={20} strokeWidth={2.5} />}
            </div>

            <div className={`
              flex flex-col max-w-[88%] md:max-w-[80%]
              ${msg.role === 'user' ? 'items-end' : 'items-start'}
            `}>
              {/* Image Rendering: Support both legacy 'image' and new 'images' array */}
              {(msg.images || (msg.image ? [msg.image] : [])).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 justify-end">
                  {(msg.images || (msg.image ? [msg.image] : [])).map((imgSrc, idx) => (
                    <div key={idx} className="rounded-2xl overflow-hidden border-4 border-white shadow-soft max-w-[200px] md:max-w-xs group cursor-zoom-in relative">
                      <img src={imgSrc} alt={`Attachment ${idx + 1}`} className="w-full h-auto transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  ))}
                </div>
              )}
              
              {msg.hasAttachment && (!msg.images && !msg.image) ? (
                 <div className="mb-2 px-3 py-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 flex items-center gap-2 text-stone-400 text-xs font-medium">
                    <ImageIcon size={14} />
                    <span>Attachments (Archived)</span>
                </div>
              ) : null}
              
              <div className={`
                px-5 py-4 md:px-6 md:py-5 shadow-sm font-mixed leading-relaxed
                ${textClass}
                ${msg.role === 'user' 
                  ? 'bg-stone-800 text-white rounded-[2rem] rounded-tr-sm shadow-xl shadow-stone-200/50' 
                  : `bg-white/90 border border-stone-100/50 text-stone-800 rounded-[2rem] rounded-tl-sm shadow-soft backdrop-blur-sm w-full`}
              `}>
                <ReactMarkdown components={markdownComponents}>
                  {msg.text}
                </ReactMarkdown>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-stone-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                      <Globe size={12} />
                      <span>Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 hover:bg-blue-50 text-stone-600 hover:text-blue-600 border border-stone-200 rounded-full text-xs transition-all"
                        >
                          <span className="truncate max-w-[120px] md:max-w-[180px] font-bold">{source.title}</span>
                          <ExternalLink size={10} className="shrink-0 opacity-50" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'model' && msg.vocabulary && msg.vocabulary.length > 0 && (
                <div className="mt-6 w-full bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-soft animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="bg-stone-50/50 px-5 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-white p-1.5 rounded-lg shadow-sm border border-stone-100 text-sakura-500">
                        <FileText size={16} />
                      </div>
                      <span className="font-bold text-stone-700 font-display text-sm">Vocabulary extracted</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm border border-stone-100 self-start sm:self-auto">
                      <button 
                        onClick={() => exportVocabToPDF(msg.vocabulary!)}
                        className="p-1.5 text-stone-400 hover:text-sakura-600 hover:bg-sakura-50 rounded-md transition-colors"
                        title="PDF"
                      >
                        <FileType size={18} />
                      </button>
                      <div className="w-px h-4 bg-stone-200"></div>
                      <button 
                        onClick={() => exportVocabToCSV(msg.vocabulary!)}
                        className="p-1.5 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        title="CSV"
                      >
                        <Sheet size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[400px]">
                      <thead className="bg-white text-stone-400 font-bold text-[10px] uppercase tracking-wider border-b border-stone-100">
                        <tr>
                          <th className="px-5 py-3 font-display">Kanji</th>
                          <th className="px-5 py-3 font-display">Kana</th>
                          <th className="px-5 py-3 font-display hidden sm:table-cell">Romaji</th>
                          <th className="px-5 py-3 font-display">Meaning</th>
                          <th className="px-5 py-3 text-right">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {msg.vocabulary.map((vocab, idx) => {
                          const saved = isVocabSaved(vocab);
                          return (
                            <tr key={idx} className="hover:bg-stone-50/80 transition-colors group">
                              <td className="px-5 py-4 font-bold text-stone-800 font-jp text-base md:text-lg align-top">{vocab.kanji}</td>
                              <td className="px-5 py-4 text-stone-600 font-jp text-sm font-medium align-top pt-5">{vocab.kana || '-'}</td>
                              <td className="px-5 py-4 text-stone-500 font-mono text-xs hidden sm:table-cell align-top pt-5">{vocab.romaji}</td>
                              <td className="px-5 py-4 text-stone-700 font-mm leading-relaxed align-top pt-5">{vocab.meanings}</td>
                              <td className="px-5 py-4 text-right align-top pt-4">
                                <button
                                  onClick={() => !saved && onAddFlashcard(vocab)}
                                  disabled={saved}
                                  className={`
                                    inline-flex items-center justify-center w-9 h-9 rounded-full transition-all shadow-sm
                                    ${saved 
                                      ? 'bg-green-100 text-green-600 cursor-default' 
                                      : 'bg-white border border-stone-200 text-stone-400 hover:border-sakura-300 hover:text-sakura-500 hover:shadow-md transform hover:-translate-y-0.5'}
                                  `}
                                >
                                  {saved ? <Check size={16} /> : <Plus size={18} />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <span className="text-[10px] font-bold text-stone-300 mt-2 ml-2 block uppercase tracking-widest">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 md:gap-6">
             <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 text-sakura-500 flex items-center justify-center shadow-md">
                <Bot size={22} />
             </div>
             <div className="bg-white border border-stone-100 px-6 py-5 rounded-[2rem] rounded-tl-sm shadow-soft flex items-center gap-2">
                <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-sakura-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
