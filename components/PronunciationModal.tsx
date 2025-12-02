import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, RotateCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Flashcard } from '../types';
import { evaluatePronunciation, PronunciationResult } from '../services/gemini';

interface PronunciationModalProps {
  card: Flashcard;
  onClose: () => void;
}

const PronunciationModal: React.FC<PronunciationModalProps> = ({ card, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Visualizer
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      visualize();

      // Setup Recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop()); // Stop mic
        
        // Stop visualizer
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
             audioContextRef.current.close();
        }
        
        // Create Blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Use webm for wider compatibility
        await analyzeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setResult(null);

    } catch (err) {
      console.error("Mic Error:", err);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 30;

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const scale = 1 + (average / 256) * 1.5;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#ec4899'; // Sakura-500
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * scale * 1.2, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();
  };

  const analyzeAudio = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const res = await evaluatePronunciation(base64data, card.kanji, card.kana || card.romaji);
        setResult(res);
        setIsAnalyzing(false);
      };
    } catch (err) {
      console.error(err);
      setError("Failed to analyze pronunciation.");
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500 bg-green-50 border-green-200";
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-500 bg-red-50 border-red-200";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-stone-800 w-full max-w-sm rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
          <X size={20} />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <h3 className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider text-xs mb-4">Pronunciation Practice</h3>
          
          <div className="mb-8">
            <h2 className="text-4xl font-bold font-jp text-stone-800 dark:text-stone-100 mb-2">{card.kanji}</h2>
            <p className="text-sakura-500 font-jp text-lg font-medium">{card.kana || card.romaji}</p>
          </div>

          <div className="relative w-full h-32 flex items-center justify-center mb-6">
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="text-sakura-500 animate-spin" />
                <span className="text-sm font-bold text-stone-400 animate-pulse">Analyzing...</span>
              </div>
            ) : result ? (
              <div className="w-full animate-in zoom-in slide-in-from-bottom-4">
                 <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center border-4 mb-3 ${getScoreColor(result.score)}`}>
                    <span className="text-3xl font-bold">{result.score}</span>
                 </div>
                 <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
                    {result.score >= 80 ? "Excellent!" : result.score >= 50 ? "Good Attempt" : "Needs Practice"}
                 </p>
              </div>
            ) : (
              <>
                <canvas ref={canvasRef} width="200" height="120" className="absolute inset-0 mx-auto" />
                {!isRecording && !result && (
                  <div className="text-stone-300 dark:text-stone-600 flex flex-col items-center justify-center gap-2">
                    <Mic size={32} />
                    <span className="text-xs">Tap mic to start</span>
                  </div>
                )}
              </>
            )}
          </div>

          {result && (
            <div className="w-full bg-stone-50 dark:bg-stone-900 rounded-xl p-4 mb-6 text-left border border-stone-100 dark:border-stone-700">
               <div className="flex gap-2 mb-2">
                  <span className="text-xs font-bold text-stone-400 uppercase">Heard:</span>
                  <span className="text-xs font-mono text-stone-600 dark:text-stone-300">{result.phonetic}</span>
               </div>
               <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                 {result.feedback}
               </p>
            </div>
          )}

          {error && (
            <div className="w-full bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Controls */}
          <div className="w-full flex justify-center">
             {!result && !isAnalyzing && (
               <button
                 onClick={isRecording ? stopRecording : startRecording}
                 className={`
                   w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg
                   ${isRecording 
                     ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 dark:shadow-red-900/30' 
                     : 'bg-sakura-500 hover:bg-sakura-600 text-white shadow-sakura-200 dark:shadow-sakura-900/30'}
                 `}
               >
                 {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={28} />}
               </button>
             )}

             {result && (
               <button
                 onClick={() => { setResult(null); }}
                 className="flex items-center gap-2 px-6 py-3 bg-stone-800 dark:bg-stone-700 hover:bg-stone-700 dark:hover:bg-stone-600 text-white rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
               >
                 <RotateCw size={18} /> Try Again
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default PronunciationModal;