import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  History, 
  Copy, 
  Check, 
  AlertTriangle, 
  Search,
  Pill,
  ShieldAlert,
  Plus,
  X,
  Layers,
  ArrowRight,
  User,
  Users,
  FileText,
  Activity,
  Heart,
  ChevronDown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Lock,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatDate } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Patient, Sale } from '../types';

const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-base sm:text-lg font-bold tracking-tight text-blue-900 dark:text-blue-200 border-b border-blue-500/20 pb-1.5 my-2 flex items-center gap-2">
      <span className="inline-block w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 border-l-3 border-blue-500 pl-2 my-2 py-0.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-r">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 my-1.5 flex items-center gap-1.5">
      {children}
    </h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 my-1 flex items-center gap-1">
      {children}
    </h4>
  ),
  p: ({ children }: any) => (
    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed my-1.5">
      {children}
    </p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/60 px-1 py-0.5 rounded text-[12px] sm:text-[13px]">
      {children}
    </strong>
  ),
  ul: ({ children }: any) => (
    <ul className="my-1.5 space-y-1 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="my-1.5 space-y-1 pl-4 list-decimal marker:text-blue-600 marker:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 flex items-start gap-2 leading-relaxed">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5"></span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-2 border-l-3 border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-400 p-2.5 rounded-r-lg text-xs text-amber-900 dark:text-amber-200 font-medium">
      <div className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">
        <AlertTriangle size={12} /> Clinical Safety Protocol
      </div>
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match) {
      return (
        <div className="my-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-100 font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      );
    }
    return (
      <code className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800">
        {children}
      </code>
    );
  },
  table: ({ children }: any) => (
    <div className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-700">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60">
      {children}
    </tbody>
  ),
  tr: ({ children }: any) => (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }: any) => (
    <th className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
      {children}
    </td>
  )
};

const STORAGE_KEY = 'satyam_ai_medicine_chat';

const SUGGESTED_QUERIES = [
  'What is the use of Dolo 650?',
  'Can I take Dolo 650 and Combiflam together?',
  'Check interaction: Atorvastatin + Azithromycin',
  'Is it safe to take Telmisartan and Spironolactone?',
  'Interaction check: Ciprofloxacin and Antacid Gel',
  'What are the uses and dosage of Pantoprazole 40mg?'
];

const COMMON_DRUG_PRESETS = [
  'Paracetamol',
  'Ibuprofen',
  'Atorvastatin',
  'Azithromycin',
  'Telmisartan',
  'Spironolactone',
  'Ciprofloxacin',
  'Antacid Gel',
  'Warfarin',
  'Aspirin',
  'Augmentin 625',
  'Pantoprazole',
  'Cetirizine',
  'Metformin'
];

export interface AIMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  voiceStatus?: string;
  patientData?: Patient;
  isPatientLookup?: boolean;
  searchedPatientQuery?: string;
}

export interface AIAssistantProps {
  onNavigate?: (tab: string) => void;
}

/**
 * Dedicated parser for voice commands like:
 * "Find patient Rahul", "Search patient Sharma", "Lookup patient Priya",
 * "Open patient Rajesh", "मरीज राहुल को खोजें", etc.
 */
export const parsePatientVoiceCommand = (text: string): { isCommand: boolean; patientQuery: string } => {
  const clean = text.trim();
  if (!clean) return { isCommand: false, patientQuery: '' };

  const patterns = [
    /^(?:find|search|lookup|look\s+up|open|goto|go\s+to|show|view)\s+patient(?:\s+record|\s+profile|\s+chart|\s+file)?(?:\s+for)?\s*[:\-\s]\s*(.+)$/i,
    /^(?:find|search|lookup|look\s+up|open|goto|go\s+to|show|view)\s+patient\s+(.+)$/i,
    /^(?:patient\s+lookup|patient\s+search|patient\s+find)\s*[:\-\s]\s*(.+)$/i,
    /^(?:मरीज\s+खोजें|मरीज\s+ढूंढें|मरीज\s+का\s+रिकॉर्ड\s+खोलें|मरीज\s+दिखाएं)\s*[:\-\s]\s*(.+)$/i,
    /^मरीज\s+(.+)\s*(?:खोजें|ढूंढें|का\s+रिकॉर्ड\s+खोलें|का\s+रिकॉर्ड\s+दिखाएं|दिखाएं)$/i
  ];

  for (const p of patterns) {
    const match = clean.match(p);
    if (match && match[1]) {
      const q = match[1].trim().replace(/[?.!]+$/, '');
      if (q.length > 0) {
        return { isCommand: true, patientQuery: q };
      }
    }
  }

  // Exact command without name provided
  if (/^(?:find|search|lookup|open)\s+patient$/i.test(clean)) {
    return { isCommand: true, patientQuery: '' };
  }

  return { isCommand: false, patientQuery: '' };
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ onNavigate }) => {
  const { tText, language } = useLanguage();
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch (e) {
      console.error("Failed to load medicine chat history", e);
    }
    return [
      {
        role: 'bot',
        text: `### 💊 **Medicine Intelligence & Patient Interaction Assistant**\n\nAsk about any medicine, cross-reference multiple drugs for **Drug-Drug Interactions (DDI)**, or use voice commands to find patients:\n* 🗣️ **Voice Command**: Say **"Find patient [Name]"** to instantly jump to that patient's record in the Patients module\n* 💊 **Medicine Uses, Active Salts & Dosage Guidelines**\n* 🛡️ **Standardized Drug-Drug Interaction (DDI) Cross-Check**\n* 👤 **Patient Consultation Summary & Past Dispensed Prescriptions**\n\nType any query below, click 🎙️ to speak, or use the quick tools.`,
        timestamp: new Date()
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showInteractionBuilder, setShowInteractionBuilder] = useState(false);
  const [selectedPills, setSelectedPills] = useState<string[]>(['Paracetamol', 'Combiflam']);
  const [customPillInput, setCustomPillInput] = useState('');
  
  // Patient Context State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');

  // Voice Dictation & Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showMicPermissionGuide, setShowMicPermissionGuide] = useState(false);
  const [isCheckingMic, setIsCheckingMic] = useState(false);
  const [dictationLang, setDictationLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const recognitionRef = useRef<any>(null);
  const isSpeechSupported = typeof window !== 'undefined' && (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

  // Text-To-Speech (TTS) Voice Status Confirmation State
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('satyam_ai_tts_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);
  const wasVoiceOriginRef = useRef<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize dictation language with current language
  useEffect(() => {
    setDictationLang(language === 'hi' ? 'hi-IN' : 'en-IN');
  }, [language]);

  // Persist TTS preference
  useEffect(() => {
    try {
      localStorage.setItem('satyam_ai_tts_enabled', String(ttsEnabled));
    } catch (_) {}
  }, [ttsEnabled]);

  // Clean up speech recognition & synthesis on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
    };
  }, []);

  // Text-To-Speech Synthesis Function for immediate non-visual status updates
  const speakTTS = (textToSpeak: string, force: boolean = false) => {
    if ((!ttsEnabled && !force) || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = dictationLang;

      setCurrentlySpeakingText(textToSpeak);

      utterance.onend = () => {
        setCurrentlySpeakingText(null);
      };
      utterance.onerror = () => {
        setCurrentlySpeakingText(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis playback error:', err);
      setCurrentlySpeakingText(null);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    setCurrentlySpeakingText(null);
  };

  // Generate clear, concise non-visual status confirmations based on AI analysis
  const generateVoiceStatusConfirmation = (query: string, resultText: string, lang: 'en-IN' | 'hi-IN'): string => {
    const queryLower = query.toLowerCase();
    const textLower = resultText.toLowerCase();

    const isDDI = queryLower.includes('interaction') || 
                  queryLower.includes('ddi') || 
                  queryLower.includes('together') || 
                  queryLower.includes('cross-check') ||
                  queryLower.includes('check potential') || 
                  textLower.includes('interaction');

    const isPatient = queryLower.includes('patient') || 
                      queryLower.includes('consultation') || 
                      queryLower.includes('prescription') || 
                      queryLower.includes('history') || 
                      queryLower.includes('vitals') || 
                      queryLower.includes('note');

    const hasHighRisk = textLower.includes('high risk') || 
                        textLower.includes('severe') || 
                        textLower.includes('major interaction') || 
                        textLower.includes('contraindicated') || 
                        textLower.includes('danger') || 
                        textLower.includes('alert') || 
                        textLower.includes('avoid combination') ||
                        textLower.includes('🚨');

    const hasModerate = textLower.includes('moderate') || 
                        textLower.includes('caution') || 
                        textLower.includes('monitor') || 
                        textLower.includes('⚠️');

    if (lang === 'hi-IN') {
      if (isDDI) {
        if (hasHighRisk) {
          return 'ड्रग इंटरेक्शन जांच पूरी हुई। उच्च जोखिम चेतावनी पाई गई है, सावधानी बरतें।';
        } else if (hasModerate) {
          return 'ड्रग इंटरेक्शन जांच पूरी हुई। मध्यम स्तर की सावधानी की सलाह दी जाती है।';
        } else {
          return 'ड्रग इंटरेक्शन जांच पूरी हुई, कोई उच्च जोखिम नहीं मिला।';
        }
      }
      if (isPatient) {
        return 'मरीज का परामर्श विवरण और पूर्व नुस्खे का इतिहास सफलतापूर्वक प्राप्त हुआ।';
      }
      return 'दवा की क्लिनिकल जानकारी सफलतापूर्वक प्राप्त हो गई है।';
    } else {
      if (isDDI) {
        if (hasHighRisk) {
          return 'Drug interaction check completed. High risk interaction alert detected.';
        } else if (hasModerate) {
          return 'Drug interaction check completed. Moderate interaction noted, please review.';
        } else {
          return 'Drug interaction check completed, no high-risk flags found.';
        }
      }
      if (isPatient) {
        return 'Patient consultation history and prescription records retrieved successfully.';
      }
      // General medicine query
      const medMatch = query.match(/(?:for|about|uses of|dosage of|info on|details of)\s+([a-zA-Z0-9\s]+)/i);
      if (medMatch && medMatch[1]) {
        return `Clinical inquiry completed for ${medMatch[1].trim().slice(0, 30)}.`;
      }
      return 'Clinical inquiry completed successfully.';
    }
  };

  // Voice dictation handlers
  const startListening = async (presetPrefix?: string) => {
    wasVoiceOriginRef.current = true;
    setSpeechError(null);
    setIsCheckingMic(true);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSpeechError(tText('Voice dictation is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'इस ब्राउज़र में वॉयस डिक्टेशन समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।'));
      setShowMicPermissionGuide(true);
      setIsCheckingMic(false);
      return;
    }

    // Proactively trigger browser permission dialog via getUserMedia if supported
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release audio tracks immediately
        stream.getTracks().forEach(track => track.stop());
        setShowMicPermissionGuide(false);
      } catch (micErr: any) {
        console.warn('Microphone getUserMedia permission notice:', micErr);
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError' || micErr.message?.includes('denied') || micErr.message?.includes('dismissed')) {
          setSpeechError(tText('Microphone access denied. Please allow microphone permissions in your browser to dictate notes.', 'माइक्रोफोन एक्सेस अस्वीकृत। कृपया ब्राउज़र में माइक्रोफोन की अनुमति दें।'));
          setShowMicPermissionGuide(true);
          setIsCheckingMic(false);
          return;
        }
      }
    }

    setIsCheckingMic(false);

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = dictationLang;

      let baseText = input.trim();
      if (presetPrefix && !baseText.includes(presetPrefix)) {
        baseText = baseText ? `${baseText} ${presetPrefix}` : presetPrefix;
        setInput(baseText);
      }

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setSpeechTranscript('');
        setShowMicPermissionGuide(false);
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += trans;
          } else {
            interimText += trans;
          }
        }

        if (finalText) {
          setInput(prev => {
            const cleanPrev = prev.trim();
            return cleanPrev ? `${cleanPrev} ${finalText.trim()}` : finalText.trim();
          });
          setSpeechTranscript('');
        } else {
          setSpeechTranscript(interimText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError(tText('Microphone access denied. Please allow microphone permissions in your browser to dictate notes.', 'माइक्रोफोन एक्सेस अस्वीकृत। कृपया ब्राउज़र में माइक्रोफोन की अनुमति दें।'));
          setShowMicPermissionGuide(true);
        } else if (event.error === 'no-speech') {
          // Normal silence, ignore
        } else {
          setSpeechError(tText(`Voice recognition notice: ${event.error}`, `वॉयस डिक्टेशन सूचना: ${event.error}`));
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to initialize speech recognition', err);
      setSpeechError(tText('Failed to start microphone. Please check browser permissions or open in a new tab.', 'माइक्रोफ़ोन शुरू करने में विफल रहा। कृपया ब्राउज़र अनुमति जांचें।'));
      setShowMicPermissionGuide(true);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setSpeechTranscript('');
    inputRef.current?.focus();
  };

  const toggleListening = (presetPrefix?: string) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(presetPrefix);
    }
  };

  // Load patients and sales from Firestore on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const patientSnap = await getDocs(collection(db, 'patients'));
        const patientList = patientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        setPatients(patientList);

        const salesQuery = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(150));
        const salesSnap = await getDocs(salesQuery);
        const salesList = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        setSalesHistory(salesList);
      } catch (err) {
        console.warn("Could not load patients or sales for AI Assistant:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  // Helper to construct rich patient context payload
  const buildPatientPayload = (patient: Patient) => {
    // Find matching sales by name or mobile
    const matchedSales = salesHistory.filter(s => {
      const matchName = s.customerName && patient.name && 
        (s.customerName.toLowerCase().includes(patient.name.toLowerCase()) || 
         patient.name.toLowerCase().includes(s.customerName.toLowerCase()));
      const matchMobile = s.customerMobile && patient.mobile && s.customerMobile === patient.mobile;
      return matchName || matchMobile;
    });

    const recentPrescriptions = matchedSales.slice(0, 6).map(s => ({
      id: s.id,
      date: s.timestamp ? formatDate(s.timestamp) : 'Recent',
      medicines: (s.items || []).map(i => i.name || i.medicineName || 'Medicine'),
      totalAmount: s.totalAmount || 0
    }));

    // Calculate frequent medicines
    const medicineCounts: Record<string, number> = {};
    matchedSales.forEach(s => {
      (s.items || []).forEach(item => {
        const medName = item.name || item.medicineName;
        if (medName) {
          medicineCounts[medName] = (medicineCounts[medName] || 0) + (item.quantity || 1);
        }
      });
    });

    const frequentMedicines = Object.entries(medicineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name} (${count}x dispensed)`);

    return {
      id: patient.id,
      name: patient.name,
      mobile: patient.mobile,
      age: patient.age,
      gender: patient.gender,
      allergies: patient.allergies || [],
      recentNotes: patient.notes ? patient.notes.slice(-5).reverse() : [],
      vitals: patient.vitals ? patient.vitals.slice(-3).reverse() : [],
      recentPrescriptions,
      frequentMedicines,
      totalVisits: matchedSales.length || (patient.notes ? patient.notes.length : 1)
    };
  };

  // Detect patient in query or use selected patient
  const resolvePatientContext = (queryText: string) => {
    if (selectedPatient) {
      return buildPatientPayload(selectedPatient);
    }

    const queryLower = queryText.toLowerCase();
    // Search for patient names mentioned in the text
    for (const p of patients) {
      if (!p.name) continue;
      const nameLower = p.name.toLowerCase();
      const nameParts = nameLower.split(' ').filter(part => part.length >= 3);
      
      const fullMatch = queryLower.includes(nameLower);
      const partialMatch = nameParts.some(part => 
        queryLower.includes(part) && 
        (queryLower.includes('patient') || queryLower.includes('prescription') || queryLower.includes('history') || queryLower.includes('for') || queryLower.includes('mr') || queryLower.includes('mrs') || queryLower.includes('dr'))
      );
      const mobileMatch = p.mobile && p.mobile.length >= 6 && queryLower.includes(p.mobile);

      if (fullMatch || partialMatch || mobileMatch) {
        return buildPatientPayload(p);
      }
    }
    return null;
  };

  // Dedicated handler for "Find patient [Name]" voice commands
  const handleExecutePatientLookupCommand = (patientQuery: string, isVoiceAction: boolean) => {
    const queryTerm = patientQuery.trim();
    
    if (!queryTerm) {
      const clarifyText = dictationLang === 'hi-IN'
        ? 'कृपया उस मरीज का नाम बताएं जिसे आप खोजना चाहते हैं।'
        : 'Please specify the patient name or mobile number you want to find.';
      
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `### 🗣️ **Patient Voice Lookup Command**\n\n${clarifyText}\n\n*Example*: Speak **"Find patient Rahul"** or click on any registered patient below.`,
        timestamp: new Date(),
        voiceStatus: clarifyText
      }]);

      if (isVoiceAction || ttsEnabled) {
        speakTTS(clarifyText);
      }
      setIsTyping(false);
      wasVoiceOriginRef.current = false;
      return;
    }

    const qLower = queryTerm.toLowerCase();
    
    // Search in loaded patients list
    let matchedPatient = patients.find(p => p.name && p.name.toLowerCase() === qLower);
    if (!matchedPatient) {
      matchedPatient = patients.find(p => p.mobile && p.mobile === queryTerm);
    }
    if (!matchedPatient) {
      matchedPatient = patients.find(p => p.name && p.name.toLowerCase().includes(qLower));
    }
    if (!matchedPatient) {
      matchedPatient = patients.find(p => p.name && qLower.includes(p.name.toLowerCase()));
    }
    if (!matchedPatient) {
      matchedPatient = patients.find(p => p.mobile && p.mobile.includes(queryTerm));
    }

    if (matchedPatient) {
      const allergyWarning = matchedPatient.allergies && matchedPatient.allergies.length > 0
        ? `\n* ⚠️ **Known Drug Allergies**: **${matchedPatient.allergies.join(', ')}**`
        : `\n* **Allergies**: None recorded`;

      const voiceStatus = dictationLang === 'hi-IN'
        ? `मरीज ${matchedPatient.name} का रिकॉर्ड मिल गया है। पेशेंट चार्ट खोला जा रहा है।`
        : `Patient record found for ${matchedPatient.name}. Navigating to patient profile now.`;

      const responseMarkdown = `### 🔍 **Patient Record Located: ${matchedPatient.name}**\n\n* **Patient Name**: **${matchedPatient.name}**\n* **Contact Mobile**: \`${matchedPatient.mobile || 'N/A'}\`\n* **Demographics**: ${matchedPatient.age ? `${matchedPatient.age} Yrs` : 'Age N/A'} • ${matchedPatient.gender || 'Patient'}${allergyWarning}\n* **Consultations**: ${matchedPatient.notes ? matchedPatient.notes.length : 0} clinical note(s) recorded\n\n> ⚡ **Voice Command Executed**: Automatically switching to the **Patients** view and opening **${matchedPatient.name}**'s complete clinical record for lookup.`;

      setMessages(prev => [...prev, {
        role: 'bot',
        text: responseMarkdown,
        timestamp: new Date(),
        voiceStatus,
        patientData: matchedPatient,
        isPatientLookup: true,
        searchedPatientQuery: queryTerm
      }]);

      if (isVoiceAction || ttsEnabled) {
        speakTTS(voiceStatus);
      }

      // Automatically dispatch navigation to Patients tab
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'patients' } }));
      window.dispatchEvent(new CustomEvent('open-patient-record', {
        detail: {
          patientId: matchedPatient.id,
          patient: matchedPatient,
          patientName: matchedPatient.name,
          searchTerm: matchedPatient.name
        }
      }));

      if (onNavigate) {
        onNavigate('patients');
      }
    } else {
      const voiceStatus = dictationLang === 'hi-IN'
        ? `"${queryTerm}" के लिए कोई मरीज रिकॉर्ड नहीं मिला। खोज फ़िल्टर के साथ पेशेंट डायरेक्टरी खोली जा रही है।`
        : `No registered patient matched "${queryTerm}". Opening Patients directory with search filter applied.`;

      const responseMarkdown = `### 🔍 **Patient Voice Lookup: "${queryTerm}"**\n\nNo exact registered patient file currently matches **"${queryTerm}"** in local records.\n\n> 📋 **Directory Filter Applied**: Navigating to the **Patients** module with search filter \`${queryTerm}\` applied so staff can view partial matches or register a new patient.`;

      setMessages(prev => [...prev, {
        role: 'bot',
        text: responseMarkdown,
        timestamp: new Date(),
        voiceStatus,
        isPatientLookup: true,
        searchedPatientQuery: queryTerm
      }]);

      if (isVoiceAction || ttsEnabled) {
        speakTTS(voiceStatus);
      }

      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'patients' } }));
      window.dispatchEvent(new CustomEvent('open-patient-record', {
        detail: {
          searchTerm: queryTerm,
          patientName: queryTerm
        }
      }));

      if (onNavigate) {
        onNavigate('patients');
      }
    }

    setIsTyping(false);
    wasVoiceOriginRef.current = false;
  };

  const handleSend = async (customPrompt?: string, isVoiceCall: boolean = false) => {
    const queryText = (customPrompt || input).trim();
    if (!queryText) return;

    const isVoiceAction = isVoiceCall || wasVoiceOriginRef.current || isListening;
    if (isListening) {
      stopListening();
    }

    const userMsg = { role: 'user' as const, text: queryText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Check if query is a dedicated "Find patient [Name]" command
    const patientVoiceCmd = parsePatientVoiceCommand(queryText);
    if (patientVoiceCmd.isCommand) {
      setIsTyping(true);
      setTimeout(() => {
        handleExecutePatientLookupCommand(patientVoiceCmd.patientQuery, isVoiceAction);
      }, 120);
      return;
    }

    setIsTyping(true);

    const detectedPatientPayload = resolvePatientContext(queryText);

    try {
      const response = await fetch('/api/ai/medicine-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineName: queryText,
          queryType: detectedPatientPayload 
            ? `Patient Interaction & Prescription History Inquiry for ${detectedPatientPayload.name}` 
            : 'Medicine and Drug Interaction Inquiry',
          patientContext: detectedPatientPayload
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Query failed');
      }

      const statusConfirmation = generateVoiceStatusConfirmation(queryText, data.result || '', dictationLang);

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.result || 'No medicine information returned.',
        timestamp: new Date(),
        voiceStatus: statusConfirmation
      }]);

      // Provide immediate non-visual status update via TTS
      if (isVoiceAction || ttsEnabled) {
        speakTTS(statusConfirmation);
      }
    } catch (err: any) {
      console.error("Medicine AI Assistant error:", err);
      const errStatus = dictationLang === 'hi-IN'
        ? 'क्लिनिकल पूछताछ में त्रुटि हुई। कृपया पुनः प्रयास करें।'
        : 'Clinical database inquiry could not be completed. Please try again.';
      
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `⚠️ **Clinical Database Notice**\n${err.message || 'Unable to retrieve details at this moment.'}\n\n*Please verify the medicine or patient name and try again.*`,
        timestamp: new Date(),
        voiceStatus: errStatus
      }]);

      if (isVoiceAction || ttsEnabled) {
        speakTTS(errStatus);
      }
    } finally {
      setIsTyping(false);
      wasVoiceOriginRef.current = false;
    }
  };

  const handleRunInteractionCheck = () => {
    if (selectedPills.length < 2) return;
    const prompt = `Check potential Drug-Drug Interactions (DDI) between: ${selectedPills.join(' + ')}${selectedPatient ? ` for patient ${selectedPatient.name}` : ''}`;
    wasVoiceOriginRef.current = true;
    handleSend(prompt, true);
    setShowInteractionBuilder(false);
  };

  const addPill = (name: string) => {
    const clean = name.trim();
    if (clean && !selectedPills.includes(clean)) {
      setSelectedPills(prev => [...prev, clean]);
    }
    setCustomPillInput('');
  };

  const removePill = (name: string) => {
    setSelectedPills(prev => prev.filter(p => p !== name));
  };

  const clearHistory = () => {
    const initialMsg = {
      role: 'bot' as const,
      text: `### 💊 **Medicine Intelligence & Patient Interaction Assistant**\n\nAsk about any single medicine, cross-reference multiple medicines for drug interactions (DDI), or mention a patient name to review their consultation summary and prescription history.`,
      timestamp: new Date()
    };
    setMessages([initialMsg]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return patients.slice(0, 8);
    const term = patientSearchTerm.toLowerCase();
    return patients.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.mobile && p.mobile.includes(term))
    ).slice(0, 10);
  }, [patients, patientSearchTerm]);

  return (
    <div id="ai-assistant-page" className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[580px]">
      {/* Clean Header Bar */}
      <div className="flex items-center justify-between py-3 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Pill size={18} />
          </div>
          <div>
            <h2 id="ai-assistant-title" className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{tText('Medicine & Patient Intelligence Assistant', 'दवा और मरीज इंटरेक्शन सहायक')}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                AI + DDI + Patient History
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tText('Clinical uses, DDI cross-checks, patient consultation summaries & past prescriptions', 'दवा उपयोग, DDI जांच, मरीज की पिछली बातचीत और नुस्खों का सारांश')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Patient Context Linker Button */}
          <div className="relative">
            <button
              id="toggle-patient-context-btn"
              onClick={() => setShowPatientDropdown(!showPatientDropdown)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer border",
                selectedPatient
                  ? selectedPatient.allergies && selectedPatient.allergies.length > 0
                    ? "bg-red-50 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              )}
            >
              <User size={13} className={selectedPatient ? (selectedPatient.allergies && selectedPatient.allergies.length > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400") : "text-slate-500"} />
              <span className="truncate max-w-[90px] sm:max-w-[130px]">
                {selectedPatient ? selectedPatient.name : tText('Link Patient', 'मरीज जोड़ें')}
              </span>
              {selectedPatient?.allergies && selectedPatient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  <ShieldAlert size={9} />
                  <span>Allergy</span>
                </span>
              )}
              <ChevronDown size={12} className="opacity-60" />
            </button>

            {/* Patient Selector Popover */}
            {showPatientDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-2.5 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Users size={13} className="text-blue-600" />
                    {tText('Select Patient Record', 'मरीज का चयन करें')}
                  </span>
                  {selectedPatient && (
                    <button
                      onClick={() => {
                        setSelectedPatient(null);
                        setShowPatientDropdown(false);
                      }}
                      className="text-[11px] text-red-500 hover:underline cursor-pointer"
                    >
                      {tText('Unlink', 'हटाएं')}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                    placeholder={tText('Search by name or mobile...', 'नाम या मोबाइल से खोजें...')}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 dark:text-slate-100"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pt-1">
                  {filteredPatients.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-2">
                      {tText('No patients found', 'कोई मरीज नहीं मिला')}
                    </p>
                  ) : (
                    filteredPatients.map(p => {
                      const hasAllergies = p.allergies && p.allergies.length > 0;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p);
                            setShowPatientDropdown(false);
                          }}
                          className={cn(
                            "w-full text-left p-2 rounded-lg text-xs flex flex-col gap-1 transition-colors cursor-pointer border",
                            selectedPatient?.id === p.id 
                              ? "bg-blue-50/80 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 font-bold text-blue-900 dark:text-blue-200" 
                              : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100">{p.name}</p>
                              {hasAllergies && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-[10px] font-bold">
                                  <ShieldAlert size={10} className="text-red-600" />
                                  <span>Allergic</span>
                                </span>
                              )}
                            </div>
                            {selectedPatient?.id === p.id && (
                              <Check size={13} className="text-blue-600 shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{p.mobile || 'No mobile'} {p.age ? `• ${p.age}y` : ''}</span>
                            {hasAllergies && (
                              <span className="text-red-600 dark:text-red-400 font-medium truncate max-w-[130px]">
                                {p.allergies?.join(', ')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            id="toggle-ai-tts-btn"
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (next) {
                speakTTS(language === 'hi' ? 'वॉयस स्टेटस पुष्टिकरण सक्षम है।' : 'Voice status confirmation enabled.', true);
              } else {
                stopSpeaking();
              }
            }}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer border",
              ttsEnabled 
                ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800" 
                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
            )}
            title={ttsEnabled ? tText('Voice Status Confirmation: ON (Click to mute)', 'वॉयस स्टेटस पुष्टि: चालू (म्यूट करने के लिए क्लिक करें)') : tText('Voice Status Confirmation: MUTED (Click to enable)', 'वॉयस स्टेटस पुष्टि: म्यूट (चालू करने के लिए क्लिक करें)')}
          >
            {ttsEnabled ? (
              <Volume2 size={13} className="text-indigo-600 dark:text-indigo-400" />
            ) : (
              <VolumeX size={13} className="text-slate-400" />
            )}
            <span className="hidden sm:inline">{ttsEnabled ? tText('Voice Status ON', 'वॉयस स्टेटस चालू') : tText('Muted', 'म्यूट')}</span>
          </button>

          <button
            id="toggle-ddi-builder-btn"
            onClick={() => setShowInteractionBuilder(!showInteractionBuilder)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer border",
              showInteractionBuilder 
                ? "bg-amber-500 text-white border-amber-600 dark:bg-amber-600" 
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800"
            )}
          >
            <ShieldAlert size={14} />
            <span className="hidden sm:inline">{tText('Multi-Drug Checker', 'मल्टी-ड्रग चेकर')}</span>
            <span className="sm:hidden">{tText('DDI', 'DDI')}</span>
          </button>

          <button
            id="clear-ai-history-btn"
            onClick={clearHistory}
            title={tText('Clear Conversation', 'बातचीत साफ करें')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <History size={14} />
            <span className="hidden sm:inline">{tText('Clear', 'साफ करें')}</span>
          </button>
        </div>
      </div>

      {/* Prominent Drug Allergy Safety Warning Banner */}
      {selectedPatient && selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
        <div 
          id="ai-patient-allergy-alert-banner"
          className="bg-red-50/90 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900/60 px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/70 text-red-700 dark:text-red-300 shrink-0">
              <ShieldAlert size={16} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-red-900 dark:text-red-100">
                  {tText('PATIENT DRUG ALLERGY WARNING', 'मरीज ड्रग एलर्जी चेतावनी')}:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {selectedPatient.name}
                </span>
              </div>
              <p className="text-[11px] text-red-800 dark:text-red-300 font-medium truncate">
                {tText('Listed Allergies:', 'दर्ज एलर्जी:')}{' '}
                <span className="font-bold underline decoration-red-400 bg-red-100/90 dark:bg-red-900/80 px-1.5 py-0.5 rounded text-red-950 dark:text-red-100">
                  {selectedPatient.allergies.join(', ')}
                </span>
                {' '}— {tText('Check all prescribed salts before dispensing.', 'दवा देने से पहले सभी साल्ट्स की जांच करें।')}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 animate-pulse">
              <AlertTriangle size={11} />
              <span>{tText('High Alert', 'उच्च सतर्कता')}</span>
            </span>
          </div>
        </div>
      )}

      {/* Multi-Medicine Interaction Quick Builder Drawer */}
      <AnimatePresence>
        {showInteractionBuilder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400" />
                <span>{tText('Cross-Reference Multiple Medicines for Drug Interactions (DDI)', 'ड्रग इंटरेक्शन (DDI) के लिए कई दवाओं की जांच करें')}</span>
              </div>
              <button 
                onClick={() => setShowInteractionBuilder(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>

            {/* Selected Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {selectedPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-2xs"
                >
                  <Pill size={12} className="text-amber-600" />
                  <span>{pill}</span>
                  <button 
                    onClick={() => removePill(pill)}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {/* Add Custom Drug Input */}
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={customPillInput}
                  onChange={(e) => setCustomPillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPill(customPillInput);
                    }
                  }}
                  placeholder={tText('+ Add medicine name...', '+ दवा का नाम जोड़ें...')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 w-36"
                />
                {customPillInput.trim() && (
                  <button
                    onClick={() => addPill(customPillInput)}
                    className="bg-amber-600 text-white rounded-lg p-1 text-xs hover:bg-amber-700 cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Presets & Action Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{tText('Quick Add:', 'जल्दी जोड़ें:')}</span>
                {COMMON_DRUG_PRESETS.slice(0, 8).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => addPill(preset)}
                    disabled={selectedPills.includes(preset)}
                    className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer text-[10px]"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <button
                id="run-ddi-crosscheck-btn"
                onClick={handleRunInteractionCheck}
                disabled={selectedPills.length < 2 || isTyping}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all shrink-0"
              >
                <span>{tText('Check Drug-Drug Interactions', 'ड्रग-ड्रग इंटरेक्शन जांचें')}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Display Area (Message Feed) */}
      <div 
        ref={scrollRef} 
        id="ai-message-feed"
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50 border-x border-slate-200 dark:border-slate-800"
      >
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex flex-col gap-1 max-w-[90%] sm:max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "rounded-2xl px-4 py-3 shadow-xs text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-none" 
                : "bg-white text-slate-800 rounded-tl-none border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
            )}>
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <>
                  <div className="markdown-body space-y-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {/* Interactive Patient Record Navigation Action Card */}
                  {msg.patientData && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                          <User size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{msg.patientData.name}</span>
                            {msg.patientData.mobile && (
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">({msg.patientData.mobile})</span>
                            )}
                            {msg.patientData.allergies && msg.patientData.allergies.length > 0 && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-200 border border-red-200 dark:border-red-800">
                                ⚠️ Allergies: {msg.patientData.allergies.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                            {msg.patientData.age ? `${msg.patientData.age} yrs • ` : ''}{msg.patientData.gender || 'Patient'} • {msg.patientData.notes ? `${msg.patientData.notes.length} note(s)` : '0 notes'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'patients' } }));
                          window.dispatchEvent(new CustomEvent('open-patient-record', {
                            detail: {
                              patientId: msg.patientData!.id,
                              patient: msg.patientData,
                              patientName: msg.patientData!.name,
                              searchTerm: msg.patientData!.name
                            }
                          }));
                          if (onNavigate) onNavigate('patients');
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <span>{tText('Open Patient Record', 'मरीज रिकॉर्ड खोलें')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Fallback Search Navigation Action Card */}
                  {msg.isPatientLookup && !msg.patientData && msg.searchedPatientQuery && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <Search size={14} className="text-blue-500 shrink-0" />
                        <span>Search filter: <strong>"{msg.searchedPatientQuery}"</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'patients' } }));
                          window.dispatchEvent(new CustomEvent('open-patient-record', {
                            detail: {
                              searchTerm: msg.searchedPatientQuery,
                              patientName: msg.searchedPatientQuery
                            }
                          }));
                          if (onNavigate) onNavigate('patients');
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <span>{tText('Open Patients Directory', 'मरीज सूची खोलें')}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Non-Visual Audio Confirmation Status Pill */}
                  {msg.voiceStatus && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/50 rounded-xl px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Volume2 size={13} className={cn("shrink-0", currentlySpeakingText === msg.voiceStatus ? "text-indigo-600 dark:text-indigo-400 animate-pulse" : "text-slate-400")} />
                        <span className="font-medium truncate">{msg.voiceStatus}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentlySpeakingText === msg.voiceStatus) {
                            stopSpeaking();
                          } else {
                            speakTTS(msg.voiceStatus!, true);
                          }
                        }}
                        className="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                        title={tText('Replay spoken confirmation', 'बोली गई पुष्टि पुनः सुनें')}
                      >
                        {currentlySpeakingText === msg.voiceStatus ? (
                          <span className="text-rose-500 font-bold">{tText('Stop', 'रोकें')}</span>
                        ) : (
                          <span>{tText('Replay', 'पुष्टि सुनें')}</span>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400">
              <span>{msg.role === 'user' ? tText('You', 'आप') : tText('Medicine AI', 'दवा एआई')}</span>
              {msg.role === 'bot' && (
                <div className="flex items-center gap-2">
                  <CopyButton text={msg.text} />
                  <button
                    type="button"
                    onClick={() => {
                      const textToRead = msg.voiceStatus || msg.text;
                      if (currentlySpeakingText === textToRead) {
                        stopSpeaking();
                      } else {
                        speakTTS(textToRead, true);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                    title={tText('Listen to voice status confirmation', 'वॉयस स्टेटस पुष्टि सुनें')}
                  >
                    {currentlySpeakingText === (msg.voiceStatus || msg.text) ? (
                      <>
                        <VolumeX size={11} className="text-rose-500" />
                        <span className="text-rose-500 font-semibold">{tText('Stop', 'रोकें')}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={11} />
                        <span>{tText('Listen', 'सुनें')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Suggested Quick Questions */}
        {messages.length <= 1 && (
          <div className="pt-2 space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-blue-500" />
              <span>{tText('Suggested Clinical & Patient History Inquiries:', 'सुझाए गए नैदानिक और मरीज इतिहास के प्रश्न:')}</span>
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {/* Dedicated Voice Command Suggestion */}
              <button
                onClick={() => {
                  const sampleName = patients[0]?.name || 'Rahul';
                  handleSend(`Find patient ${sampleName}`);
                }}
                className="text-left text-xs bg-indigo-50/90 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5">
                  <Mic size={13} className="text-indigo-600 animate-pulse" />
                  <span>Say: <strong>"Find patient {patients[0]?.name || 'Rahul'}"</strong></span>
                </span>
                <span className="text-[10px] font-bold bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                  Voice Command
                </span>
              </button>

              {SUGGESTED_QUERIES.map((query, qIdx) => (
                <button
                  key={qIdx}
                  onClick={() => handleSend(query)}
                  className="text-left text-xs bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-2"
                >
                  <span>{query}</span>
                  {query.includes('interaction') || query.includes('together') ? (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded">
                      DDI
                    </span>
                  ) : null}
                </button>
              ))}

              {/* Dynamic patient sample queries if patients are registered */}
              {patients.slice(0, 2).map((p) => (
                <button
                  key={`patient-query-${p.id}`}
                  onClick={() => handleSend(`Show historical consultation notes and previous prescriptions for patient ${p.name}`)}
                  className="text-left text-xs bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/70 rounded-xl px-3 py-2 transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-1.5">
                    <User size={13} className="text-emerald-600" />
                    <span>Prescription history & notes for <strong>{p.name}</strong></span>
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded">
                    Patient
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isTyping && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs shadow-2xs">
            <Bot size={15} className="animate-bounce text-blue-600 shrink-0" />
            <span>{tText('Cross-referencing pharmacology database & patient clinical records...', 'फार्माकोलॉजी डेटाबेस और मरीज के रिकॉर्ड्स की जांच हो रही है...')}</span>
          </div>
        )}
      </div>

      {/* Primary Input Field Area with Active Patient Badge & Voice Dictation Controls */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-2xl shadow-sm space-y-2.5">
        {/* Speech Error & Interactive Microphone Permission Troubleshooter */}
        {(speechError || showMicPermissionGuide) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700/80 text-xs text-amber-950 dark:text-amber-100 shadow-sm space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shrink-0">
                  <Lock size={16} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-amber-900 dark:text-amber-100 text-xs sm:text-sm">
                      {tText('Microphone Access Blocked or Restricted', 'माइक्रोफ़ोन एक्सेस प्रतिबंधित है')}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                      {tText('Browser Permission Needed', 'ब्राउज़र अनुमति आवश्यक')}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    {speechError || tText('Please allow microphone permissions in your browser to dictate medicine notes.', 'कृपया डिक्टेशन के लिए ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSpeechError(null);
                  setShowMicPermissionGuide(false);
                }}
                className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 rounded-lg hover:bg-amber-200/50 transition-colors cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Step-by-Step Enablement Guidance & Quick Actions */}
            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>💡 How to fix:</span>
                  <span>Click the 🔒 icon in the address bar ➔ Set Microphone to <strong>"Allow"</strong></span>
                </div>
                <div className="text-[10px] text-amber-750 dark:text-amber-400">
                  (Note: If inside an embedded preview iframe, open in a new tab for native microphone access)
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  disabled={isCheckingMic}
                  onClick={() => startListening()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={cn(isCheckingMic && "animate-spin")} />
                  <span>{isCheckingMic ? tText('Checking...', 'जांच हो रही है...') : tText('Grant & Retry Mic', 'माइक्रोफ़ोन पुनः प्रयास करें')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      triggerSafeLinkRedirect(window.location.href, 'Satyam Pharma Standalone App Tab');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                  title={tText('Open app in standalone tab to bypass iframe microphone sandbox', 'नए टैब में खोलें')}
                >
                  <ExternalLink size={12} />
                  <span>{tText('Open in New Tab', 'नए टैब में खोलें')}</span>
                </button>
              </div>
            </div>

            {/* Quick 1-Click Simulated Voice Prompts */}
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                <Sparkles size={11} className="text-amber-600" />
                <span>{tText('Or try these instant voice queries with 1 click:', 'या 1 क्लिक में ये तुरंत जांचें:')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    wasVoiceOriginRef.current = true;
                    handleSend('Check potential Drug-Drug Interactions (DDI) between Pantoprazole and Clopidogrel', true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 hover:bg-amber-100 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  💊 DDI: Pantoprazole + Clopidogrel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wasVoiceOriginRef.current = true;
                    handleSend('What are the standard dosage guidelines and precautions for Amoxicillin 500mg?', true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 hover:bg-amber-100 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  📋 Dosage: Amoxicillin 500mg
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wasVoiceOriginRef.current = true;
                    const prompt = selectedPatient 
                      ? `Show full clinical history, previous prescriptions, and consultation notes for patient ${selectedPatient.name}`
                      : 'Show patient clinical consultation notes workflow and allergy checklist';
                    handleSend(prompt, true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 hover:bg-amber-100 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  🩺 Patient Clinical History
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Live Audio Dictation Status & Transcript Waveform Bar */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-gradient-to-r from-rose-50 via-pink-50/50 to-white dark:from-rose-950/50 dark:via-slate-900 dark:to-slate-900 p-3 shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-3">
                  {/* Pulsing Audio Waveform Animation */}
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/30 shrink-0">
                    <Radio size={18} className="animate-spin-slow" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                        <span>{tText('Listening & Transcribing Voice...', 'आवाज सुनी और लिखी जा रही है...')}</span>
                      </span>

                      {/* Language Dictation Switcher */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextLang = dictationLang === 'en-IN' ? 'hi-IN' : 'en-IN';
                          setDictationLang(nextLang);
                          if (recognitionRef.current) {
                            try {
                              recognitionRef.current.lang = nextLang;
                            } catch (_) {}
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
                        title={tText('Click to toggle recognition language (English / Hindi)', 'भाषा बदलने के लिए क्लिक करें')}
                      >
                        <span>🇮🇳</span>
                        <span>{dictationLang === 'hi-IN' ? 'हिन्दी (Hindi)' : 'English (India)'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                      {speechTranscript ? (
                        <span className="italic text-rose-700 dark:text-rose-300 font-semibold">
                          "{speechTranscript}..."
                        </span>
                      ) : input ? (
                        <span className="text-slate-600 dark:text-slate-400">
                          {tText('Dictating:', 'डिक्टेट हो रहा है:')} <span className="font-semibold text-slate-800 dark:text-slate-200">{input}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">
                          {tText('Speak clearly into your microphone (e.g. "Check interaction between Pantoprazole and Clopidogrel" or dictate consultation notes)...', 'माइक्रोफ़ोन में बोलें (दवा का नाम, नुस्खा या मरीज के नोट्स)...')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Voice Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {input.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        wasVoiceOriginRef.current = true;
                        stopListening();
                        handleSend(undefined, true);
                      }}
                      className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Send size={12} />
                      <span>{tText('Send Now', 'भेजें')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopListening}
                    className="flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <MicOff size={13} />
                    <span>{tText('Stop', 'रोकें')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Patient Badge */}
        {selectedPatient && (
          <div className={cn(
            "flex items-center justify-between rounded-xl px-3 py-2 text-xs border transition-colors",
            selectedPatient.allergies && selectedPatient.allergies.length > 0
              ? "bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-800/80 text-red-900 dark:text-red-200"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200"
          )}>
            <div className="flex items-center gap-2 truncate flex-wrap">
              <User size={14} className={selectedPatient.allergies && selectedPatient.allergies.length > 0 ? "text-red-600 dark:text-red-400 shrink-0" : "text-emerald-600 dark:text-emerald-400 shrink-0"} />
              <span className="font-semibold">{tText('Active Patient Record:', 'सक्रिय मरीज रिकॉर्ड:')}</span>
              <span className={cn("font-bold", selectedPatient.allergies && selectedPatient.allergies.length > 0 ? "text-red-950 dark:text-red-100" : "text-emerald-950 dark:text-emerald-100")}>
                {selectedPatient.name}
              </span>
              {selectedPatient.mobile && (
                <span className={cn("text-[11px]", selectedPatient.allergies && selectedPatient.allergies.length > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                  ({selectedPatient.mobile})
                </span>
              )}
              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                  <ShieldAlert size={11} />
                  <span>Allergies: {selectedPatient.allergies.join(', ')}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const prefix = `Clinical Consultation Note for ${selectedPatient.name}: `;
                  toggleListening(prefix);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
                title={tText('Dictate notes for this patient', 'इस मरीज के लिए नोट्स बोलें')}
              >
                <Mic size={12} />
                <span>{tText('Dictate Note', 'नोट्स बोलें')}</span>
              </button>
              <button
                onClick={() => setSelectedPatient(null)}
                className={cn(
                  "cursor-pointer p-0.5 shrink-0 hover:scale-110 transition-transform",
                  selectedPatient.allergies && selectedPatient.allergies.length > 0
                    ? "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-100"
                    : "text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-100"
                )}
                title={tText('Unlink Patient Context', 'मरीज संदर्भ हटाएं')}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Quick Voice Dictation Helper Shortcuts */}
        {!isListening && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto text-[11px] pb-0.5">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Mic size={11} className="text-blue-500" />
                <span>{tText('Voice Dictation:', 'वॉयस डिक्टेशन:')}</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  startListening('Find patient ');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-xs font-bold shrink-0 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                title={tText('Say "Find patient [Name]" to automatically look up and open patient profile', 'मरीज खोजने के लिए "Find patient [Name]" बोलें')}
              >
                <Mic size={11} className="text-indigo-600 animate-pulse" />
                <span>{tText('Say "Find patient [Name]"', '"Find patient [Name]" बोलें')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const notePrefix = selectedPatient 
                    ? `Clinical Consultation Note for ${selectedPatient.name}: ` 
                    : 'Clinical Consultation Note: ';
                  startListening(notePrefix);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <FileText size={11} className="text-blue-600" />
                <span>{tText('Dictate Patient Note', 'मरीज नोट्स डिक्टेट करें')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  startListening('Check drug-drug interaction between ');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Pill size={11} className="text-emerald-600" />
                <span>{tText('Dictate DDI Query', 'DDI जांच डिक्टेट करें')}</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
              <span>🌐 {dictationLang === 'hi-IN' ? 'Hindi' : 'English'} Recognition</span>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              id="ai-medicine-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tText('Type or click 🎙️ to dictate medicine, DDI, or patient notes...', 'टाइप करें या 🎙️ दबाकर दवा, DDI या मरीज के नोट्स बोलें...')}
              className={cn(
                "w-full rounded-xl border bg-slate-50 pl-10 pr-24 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500",
                isListening 
                  ? "border-rose-400 ring-2 ring-rose-200 dark:ring-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20" 
                  : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
              )}
            />

            {/* In-Input Action Buttons: Clear & Microphone */}
            <div className="absolute right-2 top-2 flex items-center gap-1">
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title={tText('Clear input', 'साफ करें')}
                >
                  <X size={14} />
                </button>
              )}

              {/* Prominent Microphone Dictation Button */}
              <button
                id="ai-dictate-mic-btn"
                type="button"
                onClick={() => toggleListening()}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                  isListening
                    ? "bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/40 ring-2 ring-rose-300 dark:ring-rose-800 scale-105"
                    : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/60 dark:hover:text-blue-200"
                )}
                title={isListening 
                  ? tText('Listening... Click to stop dictation', 'सुन रहा है... रोकने के लिए क्लिक करें') 
                  : tText('Click to dictate query or patient notes with microphone', 'माइक्रोफ़ोन से डिक्टेट करने के लिए क्लिक करें')
                }
              >
                {isListening ? (
                  <MicOff size={16} className="text-white animate-bounce" />
                ) : (
                  <Mic size={16} />
                )}
              </button>
            </div>
          </div>

          <button
            id="ai-medicine-send-btn"
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 sm:px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <span>{tText('Ask', 'पूछें')}</span>
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};

export default AIAssistant;


