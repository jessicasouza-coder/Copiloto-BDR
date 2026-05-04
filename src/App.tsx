import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Phone, 
  Upload, 
  FileText, 
  BarChart3, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Loader2,
  Plus,
  Moon,
  Sun,
  Mic,
  Square,
  Volume2,
  Download,
  Settings,
  Pencil,
  Activity,
  Lightbulb,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend 
} from 'recharts';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { analyzeCall, type CallAnalysis } from './services/gemini';
import { cn } from './lib/utils';

// --- Constants & Types ---

const MARVEE_LOGO_URL = "https://marvee.com.br/wp-content/uploads/2023/08/logo-marvee-horizontal.png";

interface LiveInsight {
  phase: 'Situação' | 'Problema' | 'Implicação' | 'Necessidade';
  tip: string;
  suggestedQuestion: string;
  sentiment: 'positivo' | 'neutro' | 'negativo';
  transcription?: string;
  meetingHook?: string;
}

interface LeadAnalysis {
  name: string;
  segment: string;
  approach: string;
  isIdeal: boolean;
}

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors", className)}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'indigo' }) => {
  const variants = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    success: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    error: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider", variants[variant])}>
      {children}
    </span>
  );
};

export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Recording & Live State
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveInsight, setLiveInsight] = useState<LiveInsight | null>(null);
  const [leadAnalysis, setLeadAnalysis] = useState<LeadAnalysis | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSystemAudioActive, setIsSystemAudioActive] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'call' | 'whatsapp' | 'qualification'>('home');
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Lead Qualification Tool State
  const [qualificationInput, setQualificationInput] = useState("");
  const [isQualifying, setIsQualifying] = useState(false);
  const [qualificationResult, setQualificationResult] = useState<{
    status: 'Agendar' | 'Cuidado' | 'Não Agendar';
    missingInfo: string[];
    objections: string[];
    reasoning: string;
    hubspotSummary: string;
  } | null>(null);

  // WhatsApp Analysis State
  const [whatsappInput, setWhatsappInput] = useState("");
  const [isAnalyzingWhatsapp, setIsAnalyzingWhatsapp] = useState(false);
  const [whatsappAnalysis, setWhatsappAnalysis] = useState<{
    summary: string;
    nextStep: string;
    suggestedMessage: string;
    objections: string[];
  } | null>(null);
  
  // Goal Tracking State
  const [monthlyGoal, setMonthlyGoal] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monthlyGoal');
      return saved ? parseInt(saved) : 40;
    }
    return 40;
  });
  const [currentProposals, setCurrentProposals] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('currentProposals');
      return saved ? parseInt(saved) : 0;
    }
    return 0;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  // Meta tracking logic refinements
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDay = today.getDate();

  // Helper to calculate total business days in current month
  const calculateTotalBusinessDays = (y: number, m: number) => {
    const lastDay = new Date(y, m + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  };

  // Helper to calculate business days passed until yesterday (Mon-Fri)
  const calculateBusinessDaysPassed = (y: number, m: number, todayD: number) => {
    let count = 0;
    for (let d = 1; d < todayD; d++) {
      const dow = new Date(y, m, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  };

  const defaultTotalBusinessDays = calculateTotalBusinessDays(year, month);

  const [monthlyBusinessDays, setMonthlyBusinessDays] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monthlyBusinessDays');
      const savedMonth = localStorage.getItem('monthlyBusinessDays_month');
      // If month changed, recalculate
      if (savedMonth !== `${year}-${month}`) {
        return defaultTotalBusinessDays;
      }
      return saved ? parseInt(saved) : defaultTotalBusinessDays;
    }
    return defaultTotalBusinessDays;
  });

  useEffect(() => {
    localStorage.setItem('monthlyGoal', monthlyGoal.toString());
  }, [monthlyGoal]);

  useEffect(() => {
    localStorage.setItem('currentProposals', currentProposals.toString());
  }, [currentProposals]);

  useEffect(() => {
    localStorage.setItem('monthlyBusinessDays', monthlyBusinessDays.toString());
    localStorage.setItem('monthlyBusinessDays_month', `${year}-${month}`);
  }, [monthlyBusinessDays, year, month]);

  // Calculate remaining business days based on the set total minus what already passed
  const businessDaysPassed = calculateBusinessDaysPassed(year, month, currentDay);
  const remainingBusinessDays = Math.max(0, monthlyBusinessDays - businessDaysPassed);
  
  const remainingProposals = Math.max(0, monthlyGoal - currentProposals);
  const proposalsPerDay = remainingBusinessDays > 0 ? (remainingProposals / remainingBusinessDays).toFixed(1) : remainingProposals.toString();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Theme effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // --- Live API Integration ---

  useEffect(() => {
    if (liveInsight) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [liveInsight?.suggestedQuestion, liveInsight?.tip]);

  const startLiveCoaching = async () => {
    setErrorMessage(null);
    setConnectionStatus('connecting');
    
    const connectionTimeout = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        setConnectionStatus('error');
        setErrorMessage("Tempo de conexão esgotado. Verifique sua internet, a chave de API e se o seu projeto tem acesso ao modelo Gemini 3.1 Live.");
        if (liveSessionRef.current) liveSessionRef.current.close();
      }
    }, 30000); // Increased to 30s for permission prompts

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Chave de API do Gemini não configurada. Verifique as configurações.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Request microphone and screen capture
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let systemStream: MediaStream | null = null;
      try {
        systemStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: true 
        });
        systemStreamRef.current = systemStream;
        setIsScreenSharing(true);
        
        systemStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setIsSystemAudioActive(false);
          if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
          }
        };

        if (systemStream.getAudioTracks().length > 0) {
          setIsSystemAudioActive(true);
        }
      } catch (e) {
        console.warn("Captura de tela cancelada.");
      }

      const audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.resume(); // Ensure context is active
      audioContextRef.current = audioContext;
      const dest = audioContext.createMediaStreamDestination();

      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(dest);

      if (systemStream && systemStream.getAudioTracks().length > 0) {
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        systemSource.connect(dest);
      }

      // Live Session Setup
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `Você é o "Copiloto SDR Marvee", um coach de vendas em tempo real especializado em SPIN Selling e análise de leads.
          
          CONTEXTO DE ÁUDIO:
          - Você está recebendo um fluxo de áudio MISTO.
          - Você ouvirá tanto o SDR (quem está usando o app) quanto o LEAD (a pessoa do outro lado da linha).
          - Sua missão é analisar o diálogo COMPLETO para dar dicas precisas.
          
          CONHECIMENTO DO PLAYBOOK MARVEE:
          - PRODUTOS: Terceirização Financeira (BPO), Contabilidade Digital, Software de Gestão.
          - ICP (Perfil Ideal): Agências de Marketing/Publicidade, Arquitetura/Engenharia, Software Houses.
          - NÃO ATENDEMOS: Postos de gasolina, alimentação, indústrias, dentistas/médicos (porta aberta), ou sistemas que não sejam Bling ou Conta Azul.
          - PERSONA: Donos de empresas com até 10 funcionários (processo financeiro não estruturado).
          - CONTEXTO CRÍTICO: A maioria dos leads ainda NÃO tem BPO. Eles mesmos fazem o financeiro ou têm um "faz-tudo". Sua missão é mostrar que eles perdem tempo e não têm visão do negócio fazendo isso sozinhos.
          
          DORES E SOLUÇÕES MARVEE:
          1. VISÃO DO NEGÓCIO: Lead não sabe se a empresa está bem. Solução: BI com visão única.
          2. FALTA DE TEMPO: Lead gasta horas com financeiro. Solução: Marvee assume as rotinas.
          3. IMPOSTOS/NOTAS: Medo de multas ou erro na emissão. Solução: Especialistas garantem conformidade.
          4. COBRANÇA: Inadimplência ou esquecimento de cobrar. Solução: Monitoramento e régua de cobrança.
          5. CONCILIAÇÃO: Saldo não bate ou demora para conferir. Solução: Integração bancária automática.
          6. FLUXO DE CAIXA: Não sabe quanto entra/sai no futuro. Solução: Projeção financeira profissional.
          7. ROTATIVIDADE: Funcionário do financeiro saiu. Solução: Continuidade garantida pela Marvee.
          
          SUAS TAREFAS:
          1. ANALISAR TELA: Se você ver um perfil (LinkedIn, site), identifique o NOME do lead, o SEGMENTO e se é ICP.
          2. SUGERIR ABORDAGEM: Com base no segmento e dores prováveis, sugira como o SDR deve iniciar a conversa (ex: "Vi que vocês são uma agência, como está o controle de fluxo de caixa hoje?").
          3. TRANSCREVER: Transcreva brevemente o que o lead está dizendo no momento.
          4. COACHING SPIN: Forneça insights rápidos baseados no que o lead diz.
          5. GANCHO PARA REUNIÃO: Sempre que identificar uma oportunidade (dor latente), sugira uma pergunta para agendar a reunião.
          
          FORMATO DE RESPOSTA PARA ANÁLISE DE LEAD (SÓ QUANDO IDENTIFICAR LEAD NA TELA):
          LEAD_NAME: [Nome]
          LEAD_SEGMENT: [Segmento]
          LEAD_IDEAL: [Sim/Não]
          LEAD_APPROACH: [Sugestão curta de abordagem baseada no playbook]
          
          FORMATO DE RESPOSTA PARA COACHING (DURANTE A LIGAÇÃO):
          TRANSCRICAO: [O que o lead disse agora]
          FASE: [Situação/Problema/Implicação/Necessidade]
          DICA: [Dica curta]
          PERGUNTA: [Pergunta direta para o lead]
          GANCHO_REUNIAO: [Pergunta para levar para a reunião]
          SENTIMENTO: [positivo/neutro/negativo]`,
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const text = message.serverContent.modelTurn.parts.map(p => p.text).join(' ');
              if (text) {
                parseLiveInsight(text);
              }
            }
            if (message.serverContent?.interrupted) {
              console.log("Modelo interrompido");
            }
          },
          onopen: () => {
            clearTimeout(connectionTimeout);
            console.log("Sessão ao vivo aberta");
            setIsLiveMode(true);
            setConnectionStatus('connected');
            
            // Start streaming audio
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            const source = audioContext.createMediaStreamSource(dest.stream);
            source.connect(processor);
            
            // Connect to a dummy gain node with 0 gain to avoid feedback loop
            const dummyGain = audioContext.createGain();
            dummyGain.gain.value = 0;
            processor.connect(dummyGain);
            dummyGain.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume level for UI feedback
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setAudioLevel(Math.min(100, Math.round(rms * 500))); // Scale for UI

              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            // Start streaming video frames if available
            if (systemStream && systemStream.getVideoTracks().length > 0) {
              const video = document.createElement('video');
              video.srcObject = systemStream;
              video.play();
              videoRef.current = video;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              const sendFrame = () => {
                if (!video.videoWidth || !video.videoHeight) return;
                
                // Maintain aspect ratio while resizing to max 640x480
                const maxWidth = 640;
                const maxHeight = 480;
                let width = video.videoWidth;
                let height = video.videoHeight;
                
                if (width > maxWidth) {
                  height *= maxWidth / width;
                  width = maxWidth;
                }
                if (height > maxHeight) {
                  width *= maxHeight / height;
                  height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(video, 0, 0, width, height);
                const base64Frame = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                
                sessionPromise.then(session => {
                  session.sendRealtimeInput({
                    video: { data: base64Frame, mimeType: 'image/jpeg' }
                  });
                });
              };
              
              frameIntervalRef.current = window.setInterval(sendFrame, 2000); // Frame every 2s
            }
          },
          onclose: () => {
            setIsLiveMode(false);
            setIsSystemAudioActive(false);
            setConnectionStatus('idle');
          },
          onerror: (err: any) => {
            console.error("Erro na sessão ao vivo:", err);
            setConnectionStatus('error');
            setErrorMessage(`Erro na conexão: ${err.message || "Verifique sua chave de API e acesso ao modelo."}`);
          },
        }
      });

      const session = await sessionPromise;
      liveSessionRef.current = session;

      // Also start recording
      const mediaRecorder = new MediaRecorder(dest.stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marvee-call-${new Date().toISOString()}.webm`;
        a.click();
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);

    } catch (err: any) {
      clearTimeout(connectionTimeout);
      console.error("Falha ao iniciar coaching ao vivo:", err);
      setErrorMessage(err.message || "Erro desconhecido ao iniciar a sessão.");
      setConnectionStatus('error');
      setIsLiveMode(false);
      setIsRecording(false);
    }
  };

  const stopLiveCoaching = () => {
    setConnectionStatus('idle');
    setAudioLevel(0);
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop());
      systemStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsRecording(false);
    setIsLiveMode(false);
    setIsScreenSharing(false);
    setLeadAnalysis(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const requestManualInsight = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.sendRealtimeInput({
        text: "Analise o que foi dito nos últimos segundos e me dê uma pergunta ou dica curta AGORA para eu falar para o lead. Lembre-se: o lead provavelmente faz o financeiro sozinho e está sobrecarregado. Siga o formato FASE/DICA/PERGUNTA/SENTIMENTO."
      });
    }
  };

  const parseLiveInsight = (text: string) => {
    // Lead Analysis Parsing
    const leadNameMatch = text.match(/LEAD_NAME:\s*(.*?)(\n|$)/i);
    const leadSegmentMatch = text.match(/LEAD_SEGMENT:\s*(.*?)(\n|$)/i);
    const leadIdealMatch = text.match(/LEAD_IDEAL:\s*(Sim|Não)/i);
    const leadApproachMatch = text.match(/LEAD_APPROACH:\s*(.*?)(\n|$)/i);

    if (leadNameMatch) {
      setLeadAnalysis({
        name: leadNameMatch[1],
        segment: leadSegmentMatch?.[1] || 'Não identificado',
        isIdeal: leadIdealMatch?.[1].toLowerCase() === 'sim',
        approach: leadApproachMatch?.[1] || 'Inicie com uma pergunta de situação.'
      });
    }

    // Coaching Parsing
    const phaseMatch = text.match(/FASE:\s*(Situação|Problema|Implicação|Necessidade)/i);
    const tipMatch = text.match(/DICA:\s*(.*?)(\n|$)/i);
    const questionMatch = text.match(/PERGUNTA:\s*(.*?)(\n|$)/i);
    const sentimentMatch = text.match(/SENTIMENTO:\s*(positivo|neutro|negativo)/i);
    const transcriptionMatch = text.match(/TRANSCRICAO:\s*(.*?)(\n|$)/i);
    const hookMatch = text.match(/GANCHO_REUNIAO:\s*(.*?)(\n|$)/i);

    if (phaseMatch || tipMatch || questionMatch || transcriptionMatch) {
      setLiveInsight({
        phase: (phaseMatch?.[1] as any) || liveInsight?.phase || 'Situação',
        tip: tipMatch?.[1] || liveInsight?.tip || 'Escutando...',
        suggestedQuestion: questionMatch?.[1] || liveInsight?.suggestedQuestion || '...',
        sentiment: (sentimentMatch?.[1] as any) || liveInsight?.sentiment || 'neutro',
        transcription: transcriptionMatch?.[1] || liveInsight?.transcription || '',
        meetingHook: hookMatch?.[1] || liveInsight?.meetingHook || ''
      });
    }
  };

  const analyzeWhatsapp = async () => {
    if (!whatsappInput.trim()) return;
    
    setIsAnalyzingWhatsapp(true);
    setWhatsappAnalysis(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Você é um especialista em vendas via WhatsApp da Marvee. Analise a conversa abaixo e sugira os próximos passos.
        
        PLAYBOOK MARVEE:
        - PRODUTOS: Terceirização Financeira (BPO), Contabilidade Digital, Software de Gestão.
        - ICP: Agências, Arquitetura/Engenharia, Software Houses.
        - DORES: Falta de tempo, falta de visão do negócio, medo de impostos, inadimplência.
        
        CONVERSA:
        ${whatsappInput}
        
        RESPONDA EXATAMENTE NESTE FORMATO JSON:
        {
          "summary": "Resumo curto do que foi discutido",
          "nextStep": "Qual o próximo passo lógico (ex: pedir reunião, tirar dúvida x)",
          "suggestedMessage": "Sugestão de mensagem para enviar agora (tom amigável e profissional)",
          "objections": ["objeção 1", "objeção 2"]
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      if (response.text) {
        const result = JSON.parse(response.text);
        setWhatsappAnalysis(result);
      }
    } catch (err) {
      console.error("Erro na análise de WhatsApp:", err);
      setErrorMessage("Falha ao analisar conversa de WhatsApp.");
    } finally {
      setIsAnalyzingWhatsapp(false);
    }
  };

  const analyzeLeadQualification = async () => {
    if (!qualificationInput.trim()) return;
    
    setIsQualifying(true);
    setQualificationResult(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Você é um especialista em qualificação de leads da Marvee. Analise as informações abaixo e decida se o lead deve ser agendado para uma reunião de vendas.
        
        PLAYBOOK MARVEE:
        - ICP: Agências (Mkt/Publicidade), Arquitetura/Engenharia, Software Houses.
        - NÃO ATENDEMOS: Postos, alimentação, indústrias, médicos (porta aberta), ou sistemas que não sejam Bling ou Conta Azul.
        - PERSONA: Donos de empresas com até 10 funcionários.
        - DORES: Falta de tempo, falta de visão do negócio, medo de impostos, inadimplência.
        
        DADOS DO LEAD:
        ${qualificationInput}
        
        RESPONDA EXATAMENTE NESTE FORMATO JSON:
        {
          "status": "Agendar" | "Cuidado" | "Não Agendar",
          "missingInfo": ["info1", "info2"],
          "objections": ["objeção1", "objeção2"],
          "reasoning": "Breve explicação do porquê desta decisão",
          "hubspotSummary": "Gere um resumo estruturado seguindo RIGOROSAMENTE este formato:\\n\\nResumo direto (o que importa pra venda)\\n[Explicação curta e objetiva: O que a empresa faz, modelo de negócio, quem cuida do financeiro, contexto atual. Tom vendedor-para-vendedor, sem enrolação]\\n\\nPrincipais dores\\n[Bullet points de dores verbalizadas]\\n\\nTiming\\n[Falas/comportamentos de interesse real, se houver]\\n\\nInformações operacionais\\n[Liste APENAS se mencionado: Segmento, Faturamento médio, Regime tributário, Vai usar centro de custo?, Número de recebimentos por mês, Número de pagamentos por mês, Funcionários CLT, Funcionários PJ, Quantidade de sócios, Regras obrigatórias. NÃO INFERIR, NÃO USAR 'NÃO INFORMADO', SE NÃO TIVER OMITA O ITEM. Sem emojis.]"
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      if (response.text) {
        const result = JSON.parse(response.text);
        setQualificationResult(result);
      }
    } catch (err) {
      console.error("Erro na qualificação:", err);
      setErrorMessage("Falha ao analisar qualificação do lead.");
    } finally {
      setIsQualifying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sentimentData = analysis ? [
    { name: 'SDR', value: analysis.sentiment.sdr },
    { name: 'Prospect', value: analysis.sentiment.prospect },
  ] : [];

  const COLORS = ['#4F46E5', '#10B981'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col transition-colors z-20">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <img 
            src={MARVEE_LOGO_URL} 
            alt="Marvee Logo" 
            className="h-8 object-contain dark:invert transition-all"
            referrerPolicy="no-referrer"
          />
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Copiloto SDR</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg font-medium transition-colors">
            <BarChart3 size={18} />
            Painel
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors">
            <MessageSquare size={18} />
            Histórico de Chamadas
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors">
            <Settings size={18} />
            Configurações
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Playbook Reference Button */}
          <button 
            onClick={() => setShowPlaybook(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group"
          >
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <FileText size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Playbook Marvee</p>
              <p className="text-[10px] opacity-60">Consultar regras de venda</p>
            </div>
          </button>

          {/* Live Coaching Control */}
          <div className={cn(
            "p-4 rounded-xl border transition-all",
            isLiveMode 
              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" 
              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isLiveMode ? "bg-rose-500 animate-pulse" : "bg-slate-400"
                )} />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  {isLiveMode ? "Gravando Chamada" : "Modo Offline"}
                </span>
              </div>
              
              {/* Audio Level Indicator */}
              {isLiveMode && (
                <div className="flex items-center gap-0.5 h-3">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i}
                      className="w-0.5 bg-indigo-500 rounded-full transition-all duration-75"
                      style={{ 
                        height: `${Math.max(20, Math.min(100, (audioLevel / (i + 1)) * 2.5))}%`,
                        opacity: audioLevel > (i * 15) ? 1 : 0.2
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div title="Microfone" className={cn(
                    "p-2 rounded-full transition-all duration-300", 
                    isLiveMode ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300",
                    isLiveMode && audioLevel > 5 && "ring-4 ring-emerald-500/20 scale-110"
                  )}>
                    <Mic size={16} className={cn(isLiveMode && audioLevel > 5 && "animate-pulse")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase transition-colors",
                    isLiveMode && audioLevel > 5 ? "text-emerald-600" : "text-slate-400"
                  )}>
                    {isLiveMode && audioLevel > 5 ? "Ouvindo..." : "Mic"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div title="Compartilhamento de Tela" className={cn("p-2 rounded-full", isScreenSharing ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300")}>
                    <Activity size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tela {isScreenSharing ? "Ativa" : "Inativa"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div title="Áudio do Lead" className={cn(
                    "p-2 rounded-full transition-all duration-300", 
                    isSystemAudioActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-300"
                  )}>
                    <Volume2 size={16} className={cn(isSystemAudioActive && "animate-pulse")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase transition-colors",
                    isSystemAudioActive ? "text-indigo-600" : "text-slate-400"
                  )}>
                    {isSystemAudioActive ? "Lead OK" : "Lead OFF"}
                  </span>
                </div>
              </div>
              
              {!isSystemAudioActive && isLiveMode && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3 items-start">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-tight">
                    <span className="font-bold">Dica:</span> Para o copiloto ouvir o lead, ao compartilhar tela, escolha a <span className="underline">aba do navegador</span> da sua chamada e marque <span className="font-bold">"Compartilhar áudio da guia"</span>.
                  </p>
                </div>
              )}
            </div>
            {isRecording && <div className="mb-3 text-center"><span className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatTime(recordingTime)}</span></div>}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 italic text-center">
              * A gravação inicia automaticamente ao começar a chamada.
            </p>
            <button 
              onClick={isLiveMode ? stopLiveCoaching : startLiveCoaching}
              className={cn(
                "w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm",
                isLiveMode 
                  ? "bg-rose-600 text-white hover:bg-rose-700" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {isLiveMode ? <Square size={14} /> : <Zap size={14} />}
              {isLiveMode ? "Encerrar Sessão" : "Iniciar Chamada ao Vivo"}
            </button>
            {isLiveMode ? (
              <div className="mt-3 p-2 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Conectado ao Coach</span>
              </div>
            ) : !process.env.GEMINI_API_KEY ? (
              <div className="mt-3 p-2 bg-rose-100/50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800 flex items-center gap-2">
                <AlertCircle size={12} className="text-rose-500" />
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Chave de API ausente</span>
              </div>
            ) : null}
          </div>

          <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-4 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs font-medium opacity-70 mb-1">Meta Semanal</p>
              <p className="text-xl font-bold">12/20 Chamadas</p>
              <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[60%]" />
              </div>
            </div>
            <TrendingUp className="absolute -right-4 -bottom-4 text-slate-700 opacity-30" size={80} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8 max-w-7xl mx-auto">
        {/* Modals */}
        <AnimatePresence>
          {showPlaybook && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600">
                      <FileText size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Playbook de Vendas Marvee</h2>
                  </div>
                  <button onClick={() => setShowPlaybook(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
                
                <div className="space-y-8">
                  <section>
                    <h3 className="text-lg font-bold text-indigo-600 mb-3 uppercase tracking-wider">O que vendemos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="font-bold mb-1">BPO Financeiro</p>
                        <p className="text-xs text-slate-500">Terceirização completa das rotinas financeiras.</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="font-bold mb-1">Contabilidade</p>
                        <p className="text-xs text-slate-500">Digital, ágil e focada em resultados.</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="font-bold mb-1">Software</p>
                        <p className="text-xs text-slate-500">Integração com Bling e Conta Azul.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-indigo-600 mb-3 uppercase tracking-wider">Perfil Ideal (ICP)</h3>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        Agências de Marketing e Publicidade
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        Escritórios de Arquitetura e Engenharia
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        Software Houses e Empresas de Tecnologia
                      </li>
                      <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <AlertCircle size={16} className="text-rose-500" />
                        Não atendemos: Comércio de porta aberta, Indústrias, Saúde.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-indigo-600 mb-3 uppercase tracking-wider">Dores Comuns</h3>
                    <div className="space-y-3">
                      <div className="p-4 border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-900/10 rounded-r-xl">
                        <p className="font-bold text-sm">Falta de Visão</p>
                        <p className="text-xs text-slate-500">O dono não sabe se a empresa deu lucro ou prejuízo no mês.</p>
                      </div>
                      <div className="p-4 border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-900/10 rounded-r-xl">
                        <p className="font-bold text-sm">Mistura de Contas</p>
                        <p className="text-xs text-slate-500">Contas pessoais e da empresa estão todas misturadas.</p>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isEditingGoal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Configurar Meta</h3>
                    <button onClick={() => setIsEditingGoal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Meta Mensal (Propostas)</label>
                      <input 
                        type="number" 
                        value={monthlyGoal}
                        onChange={(e) => setMonthlyGoal(parseInt(e.target.value) || 0)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dias Úteis no Mês</label>
                      <input 
                        type="number" 
                        value={monthlyBusinessDays}
                        onChange={(e) => setMonthlyBusinessDays(parseInt(e.target.value) || 0)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Propostas Enviadas Hoje</label>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setCurrentProposals(prev => Math.max(0, prev - 1))}
                          className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <X size={18} className="text-slate-500" />
                        </button>
                        <input 
                          type="number" 
                          value={currentProposals}
                          onChange={(e) => setCurrentProposals(parseInt(e.target.value) || 0)}
                          className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                          onClick={() => setCurrentProposals(prev => prev + 1)}
                          className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsEditingGoal(false)}
                    className="w-full mt-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    Salvar Meta
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
            >
              <AlertCircle size={24} />
              <div className="flex-1">
                <p className="font-bold">Ops! Algo deu errado</p>
                <p className="text-sm opacity-90">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded-full">
                <Plus size={20} className="rotate-45" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Copiloto SDR Marvee</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Sua inteligência de vendas em tempo real.</p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab !== 'home' && (
                <button 
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <ArrowRight size={16} className="rotate-180" />
                  Voltar ao Início
                </button>
              )}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => { setAnalysis(null); setLeadAnalysis(null); setLiveInsight(null); setQualificationResult(null); setWhatsappAnalysis(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus size={16} />
                Nova Sessão
              </button>
            </div>
          </div>

          {activeTab === 'home' && (
            <div className="mt-10 space-y-8">
              {/* Month to Date Tracking */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 text-teal-500">
                  <TrendingUp size={120} />
                </div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-teal-600 dark:text-teal-400 font-bold uppercase tracking-widest text-[10px] mb-1">Acompanhamento de Meta (MTD)</h3>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">Hoje é dia {currentDay}, você está com <span className="text-teal-500">{currentProposals}</span> propostas.</p>
                    </div>
                    <button 
                      onClick={() => setIsEditingGoal(true)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                      title="Editar Meta"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col">
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-1">Meta do Mês</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{monthlyGoal} <span className="text-sm font-normal opacity-70">propostas</span></p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-1">Faltam</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{remainingProposals} <span className="text-sm font-normal opacity-70">propostas</span></p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-teal-600 dark:text-teal-400 text-[10px] font-bold uppercase mb-1">Necessário (Restam {remainingBusinessDays} dias úteis)</p>
                      <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{proposalsPerDay} <span className="text-sm font-normal opacity-70">por dia</span></p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-bold mb-2 text-slate-500 dark:text-slate-400">
                      <span>Progresso da Meta</span>
                      <span className="text-teal-600 dark:text-teal-400">{Math.round((currentProposals / monthlyGoal) * 100)}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (currentProposals / monthlyGoal) * 100)}%` }}
                        className="h-full bg-gradient-to-r from-teal-400 to-teal-600 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('whatsapp')}
                className="p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-all text-left flex flex-col gap-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
              >
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <MessageSquare size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Análise de WhatsApp</h3>
                  <p className="text-slate-500 dark:text-slate-400">Analise conversas, identifique dores e receba sugestões de mensagens matadoras.</p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-indigo-600 font-bold">
                  Abrir Ferramenta
                  <ArrowRight size={18} />
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('call')}
                className="p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-all text-left flex flex-col gap-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
              >
                <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <Phone size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Copiloto de Ligação</h3>
                  <p className="text-slate-500 dark:text-slate-400">Coaching em tempo real via áudio com transcrição e guia de SPIN Selling.</p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-rose-600 font-bold">
                  Iniciar Coaching
                  <ArrowRight size={18} />
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('qualification')}
                className="p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-all text-left flex flex-col gap-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
              >
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Gerador de Qualificação</h3>
                  <p className="text-slate-500 dark:text-slate-400">Gere resumos de qualificação prontos para copiar e colar no seu HubSpot.</p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-emerald-600 font-bold">
                  Gerar Qualificação
                  <ArrowRight size={18} />
                </div>
              </motion.button>
            </div>
          </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'qualification' ? (
            <motion.div 
              key="qualification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="p-8 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Gerador de Qualificação HubSpot</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Transforme notas de conversa em um resumo estruturado para o CRM</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea 
                    value={qualificationInput}
                    onChange={(e) => setQualificationInput(e.target.value)}
                    placeholder="Cole aqui as notas da conversa, informações do lead, segmento, software que usa, etc..."
                    className="w-full h-64 p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-mono"
                  />
                  
                  <button 
                    onClick={analyzeLeadQualification}
                    disabled={isQualifying || !qualificationInput.trim()}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {isQualifying ? (
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap size={20} />
                    )}
                    Gerar Qualificação HubSpot
                  </button>
                </div>

                {qualificationResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-10 space-y-8"
                  >
                    <div className="p-8 bg-slate-900 text-white rounded-2xl border border-slate-800 relative group">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <FileText size={14} />
                          Resumo Estruturado (HubSpot)
                        </h4>
                        <button 
                          onClick={() => navigator.clipboard.writeText(qualificationResult.hubspotSummary)}
                          className="p-2 bg-white/10 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20"
                          title="Copiar para o HubSpot"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-slate-300">
                        {qualificationResult.hubspotSummary}
                      </pre>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900">
                        <h4 className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 mb-3 tracking-widest">Informações Faltantes</h4>
                        <ul className="space-y-2">
                          {qualificationResult.missingInfo.map((info, i) => (
                            <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 bg-rose-400 rounded-full shrink-0" />
                              {info}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900">
                        <h4 className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400 mb-3 tracking-widest">Possíveis Objeções</h4>
                        <ul className="space-y-2">
                          {qualificationResult.objections.map((obj, i) => (
                            <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 bg-amber-400 rounded-full shrink-0" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Decisão de Agendamento</h4>
                        <Badge variant={
                          qualificationResult.status === 'Agendar' ? 'success' : 
                          qualificationResult.status === 'Cuidado' ? 'warning' : 'error'
                        }>
                          {qualificationResult.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                        "{qualificationResult.reasoning}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ) : activeTab === 'whatsapp' ? (
            <motion.div 
              key="whatsapp"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="p-8 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Análise de Conversa</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Cole a conversa do WhatsApp para receber insights estratégicos</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea 
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    placeholder="Ex: [14:30] Lead: Gostaria de saber mais sobre o BPO...
[14:31] SDR: Com certeza! Como você faz hoje?"
                    className="w-full h-64 p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-mono"
                  />
                  
                  <button 
                    onClick={analyzeWhatsapp}
                    disabled={isAnalyzingWhatsapp || !whatsappInput.trim()}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {isAnalyzingWhatsapp ? (
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap size={20} />
                    )}
                    Analisar Conversa
                  </button>
                </div>

                {whatsappAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-10 space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Resumo da Situação</h4>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {whatsappAnalysis.summary}
                        </p>
                      </div>
                      <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                        <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-3 tracking-widest">Próximo Passo Sugerido</h4>
                        <p className="text-indigo-900 dark:text-indigo-100 font-bold text-lg">
                          {whatsappAnalysis.nextStep}
                        </p>
                      </div>
                    </div>

                    <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900 relative group">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-widest flex items-center gap-2">
                          <MessageSquare size={14} />
                          Sugestão de Mensagem (Copie e envie)
                        </h4>
                        <button 
                          onClick={() => navigator.clipboard.writeText(whatsappAnalysis.suggestedMessage)}
                          className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Copiar Mensagem"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white italic leading-relaxed">
                        "{whatsappAnalysis.suggestedMessage}"
                      </p>
                    </div>

                    {whatsappAnalysis.objections.length > 0 && (
                      <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900">
                        <h4 className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 mb-4 tracking-widest flex items-center gap-2">
                          <ShieldAlert size={14} />
                          Fique atento a estas objeções
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {whatsappAnalysis.objections.map((obj, i) => (
                            <Badge key={i} variant="error">
                              {obj}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ) : activeTab === 'call' && (
            <motion.div 
              key="call"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {isLiveMode ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Live Status Bar */}
                  <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          audioLevel > 5 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                        )} />
                        {audioLevel > 5 && (
                          <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {audioLevel > 5 ? "Ouvindo sua chamada..." : "Aguardando áudio..."}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-4 bg-indigo-500/20 rounded-full overflow-hidden">
                          <div 
                            className="w-full bg-indigo-500 transition-all duration-75" 
                            style={{ height: `${Math.min(100, audioLevel)}%`, marginTop: 'auto' }} 
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">VOL</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                      <div className="flex items-center gap-2">
                        <Volume2 size={14} className={isSystemAudioActive ? "text-indigo-500" : "text-slate-300"} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Lead {isSystemAudioActive ? "ON" : "OFF"}</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                      <div className="flex items-center gap-2">
                        <Activity size={14} className={isScreenSharing ? "text-emerald-500" : "text-slate-300"} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tela {isScreenSharing ? "ON" : "OFF"}</span>
                      </div>
                    </div>
                  </div>
              {/* Lead Analysis Card */}
              {leadAnalysis && (
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                          <Target size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Análise do Lead</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Identificado via compartilhamento de tela</p>
                        </div>
                      </div>
                      <Badge variant={leadAnalysis.isIdeal ? 'success' : 'warning'}>
                        {leadAnalysis.isIdeal ? 'ICP Ideal' : 'Fora do ICP'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nome / Empresa</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">{leadAnalysis.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Segmento</p>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">{leadAnalysis.segment}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                          <Lightbulb size={16} />
                          <span className="text-xs font-bold uppercase">Abordagem Sugerida</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                          "{leadAnalysis.approach}"
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Real-time Insights */}
              <Card className={cn(
                "lg:col-span-2 p-8 bg-indigo-600 text-white relative overflow-hidden transition-all duration-300",
                showFlash ? "ring-4 ring-white/50 scale-[1.02]" : ""
              )}>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Lightbulb size={20} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">Fase Atual do SPIN</h3>
                        <p className="text-2xl font-black">{liveInsight?.phase || "Detectando..."}</p>
                      </div>
                    </div>
                    <Badge variant="success">Análise ao Vivo</Badge>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Dica do Coach</h4>
                      <p className="text-xl font-medium leading-relaxed">
                        {liveInsight?.tip || "Inicie a conversa entendendo o contexto atual do prospect."}
                      </p>
                    </div>

                    <div className="p-6 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm relative group">
                      <h4 className="text-xs font-bold uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
                        <MessageSquare size={14} />
                        Pergunta Sugerida (Diga isso ao lead)
                      </h4>
                      <AnimatePresence mode="wait">
                        <motion.p 
                          key={liveInsight?.suggestedQuestion}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="text-2xl font-bold italic text-white drop-shadow-sm"
                        >
                          "{liveInsight?.suggestedQuestion || "Como vocês gerenciam o financeiro da empresa hoje? É você mesmo quem faz?"}"
                        </motion.p>
                      </AnimatePresence>
                      <button 
                        onClick={() => {
                          if (liveInsight?.suggestedQuestion) {
                            navigator.clipboard.writeText(liveInsight.suggestedQuestion);
                          }
                        }}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Copiar Pergunta"
                      >
                        <FileText size={14} />
                      </button>
                    </div>

                    {liveInsight?.meetingHook && (
                      <div className="p-6 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 backdrop-blur-sm relative group animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-200 mb-3 flex items-center gap-2">
                          <ArrowRight size={14} />
                          Gancho para Reunião (Leve para o fechamento)
                        </h4>
                        <p className="text-xl font-bold italic text-white">
                          "{liveInsight.meetingHook}"
                        </p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(liveInsight.meetingHook!);
                          }}
                          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Copiar Gancho"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    )}

                    <button 
                      onClick={requestManualInsight}
                      className="w-full py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg shadow-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      <Zap size={20} className="text-amber-500" />
                      Solicitar Insight Agora
                    </button>
                  </div>
                </div>
                <Activity className="absolute -right-12 -bottom-12 text-white/5" size={300} />
              </Card>

              {/* Live Status & Sentiment */}
              <div className="space-y-6">
                {liveInsight?.transcription && (
                  <Card className="p-6 border-indigo-100 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-900/10">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Mic size={14} />
                      Transcrição (Lead)
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                      "{liveInsight.transcription}"
                    </p>
                  </Card>
                )}

                <Card className="p-6">
                  <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Vibe da Chamada</h3>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                      liveInsight?.sentiment === 'positivo' ? "bg-emerald-100 text-emerald-600" :
                      liveInsight?.sentiment === 'negativo' ? "bg-rose-100 text-rose-600" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {liveInsight?.sentiment === 'positivo' ? <TrendingUp size={24} /> : <Volume2 size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-lg capitalize">{liveInsight?.sentiment || "Neutro"}</p>
                      <p className="text-xs text-slate-500">Monitoramento de sentimento em tempo real</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Progresso SPIN</h3>
                  <div className="space-y-4">
                    {['Situação', 'Problema', 'Implicação', 'Necessidade'].map((p, i) => (
                      <div key={p} className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                          liveInsight?.phase === p ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                          {i + 1}
                        </div>
                        <span className={cn(
                          "text-sm font-medium",
                          liveInsight?.phase === p ? "text-slate-900 dark:text-white" : "text-slate-400"
                        )}>{p}</span>
                        {liveInsight?.phase === p && <ArrowRight size={14} className="ml-auto text-indigo-600 animate-bounce-x" />}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
          ) : !analysis ? (
            <motion.div 
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-8 text-indigo-600 dark:text-indigo-400 shadow-inner">
                <Phone size={40} className="animate-bounce-slow" />
              </div>
              <h3 className="text-3xl font-bold mb-4 dark:text-white">Pronto para a sua próxima ligação?</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mb-10 text-lg leading-relaxed">
                O Copiloto SDR Marvee está pronto para te guiar em tempo real. Clique no botão abaixo ou na barra lateral para iniciar o coaching ao vivo com SPIN Selling.
              </p>
              
              <button 
                onClick={startLiveCoaching}
                disabled={connectionStatus === 'connecting'}
                className={cn(
                  "px-10 py-5 text-white rounded-2xl font-bold text-xl shadow-2xl transition-all flex items-center gap-4 active:scale-95",
                  connectionStatus === 'connecting' 
                    ? "bg-slate-400 cursor-not-allowed" 
                    : "bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105"
                )}
              >
                {connectionStatus === 'connecting' ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Zap size={24} className="text-amber-400" />
                )}
                {connectionStatus === 'connecting' ? "Conectando ao Coach..." : "Iniciar Chamada ao Vivo Agora"}
              </button>

              {connectionStatus === 'connecting' && (
                <p className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">
                  Preparando inteligência artificial e permissões...
                </p>
              )}

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <Mic size={24} className="text-indigo-500 mb-3" />
                  <h4 className="font-bold mb-1">Áudio em Tempo Real</h4>
                  <p className="text-xs text-slate-500">Captura automática do seu microfone e do lead.</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <Target size={24} className="text-emerald-500 mb-3" />
                  <h4 className="font-bold mb-1">Guia SPIN Selling</h4>
                  <p className="text-xs text-slate-500">Insights baseados na fase atual da sua conversa.</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <Download size={24} className="text-amber-500 mb-3" />
                  <h4 className="font-bold mb-1">Gravação Automática</h4>
                  <p className="text-xs text-slate-500">Download da ligação ao encerrar a sessão.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Summary & Score */}
              <Card className="lg:col-span-2 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Resumo da Chamada</h3>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{analysis.summary}</p>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Nota</span>
                    <span className="text-4xl font-black text-indigo-900 dark:text-indigo-100">{analysis.feedback.score}</span>
                    <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500">/ 10</span>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Pontos Fortes
                    </h4>
                    <ul className="space-y-2">
                      {analysis.feedback.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-500" />
                      Melhorias
                    </h4>
                    <ul className="space-y-2">
                      {analysis.feedback.improvements.map((s, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              {/* Sentiment Chart */}
              <Card className="p-6 flex flex-col items-center justify-center">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 w-full">Equilíbrio de Sentimento</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sentimentData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold">Nível de Engajamento</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    {analysis.sentiment.prospect > 60 ? "Alto Interesse" : "Neutro"}
                  </p>
                </div>
              </Card>

              {/* BANT Qualification */}
              <Card className="p-6">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Qualificação BANT
                </h3>
                <div className="space-y-6">
                  {Object.entries(analysis.bant).map(([key, value]) => (
                    <div key={key} className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-indigo-500" />
                      <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{key}</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{value || "Não identificado"}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Objections */}
              <Card className="p-6 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Tratamento de Objeções</h3>
                <div className="space-y-4">
                  {analysis.objections.map((obj, i) => (
                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-rose-500 shrink-0 shadow-sm">
                        <AlertCircle size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200">{obj.objection}</h4>
                          <Badge variant={obj.effectiveness === 'high' ? 'success' : obj.effectiveness === 'medium' ? 'warning' : 'error'}>
                            {obj.effectiveness === 'high' ? 'Alta' : obj.effectiveness === 'medium' ? 'Média' : 'Baixa'} eficácia
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">" {obj.handling} "</p>
                      </div>
                    </div>
                  ))}
                  {analysis.objections.length === 0 && (
                    <p className="text-center text-slate-400 dark:text-slate-600 py-8 italic">Nenhuma objeção identificada nesta chamada.</p>
                  )}
                </div>
              </Card>

              {/* Next Steps */}
              <Card className="p-6 bg-indigo-600 text-white">
                <h3 className="text-sm font-bold opacity-70 uppercase tracking-widest mb-6">Próximos Passos</h3>
                <ul className="space-y-4">
                  {analysis.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ChevronRight size={14} />
                      </div>
                      <span className="text-sm font-medium">{step}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full mt-8 py-3 bg-white text-indigo-600 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors">
                  Sincronizar com CRM
                </button>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </main>
</div>
);
}
