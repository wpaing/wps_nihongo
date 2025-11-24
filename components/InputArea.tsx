
import React, { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, X, Crop, Maximize, MousePointer2, Trash2, Mic, MicOff, Move, Layers, Bold, Italic, FileText, Paperclip, UploadCloud, FileStack, Edit } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string, images?: string[]) => void;
  isLoading: boolean;
}

interface SelectionRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'normal' | 'bold' | 'italic';
}

interface Attachment {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'pdf';
  original?: string; // Original base64 for cropping
  selections?: SelectionRect[];
  contextInfo?: string | null;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Cropper State
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [selections, setSelections] = useState<SelectionRect[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<'create' | 'move'>('create');
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Setup Speech Recognition
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Setup Global Drag and Drop and Paste Listeners
  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragOver(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) setIsDragOver(false);
    };

    const handleWindowDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setIsDragOver(false); dragCounter = 0;
      if (e.dataTransfer?.files) processFiles(e.dataTransfer.files);
    };

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) files.push(blob);
        }
      }
      if (files.length > 0) processFiles(files);
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('paste', handleWindowPaste);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, []);

  const toggleListening = () => { isListening ? stopListening() : startListening(); };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Sorry, voice input is not supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'my-MM';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) setText(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
  };

  const processFiles = (files: FileList | File[]) => {
    setFileError(null);
    const fileArray = Array.from(files);
    
    fileArray.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setFileError(`File ${file.name} is too large. Limit is 10MB.`);
        return;
      }

      const isPdf = file.type === 'application/pdf';
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const result = reader.result as string;
        setAttachments(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(),
          file,
          preview: result, // For PDF this is base64, for Image this is base64 (which is also original)
          original: isPdf ? undefined : result, // Only keep original for images for cropping
          type: isPdf ? 'pdf' : 'image'
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || attachments.length > 0) && !isLoading && !fileError) {
      // Collect context info from attachments
      const contextNotes = attachments
        .map((a, i) => a.contextInfo ? `[Image ${i + 1} Context]:\n${a.contextInfo}` : '')
        .filter(Boolean)
        .join('\n\n');

      const finalText = contextNotes 
        ? `${text}\n\n[Formatting Instructions]:\n${contextNotes}` 
        : text;
      
      const images = attachments.map(a => a.preview);
      onSendMessage(finalText, images.length > 0 ? images : undefined);
      
      setText('');
      setAttachments([]);
      setFileError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // --- Cropping Interaction Logic ---
  
  const openCropper = (attachment: Attachment) => {
    if (attachment.type === 'pdf') return; // Cannot crop PDF
    setEditingAttachmentId(attachment.id);
    setSelections(attachment.selections || []);
    setActiveId(null);
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newId = Date.now().toString();
    setDragAction('create');
    setDragStart({ x, y });
    setSelections(prev => [...prev, { id: newId, x, y, w: 0, h: 0, style: 'normal' }]);
    setActiveId(newId);
    setIsDragging(true);
  };

  const handleBoxMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); e.preventDefault();
    if (!containerRef.current) return;
    const box = selections.find(s => s.id === id);
    if (!box) return;
    const rect = containerRef.current.getBoundingClientRect();
    setActiveId(id);
    setDragAction('move');
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragOffset({ x: box.x, y: box.y });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current || !activeId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (dragAction === 'create') {
      const rawW = currentX - dragStart.x;
      const rawH = currentY - dragStart.y;
      const x = rawW > 0 ? dragStart.x : currentX;
      const y = rawH > 0 ? dragStart.y : currentY;
      const w = Math.abs(rawW);
      const h = Math.abs(rawH);
      const boundedX = Math.max(0, x);
      const boundedY = Math.max(0, y);
      const boundedW = Math.min(w, rect.width - boundedX);
      const boundedH = Math.min(h, rect.height - boundedY);
      setSelections(prev => prev.map(sel => sel.id === activeId ? { ...sel, x: boundedX, y: boundedY, w: boundedW, h: boundedH } : sel));
    } else if (dragAction === 'move' && dragOffset) {
      const deltaX = currentX - dragStart.x;
      const deltaY = currentY - dragStart.y;
      let newX = dragOffset.x + deltaX;
      let newY = dragOffset.y + deltaY;
      const currentBox = selections.find(s => s.id === activeId);
      if (currentBox) {
        newX = Math.max(0, Math.min(newX, rect.width - currentBox.w));
        newY = Math.max(0, Math.min(newY, rect.height - currentBox.h));
        setSelections(prev => prev.map(sel => sel.id === activeId ? { ...sel, x: newX, y: newY } : sel));
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && activeId && dragAction === 'create') {
      const activeSelection = selections.find(s => s.id === activeId);
      if (activeSelection && (activeSelection.w < 10 || activeSelection.h < 10)) {
        setSelections(prev => prev.filter(s => s.id !== activeId));
        setActiveId(null);
      }
    }
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleDeleteBox = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelections(prev => prev.filter(s => s.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const toggleStyle = (e: React.MouseEvent, id: string, style: 'bold' | 'italic') => {
    e.stopPropagation();
    setSelections(prev => prev.map(sel => sel.id === id ? { ...sel, style: sel.style === style ? 'normal' : style } : sel));
  };

  const confirmCrop = () => {
    if (!editingAttachmentId || !imageRef.current) return;

    // If only one region selected, crop to it. If multiple, use analyze all logic.
    const activeSelection = selections.find(s => s.id === activeId);
    
    // Fallback: If no active but selections exist, use the first one.
    const targetSelection = activeSelection || (selections.length > 0 ? selections[0] : null);

    if (!targetSelection) {
      // Revert to full image
      setAttachments(prev => prev.map(a => a.id === editingAttachmentId ? {
        ...a,
        preview: a.original || a.preview,
        selections: [],
        contextInfo: null
      } : a));
      setEditingAttachmentId(null);
      return;
    }

    // Single Crop Logic
    const canvas = document.createElement('canvas');
    const image = imageRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = targetSelection.w * scaleX;
    canvas.height = targetSelection.h * scaleY;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(image, targetSelection.x * scaleX, targetSelection.y * scaleY, targetSelection.w * scaleX, targetSelection.h * scaleY, 0, 0, canvas.width, canvas.height);
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.95);
      
      const note = targetSelection.style !== 'normal' ? `The content is marked as **${targetSelection.style.toUpperCase()}**.` : null;
      
      setAttachments(prev => prev.map(a => a.id === editingAttachmentId ? {
        ...a,
        preview: croppedBase64,
        selections: selections, // Save selection state to re-edit
        contextInfo: note
      } : a));
    }
    setEditingAttachmentId(null);
  };

  const confirmAnalyzeAll = () => {
    if (!imageRef.current || selections.length === 0 || !editingAttachmentId) return;
    const image = imageRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sortedSelections = [...selections].sort((a, b) => a.y - b.y);
    let maxWidth = 0, totalHeight = 0;
    sortedSelections.forEach(sel => {
      maxWidth = Math.max(maxWidth, sel.w * scaleX);
      totalHeight += (sel.h * scaleY) + 50;
    });
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let currentY = 0, contextNotes = "";
    sortedSelections.forEach((sel, index) => {
      ctx.fillStyle = '#db2777'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(`Region ${index + 1}`, 0, currentY + 22);
      ctx.drawImage(image, sel.x * scaleX, sel.y * scaleY, sel.w * scaleX, sel.h * scaleY, 0, currentY + 30, sel.w * scaleX, sel.h * scaleY);
      contextNotes += sel.style !== 'normal' ? `- Region ${index+1} is **${sel.style.toUpperCase()}**.\n` : `- Region ${index+1}: Normal.\n`;
      currentY += (sel.h * scaleY) + 50;
    });
    
    setAttachments(prev => prev.map(a => a.id === editingAttachmentId ? {
        ...a,
        preview: canvas.toDataURL('image/jpeg', 0.90),
        selections: selections,
        contextInfo: contextNotes
      } : a));
    setEditingAttachmentId(null);
  };

  const confirmFullImage = () => {
    if (!editingAttachmentId) return;
    setAttachments(prev => prev.map(a => a.id === editingAttachmentId ? {
      ...a,
      preview: a.original || a.preview,
      selections: [],
      contextInfo: null
    } : a));
    setEditingAttachmentId(null);
  };

  const cancelCrop = () => {
    setEditingAttachmentId(null);
    setSelections([]);
    setActiveId(null);
  };

  const editingAttachment = attachments.find(a => a.id === editingAttachmentId);

  return (
    <>
      {/* Image Cropper Modal */}
      {editingAttachment && editingAttachment.original && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6">
            <div 
              ref={containerRef}
              className="relative inline-block cursor-crosshair shadow-2xl rounded-lg overflow-hidden group/container border-4 border-stone-800"
              onMouseDown={handleContainerMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img ref={imageRef} src={editingAttachment.original} alt="Crop" className="max-h-[70vh] max-w-full block pointer-events-none" draggable={false} />
              {selections.map((sel, idx) => {
                const isActive = sel.id === activeId;
                return (
                  <div key={sel.id} style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, borderWidth: sel.style === 'bold' ? 4 : 2, borderColor: isActive ? '#ec4899' : 'rgba(236, 72, 153, 0.6)', borderStyle: isActive ? 'solid' : 'dashed', zIndex: isActive ? 10 : 5 }}
                    className={`absolute bg-sakura-500/10 cursor-move`} onMouseDown={(e) => handleBoxMouseDown(e, sel.id)}>
                    <div className="absolute -top-8 left-0 bg-stone-800 text-white text-xs px-2 py-1 rounded font-bold shadow-lg flex gap-2 items-center">
                      #{idx + 1} {sel.style !== 'normal' && <span className="bg-sakura-500 px-1 rounded text-[10px]">{sel.style.toUpperCase()}</span>}
                    </div>
                    <button onClick={(e) => handleDeleteBox(e, sel.id)} className="absolute -top-8 right-0 bg-red-500 text-white p-1 rounded hover:bg-red-600 shadow-lg"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Cropper Toolbar */}
          <div className="bg-stone-900 p-6">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                   {activeId ? (
                     <div className="flex bg-stone-800 rounded-lg p-1 gap-1">
                        <button onClick={(e) => toggleStyle(e, activeId, 'bold')} className={`px-3 py-1.5 rounded-md text-sm font-bold ${selections.find(s => s.id === activeId)?.style === 'bold' ? 'bg-sakura-500 text-white' : 'text-stone-400 hover:text-white'}`}>B</button>
                        <button onClick={(e) => toggleStyle(e, activeId, 'italic')} className={`px-3 py-1.5 rounded-md text-sm italic ${selections.find(s => s.id === activeId)?.style === 'italic' ? 'bg-sakura-500 text-white' : 'text-stone-400 hover:text-white'}`}>I</button>
                     </div>
                   ) : (
                     <span className="text-stone-500 text-sm">Select a region to format</span>
                   )}
                </div>
                <div className="flex gap-3">
                  <button onClick={cancelCrop} className="px-4 py-2 text-stone-400 hover:text-white transition-colors font-medium">Cancel</button>
                  <button onClick={confirmFullImage} className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl hover:text-white transition-colors">Reset</button>
                  <button onClick={confirmAnalyzeAll} disabled={selections.length < 2} className="px-4 py-2 bg-stone-800 text-white rounded-xl disabled:opacity-50 hover:bg-stone-700 transition-colors">All Regions</button>
                  <button onClick={confirmCrop} className="px-6 py-2 bg-sakura-600 text-white rounded-xl font-bold hover:bg-sakura-500 transition-colors shadow-lg shadow-sakura-900/50">Done</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Input Area */}
      <div className="fixed bottom-0 left-0 md:left-80 right-0 p-4 md:p-6 z-20 pointer-events-none">
        {/* Drag Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-30 bg-sakura-500/10 backdrop-blur-sm border-2 border-dashed border-sakura-400 flex flex-col items-center justify-center text-sakura-600 m-4 rounded-3xl animate-pulse pointer-events-auto">
             <UploadCloud size={48} className="mb-4 drop-shadow-md" />
             <p className="font-bold text-lg font-display">Drop files to analyze</p>
          </div>
        )}

        {/* Input Container */}
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl shadow-stone-200/50 rounded-[2rem] p-2 transition-all duration-300 relative group hover:shadow-stone-300/60 hover:border-white">
            
            {/* Error Toast */}
            {fileError && (
               <div className="absolute -top-12 left-0 right-0 mx-auto max-w-sm bg-red-50 text-red-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm flex items-center justify-between border border-red-100">
                 <span>{fileError}</span>
                 <button onClick={() => setFileError(null)}><X size={14} /></button>
               </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="absolute -top-24 left-4 right-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide animate-in slide-in-from-bottom-4 fade-in duration-300">
                 {attachments.map((att) => (
                   <div key={att.id} className="relative group/preview shrink-0">
                     <div 
                        className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg shadow-stone-200 bg-white cursor-pointer"
                        onClick={() => openCropper(att)}
                        title={att.type === 'pdf' ? 'PDF Document' : 'Click to crop/edit'}
                     >
                        {att.type === 'pdf' ? (
                           <div className="h-full w-full flex flex-col items-center justify-center bg-red-50 p-1">
                              <FileStack className="text-red-500 mb-1" size={24} />
                              <span className="text-[8px] font-bold text-red-800 uppercase truncate w-full text-center">PDF</span>
                           </div>
                        ) : (
                           <img src={att.preview} alt="Preview" className="h-full w-full object-cover" />
                        )}
                        
                        {/* Edit Overlay for Images */}
                        {att.type === 'image' && (
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                             <Edit size={16} className="text-white drop-shadow-md" />
                          </div>
                        )}
                     </div>
                     <button onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }} className="absolute -top-2 -right-2 bg-stone-800 text-white rounded-full p-1 shadow-md hover:bg-red-500 transition-colors z-10"><X size={12} /></button>
                   </div>
                 ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <input type="file" multiple accept="image/*,application/pdf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              
              <div className="flex items-center gap-1 pl-1 pb-1">
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors" title="Upload files"><Paperclip size={20} /></button>
                 <button type="button" onClick={toggleListening} className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'}`} title="Voice"><Mic size={20} /></button>
              </div>

              <div className="flex-1 py-3 px-2">
                 <textarea
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder={isListening ? "Listening..." : "Paste images, upload files, or ask Sensei..."}
                   className="w-full bg-transparent border-0 focus:ring-0 p-0 text-stone-800 placeholder:text-stone-400 font-mm resize-none max-h-[120px] text-base leading-relaxed"
                   rows={1}
                 />
              </div>

              <div className="pb-1 pr-1">
                 <button 
                   type="submit" 
                   disabled={(!text.trim() && attachments.length === 0) || isLoading}
                   className={`p-3.5 rounded-xl transition-all duration-300 shadow-lg ${(!text.trim() && attachments.length === 0) || isLoading ? 'bg-stone-100 text-stone-300 shadow-none' : 'bg-stone-800 text-white hover:bg-stone-900 hover:scale-105 shadow-stone-400/50'}`}
                 >
                   <Send size={18} />
                 </button>
              </div>
            </form>
          </div>
          <div className="text-center mt-3">
            <p className="text-[10px] text-stone-400 font-medium tracking-wide opacity-70">AI generated content may contain errors.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InputArea;
