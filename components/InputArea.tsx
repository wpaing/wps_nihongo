
import React, { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, X, Crop, Maximize, MousePointer2, Trash2, Mic, MicOff, Move, Layers, Bold, Italic, FileText, Paperclip, UploadCloud, FileStack } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string, image?: string) => void;
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

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageContextInfo, setImageContextInfo] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image');
  const [fileName, setFileName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
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

  // Setup Global Drag and Drop Listeners
  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragOver(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragOver(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter = 0;
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const toggleListening = () => {
    isListening ? stopListening() : startListening();
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Sorry, voice input is not supported in this browser.");
      return;
    }
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
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processFile = (file: File) => {
    setFileError(null);
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File is too large. Limit is 10MB.");
      return;
    }
    const isPdf = file.type === 'application/pdf';
    setFileType(isPdf ? 'pdf' : 'image');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (isPdf) {
        // PDF: Direct preview without cropping
        setImagePreview(result);
        setOriginalImage(null);
        setShowCropper(false);
        setSelections([]);
        setActiveId(null);
        setImageContextInfo(null);
      } else {
        // Image: Setup for cropping
        setOriginalImage(result);
        setShowCropper(true);
        setSelections([]); 
        setActiveId(null);
        setImageContextInfo(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const clearImage = () => {
    setImagePreview(null);
    setOriginalImage(null);
    setSelections([]);
    setActiveId(null);
    setImageContextInfo(null);
    setFileType('image');
    setFileName('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || imagePreview) && !isLoading && !fileError) {
      const finalText = imageContextInfo 
        ? `${text}\n\n[Image Formatting Instructions]:\n${imageContextInfo}` 
        : text;
      onSendMessage(finalText, imagePreview || undefined);
      setText('');
      clearImage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // --- Cropping Interaction Logic ---
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
    e.stopPropagation();
    e.preventDefault();
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
    const activeSelection = selections.find(s => s.id === activeId);
    if (!imageRef.current || !activeSelection || activeSelection.w < 5) {
       if (selections.length > 0) { processCrop(selections[0]); return; }
       else { confirmFullImage(); return; }
    }
    processCrop(activeSelection);
  };

  const processCrop = (selection: SelectionRect) => {
    if (!imageRef.current) return;
    const canvas = document.createElement('canvas');
    const image = imageRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = selection.w * scaleX;
    canvas.height = selection.h * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, selection.x * scaleX, selection.y * scaleY, selection.w * scaleX, selection.h * scaleY, 0, 0, canvas.width, canvas.height);
    
    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.95);
    setImagePreview(croppedBase64);
    setFileType('image');
    if (selection.style !== 'normal') setImageContextInfo(`The content is marked as **${selection.style.toUpperCase()}**. Output as ${selection.style}.`);
    else setImageContextInfo(null);
    setShowCropper(false);
  };

  const confirmAnalyzeAll = () => {
    if (!imageRef.current || selections.length === 0) return;
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
    setImagePreview(canvas.toDataURL('image/jpeg', 0.90));
    setFileType('image');
    setImageContextInfo(contextNotes);
    setShowCropper(false);
  };

  const confirmFullImage = () => {
    setImagePreview(originalImage);
    setFileType('image');
    setImageContextInfo(null);
    setShowCropper(false);
  };

  const cancelCrop = () => {
    setOriginalImage(null);
    setShowCropper(false);
    setSelections([]);
    setActiveId(null);
    setImageContextInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* Image Cropper Modal */}
      {showCropper && originalImage && (
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
              <img ref={imageRef} src={originalImage} alt="Crop" className="max-h-[70vh] max-w-full block pointer-events-none" draggable={false} />
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
             <p className="font-bold text-lg font-display">Drop file to analyze</p>
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

            {/* Previews */}
            {imagePreview && (
              <div className="absolute -top-24 left-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                 <div className="relative group/preview">
                   {fileType === 'pdf' ? (
                     <div className="h-20 bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center gap-3 shadow-lg shadow-red-100/50">
                       <div className="bg-red-100 p-2 rounded-xl"><FileStack className="text-red-500" size={20} /></div>
                       <div className="flex flex-col max-w-[120px]">
                         <span className="text-[10px] font-bold text-red-800 uppercase">PDF Context</span>
                         <span className="text-xs text-red-600 truncate">{fileName}</span>
                       </div>
                     </div>
                   ) : (
                     <div className="h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg shadow-stone-200">
                        <img src={imagePreview} alt="Preview" className="h-full w-auto" />
                     </div>
                   )}
                   <button onClick={clearImage} className="absolute -top-2 -right-2 bg-stone-800 text-white rounded-full p-1 shadow-md hover:bg-red-500 transition-colors"><X size={12} /></button>
                 </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <input type="file" accept="image/*,application/pdf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              
              <div className="flex items-center gap-1 pl-1 pb-1">
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors" title="Upload"><Paperclip size={20} /></button>
                 <button type="button" onClick={toggleListening} className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'}`} title="Voice"><Mic size={20} /></button>
              </div>

              <div className="flex-1 py-3 px-2">
                 <textarea
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder={isListening ? "Listening..." : "Ask Sensei..."}
                   className="w-full bg-transparent border-0 focus:ring-0 p-0 text-stone-800 placeholder:text-stone-400 font-mm resize-none max-h-[120px] text-base leading-relaxed"
                   rows={1}
                 />
              </div>

              <div className="pb-1 pr-1">
                 <button 
                   type="submit" 
                   disabled={(!text.trim() && !imagePreview) || isLoading}
                   className={`p-3.5 rounded-xl transition-all duration-300 shadow-lg ${(!text.trim() && !imagePreview) || isLoading ? 'bg-stone-100 text-stone-300 shadow-none' : 'bg-stone-800 text-white hover:bg-stone-900 hover:scale-105 shadow-stone-400/50'}`}
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
