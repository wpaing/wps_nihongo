import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, X, BarChart3, Radio, Power, Volume2, FileText, ChevronDown } from 'lucide-react';
import { SYSTEM_INSTRUCTIONS } from '../constants';
import { AppSection, Message } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface LiveConversationProps {
  onSaveSession?: (messages: Message[]) => void;
}

// --- Audio Utils ---

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return new Blob([int16], { type: 'audio/pcm' });
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// --- Component ---

interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onSaveSession }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time partial transcripts
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<any>(null);

  // Refs for tracking conversation history across closures
  const transcriptsRef = useRef<TranscriptItem[]>([]);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  // Sync state refs
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts, currentInput, currentOutput, showTranscript]);

  const cleanupAudio = () => {
    if (inputContextRef.current) {
      if (inputContextRef.current.state !== 'closed') {
        inputContextRef.current.close();
      }
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      if (outputContextRef.current.state !== 'closed') {
        outputContextRef.current.close();
      }
      outputContextRef.current = null;
    }
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const saveAndDisconnect = () => {
    if (sessionRef.current) {
       sessionRef.current.then((session: any) => session.close());
    }
    
    // Save Session if there is history
    if (onSaveSession && transcriptsRef.current.length > 0) {
      const messages: Message[] = transcriptsRef.current.map(t => ({
        id: t.id,
        role: t.role,
        text: t.text,
        timestamp: t.timestamp
      }));
      onSaveSession(messages);
    }

    cleanupAudio();
    setIsConnected(false);
    setTranscripts([]);
    setCurrentInput('');
    setCurrentOutput('');
    currentInputRef.current = '';
    currentOutputRef.current = '';
  };

  const connect = async () => {
    setError(null);
    setTranscripts([]);
    setCurrentInput('');
    setCurrentOutput('');
    
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });

      // Init Audio Contexts
      const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      // Setup Visualizer
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const outputNode = outputCtx.createGain();
      outputNode.connect(analyser);
      analyser.connect(outputCtx.destination);

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Connect to Gemini Live
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTIONS[AppSection.CONVERSATION],
          inputAudioTranscription: { model: "gemini-2.5-flash" },
          outputAudioTranscription: { model: "gemini-2.5-flash" },
        },
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setShowTranscript(true); // Open transcript by default for feedback
            
            // Setup Input Pipeline
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return; 
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16Data = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16Data[i] = inputData[i] * 32768;
              }
              const uint8 = new Uint8Array(int16Data.buffer);
              const base64 = encode(uint8);
              
              sessionPromise.then(session => {
                 session.sendRealtimeInput({
                    media: {
                       mimeType: 'audio/pcm;rate=16000',
                       data: base64
                    }
                 });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // --- Handle Transcription ---
            if (msg.serverContent?.inputTranscription) {
               const text = msg.serverContent.inputTranscription.text;
               currentInputRef.current += text;
               setCurrentInput(currentInputRef.current);
            }

            if (msg.serverContent?.outputTranscription) {
               const text = msg.serverContent.outputTranscription.text;
               currentOutputRef.current += text;
               setCurrentOutput(currentOutputRef.current);
            }

            if (msg.serverContent?.turnComplete) {
               // Commit User Input if exists
               if (currentInputRef.current.trim()) {
                  setTranscripts(prev => [...prev, {
                     id: Date.now().toString() + "_u",
                     role: 'user',
                     text: currentInputRef.current.trim(),
                     timestamp: Date.now()
                  }]);
                  currentInputRef.current = '';
                  setCurrentInput('');
               }

               // Commit Model Output if exists
               if (currentOutputRef.current.trim()) {
                  setTranscripts(prev => [...prev, {
                     id: Date.now().toString() + "_m",
                     role: 'model',
                     text: currentOutputRef.current.trim(),
                     timestamp: Date.now()
                  }]);
                  currentOutputRef.current = '';
                  setCurrentOutput('');
               }
            }
            
            // --- Handle Audio ---
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
               const audioBytes = decode(audioData);
               const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);
               
               const source = outputCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputNode);
               
               const currentTime = outputCtx.currentTime;
               if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
               }
               
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               
               audioSourcesRef.current.add(source);
               source.onended = () => audioSourcesRef.current.delete(source);
            }

            // --- Handle Interruption ---
            if (msg.serverContent?.interrupted) {
               audioSourcesRef.current.forEach(s => {
                   try { s.stop(); } catch(e) {}
               });
               audioSourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               // If interrupted, we might want to discard pending output text, but keep input
               currentOutputRef.current = '';
               setCurrentOutput('');
            }
          },
          onclose: () => {
            saveAndDisconnect();
          },
          onerror: (e) => {
            console.error(e);
            setError("Connection error. Please try again.");
            saveAndDisconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect");
      cleanupAudio();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        // We can't easily check if open, but attempting close is safe usually
        sessionRef.current.then((s:any) => s.close().catch(() => {}));
      }
      cleanupAudio();
    };
  }, []);

  // Visualizer Loop
  useEffect(() => {
    let animationId: number;
    const render = () => {
      if (!canvasRef.current || !analyserRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const analyser = analyserRef.current;
      
      if (canvas.width !== containerRef.current.clientWidth || canvas.height !== containerRef.current.clientHeight) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }

      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      // Adjust position if transcript is open to avoid overlap
      const drawY = showTranscript ? centerY * 0.7 : centerY; 
      
      const radius = Math.min(centerX, centerY) * 0.35;
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const scale = 1 + (average / 256) * 0.8;

      // Draw Glow
      const gradient = ctx.createRadialGradient(centerX, drawY, radius * 0.5, centerX, drawY, radius * 2);
      gradient.addColorStop(0, 'rgba(236, 72, 153, 0.2)');
      gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, drawY, radius * 2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Draw Main Orb
      ctx.fillStyle = isConnected ? '#ec4899' : '#57534e';
      ctx.beginPath();
      ctx.arc(centerX, drawY, radius * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Ripple
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, drawY, radius * scale * 1.2, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    if (isConnected) {
      render();
    }

    return () => cancelAnimationFrame(animationId);
  }, [isConnected, showTranscript]);

  return (
    <div className="flex flex-col h-full bg-stone-900 text-stone-100 relative overflow-hidden">
      {/* Visualizer & Content */}
      <div className="flex-1 relative flex items-center justify-center" ref={containerRef}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
        
        {/* Transcript Overlay */}
        {isConnected && showTranscript && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-center">
             <div 
               ref={transcriptContainerRef}
               className="bg-stone-950/80 backdrop-blur-md border border-stone-800 rounded-3xl p-6 w-full max-w-2xl max-h-[50vh] overflow-y-auto shadow-2xl flex flex-col gap-4"
             >
                <div className="sticky top-0 bg-stone-950/90 pb-2 border-b border-stone-800 flex justify-between items-center z-10">
                   <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Live Transcript</h3>
                   <button onClick={() => setShowTranscript(false)}><ChevronDown size={16} className="text-stone-500" /></button>
                </div>
                
                {transcripts.length === 0 && !currentInput && !currentOutput && (
                   <p className="text-stone-600 text-center italic text-sm">Conversation starting...</p>
                )}

                {transcripts.map((t) => (
                   <div key={t.id} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                         t.role === 'user' 
                           ? 'bg-stone-800 text-stone-100 rounded-tr-sm' 
                           : 'bg-stone-900 text-stone-300 border border-stone-800 rounded-tl-sm'
                      }`}>
                         {t.text}
                      </div>
                   </div>
                ))}

                {/* Streaming items */}
                {currentInput && (
                   <div className="flex justify-end">
                      <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm bg-stone-800/50 border border-stone-700/50 text-stone-400 rounded-tr-sm italic">
                         {currentInput} <span className="animate-pulse">|</span>
                      </div>
                   </div>
                )}
                {currentOutput && (
                   <div className="flex justify-start">
                      <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm bg-stone-900/50 border border-stone-800/50 text-stone-400 rounded-tl-sm italic">
                         {currentOutput}
                      </div>
                   </div>
                )}
             </div>
          </div>
        )}
        
        {!isConnected && (
           <div className="z-20 text-center animate-in fade-in slide-in-from-bottom-4 relative">
              <div className="w-24 h-24 rounded-full bg-stone-800 flex items-center justify-center mx-auto mb-6 shadow-2xl border border-stone-700">
                 <Radio size={40} className="text-sakura-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Live Practice</h2>
              <p className="text-stone-400 max-w-sm mx-auto mb-8">
                Connect to start a real-time voice conversation with your AI tutor.
              </p>
              {error && (
                <div className="bg-red-900/30 text-red-300 px-4 py-2 rounded-lg mb-6 border border-red-900/50 text-sm inline-block">
                  {error}
                </div>
              )}
              <button 
                onClick={connect}
                className="px-8 py-4 bg-sakura-600 hover:bg-sakura-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-sakura-900/50 flex items-center gap-3 mx-auto"
              >
                <Power size={20} /> Start Session
              </button>
           </div>
        )}
      </div>

      {/* Controls Bar */}
      {isConnected && (
        <div className="z-30 p-6 pb-12 bg-gradient-to-t from-stone-950 to-transparent">
          <div className="max-w-md mx-auto flex items-center justify-center gap-6">
             <button 
               onClick={() => setShowTranscript(!showTranscript)}
               className={`p-4 rounded-full transition-colors ${showTranscript ? 'bg-stone-100 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
               title="Toggle Transcript"
             >
               <FileText size={20} />
             </button>

             <button 
               onClick={() => setIsMuted(!isMuted)}
               className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
             >
               {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             
             <button 
               onClick={saveAndDisconnect}
               className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-900/50 transition-transform hover:scale-105 font-bold text-sm"
             >
               End & Save
             </button>
          </div>
          <p className="text-center text-stone-500 text-xs mt-6 font-mono uppercase tracking-widest">
            {isMuted ? 'Mic Muted' : 'Listening...'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LiveConversation;