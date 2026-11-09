import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  User, 
  Phone, 
  Calendar, 
  Mic, 
  MicOff, 
  Save, 
  Clock, 
  FileText,
  UserPlus,
  Users,
  ChevronRight,
  History,
  AlertCircle,
  Activity,
  Heart,
  Scale,
  Stethoscope,
  Sparkles,
  Camera,
  ShieldAlert,
  AlertTriangle,
  X,
  Pill,
  CalendarDays,
  CheckCircle2,
  Check
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy, 
  where, 
  Timestamp, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Patient, PatientNote, VitalRecord, Medicine } from '../types';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import PrescriptionScannerModal, { ParsedPrescriptionResult } from './PrescriptionScannerModal';
import { MonthlyCustomersManager } from './MonthlyCustomersManager';
import { PatientMonthlyRefillTab } from './PatientMonthlyRefillTab';

const COMMON_CHRONIC_CONDITIONS = [
  'Type 2 Diabetes',
  'Hypertension (BP)',
  'Thyroid',
  'Heart Condition',
  'Asthma / COPD',
  'Cholesterol',
  'Arthritis'
];

const Patients: React.FC = () => {
  const { t, tText } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [mainViewMode, setMainViewMode] = useState<'directory' | 'monthly'>('directory');
  const [patientFilter, setPatientFilter] = useState<'all' | 'monthly' | 'allergies'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'monthly' | 'notes' | 'vitals'>('monthly');
  
  // Note form state
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<PatientNote['type']>('general');
  const [isDictating, setIsDictating] = useState(false);

  // Vitals form state
  const [newVital, setNewVital] = useState({
    weight: '',
    systolic: '',
    diastolic: ''
  });
  
  // Add patient form state
  const [newPatient, setNewPatient] = useState({
    name: '',
    mobile: '',
    age: '',
    gender: 'male',
    allergies: '',
    isMonthlyCustomer: false,
    preferredDayOfMonth: 5,
    chronicConditions: ''
  });

  // Inline allergy state
  const [customAllergyInput, setCustomAllergyInput] = useState('');
  const [showAllergyInput, setShowAllergyInput] = useState(false);

  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const pendingPatientIdRef = useRef<string | null>(null);

  // Global listener to jump to a specific patient from AI voice assistant or search
  useEffect(() => {
    const handleOpenPatientRecord = (e: any) => {
      const { patientId, patient, patientName, searchTerm: term, openMonthlyTab } = e.detail || {};
      
      if (openMonthlyTab) {
        setActiveSubTab('monthly');
      }

      if (patient) {
        setSelectedPatient(patient);
        setMainViewMode('directory');
        if (patient.name) setSearchTerm(patient.name);
        return;
      }

      if (patientId) {
        pendingPatientIdRef.current = patientId;
        const match = patients.find(p => p.id === patientId);
        if (match) {
          setSelectedPatient(match);
          setMainViewMode('directory');
          if (match.name) setSearchTerm(match.name);
          pendingPatientIdRef.current = null;
        }
      }

      if (patientName || term) {
        const queryStr = (patientName || term).trim();
        setSearchTerm(queryStr);
        const match = patients.find(p => 
          p.name.toLowerCase().includes(queryStr.toLowerCase()) || 
          p.mobile.includes(queryStr)
        );
        if (match) {
          setSelectedPatient(match);
          setMainViewMode('directory');
        }
      }
    };

    window.addEventListener('open-patient-record', handleOpenPatientRecord);
    return () => window.removeEventListener('open-patient-record', handleOpenPatientRecord);
  }, [patients]);

  // Update selected patient when patient list changes
  useEffect(() => {
    if (selectedPatient) {
      const updated = patients.find(p => p.id === selectedPatient.id);
      if (updated) {
        setSelectedPatient(updated);
      }
    }
  }, [patients]);

  const handlePatientUpdated = (updated: Patient) => {
    setSelectedPatient(updated);
    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  useEffect(() => {
    fetchPatients();
    
    // Fetch inventory medicines for prescription matching
    const fetchMedicines = async () => {
      try {
        const snap = await getDocs(collection(db, 'inventory'));
        setMedicines(snap.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)));
      } catch (err) {
        console.warn("Could not fetch inventory in Patients module:", err);
      }
    };
    fetchMedicines();

    // Initialize Web Speech API
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setNoteContent(prev => prev + ' ' + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        setIsDictating(false);
      };

      recognitionRef.current.onend = () => {
        setIsDictating(false);
      };
    }
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(data);

      if (pendingPatientIdRef.current) {
        const match = data.find(p => p.id === pendingPatientIdRef.current);
        if (match) {
          setSelectedPatient(match);
          if (match.name) setSearchTerm(match.name);
          pendingPatientIdRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDictation = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isDictating) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsDictating(true);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allergiesList = newPatient.allergies
        ? newPatient.allergies.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const chronicConditionsList = newPatient.chronicConditions
        ? newPatient.chronicConditions.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const docRef = await addDoc(collection(db, 'patients'), {
        name: newPatient.name.trim(),
        mobile: newPatient.mobile.trim(),
        age: newPatient.age.trim(),
        gender: newPatient.gender,
        allergies: allergiesList,
        isMonthlyCustomer: newPatient.isMonthlyCustomer,
        preferredDayOfMonth: newPatient.preferredDayOfMonth || 5,
        chronicConditions: chronicConditionsList,
        monthlyMedicines: [],
        monthlyDispensations: [],
        notes: [],
        createdAt: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewPatient({
        name: '',
        mobile: '',
        age: '',
        gender: 'male',
        allergies: '',
        isMonthlyCustomer: false,
        preferredDayOfMonth: 5,
        chronicConditions: ''
      });
      fetchPatients();
    } catch (error) {
      console.error("Error adding patient:", error);
    }
  };

  const handleAddAllergyToSelected = async (allergyName: string) => {
    if (!selectedPatient || !allergyName.trim()) return;
    const cleanAllergy = allergyName.trim();
    if (selectedPatient.allergies?.includes(cleanAllergy)) return;

    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        allergies: arrayUnion(cleanAllergy)
      });

      const updated = {
        ...selectedPatient,
        allergies: [...(selectedPatient.allergies || []), cleanAllergy]
      };
      setSelectedPatient(updated);
      setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
      setCustomAllergyInput('');
      setShowAllergyInput(false);
    } catch (err) {
      console.error("Error adding allergy to patient:", err);
    }
  };

  const handleRemoveAllergyFromSelected = async (allergyName: string) => {
    if (!selectedPatient) return;
    try {
      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        allergies: arrayRemove(allergyName)
      });

      const updated = {
        ...selectedPatient,
        allergies: (selectedPatient.allergies || []).filter(a => a !== allergyName)
      };
      setSelectedPatient(updated);
      setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      console.error("Error removing allergy from patient:", err);
    }
  };

  const handleAddVital = async () => {
    if (!selectedPatient) return;
    if (!newVital.weight && !newVital.systolic && !newVital.diastolic) return;

    try {
      const record: VitalRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        weight: newVital.weight ? parseFloat(newVital.weight) : undefined,
        systolic: newVital.systolic ? parseFloat(newVital.systolic) : undefined,
        diastolic: newVital.diastolic ? parseFloat(newVital.diastolic) : undefined
      };

      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        vitals: arrayUnion(record)
      });

      const updatedPatient = {
        ...selectedPatient,
        vitals: [...(selectedPatient.vitals || []), record]
      };
      setSelectedPatient(updatedPatient);
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setNewVital({ weight: '', systolic: '', diastolic: '' });
    } catch (error) {
      console.error("Error adding vitals:", error);
    }
  };

  const handleAddNote = async () => {
    if (!selectedPatient || !noteContent.trim()) return;

    try {
      const newNote: PatientNote = {
        id: crypto.randomUUID(),
        content: noteContent,
        timestamp: new Date().toISOString(),
        type: noteType
      };

      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        notes: arrayUnion(newNote)
      });

      // Update local state
      const updatedPatient = {
        ...selectedPatient,
        notes: [...selectedPatient.notes, newNote]
      };
      setSelectedPatient(updatedPatient);
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setNoteContent('');
      setNoteType('general');
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleSavePrescriptionToPatient = async (parsed: ParsedPrescriptionResult) => {
    if (!selectedPatient) return;

    const medsListStr = parsed.medicines
      .filter(m => m.selected)
      .map((m, i) => `${i + 1}. ${m.medicineName} (${m.form || 'Tablet'}) - Dosage: ${m.dosage} • Qty: ${m.suggestedQuantity} ${m.instructions ? `[${m.instructions}]` : ''}`)
      .join('\n');

    const content = `📋 DOCTOR'S PRESCRIPTION (AI Parsed)\n👨‍⚕️ Prescribed by: ${parsed.doctor.name || 'Medical Doctor'} ${parsed.doctor.qualification ? `(${parsed.doctor.qualification})` : ''} - ${parsed.doctor.clinicOrHospital || ''}\n📅 Date: ${parsed.doctor.date || new Date().toLocaleDateString()}\n\n💊 PRESCRIBED MEDICINES:\n${medsListStr}\n\n💡 Clinical Advice: ${parsed.generalAdvice || 'Take medications strictly as scheduled.'}\n\n🎯 AI Confidence: ${parsed.confidenceScore ?? 95}%`;

    try {
      const newNote: PatientNote = {
        id: crypto.randomUUID(),
        content,
        timestamp: new Date().toISOString(),
        type: 'prescription'
      };

      const patientRef = doc(db, 'patients', selectedPatient.id);
      await updateDoc(patientRef, {
        notes: arrayUnion(newNote)
      });

      const updatedPatient = {
        ...selectedPatient,
        notes: [...selectedPatient.notes, newNote]
      };
      setSelectedPatient(updatedPatient);
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setIsRxModalOpen(false);
    } catch (err) {
      console.error("Error saving prescription note to patient record:", err);
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = searchTerm.trim() === '' || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.mobile.includes(searchTerm) ||
      (p.chronicConditions && p.chronicConditions.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;

    if (patientFilter === 'monthly') return p.isMonthlyCustomer || (p.monthlyMedicines && p.monthlyMedicines.length > 0);
    if (patientFilter === 'allergies') return p.allergies && p.allergies.length > 0;
    return true;
  });

  const totalMonthlyCustomers = patients.filter(p => p.isMonthlyCustomer || (p.monthlyMedicines && p.monthlyMedicines.length > 0)).length;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-3 overflow-hidden">
      {/* Top Main View Switcher Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMainViewMode('directory')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              mainViewMode === 'directory'
                ? "bg-slate-900 text-white dark:bg-blue-600 shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Users size={15} />
            <span>{tText('Patient Directory', 'मरीज डायरेक्टरी')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/50 dark:bg-slate-700/60 font-semibold">
              {patients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainViewMode('monthly')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative",
              mainViewMode === 'monthly'
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <CalendarDays size={15} className={mainViewMode === 'monthly' ? "text-amber-300" : "text-blue-600"} />
            <span>{tText('Monthly Customers Schedule', 'मासिक ग्राहक शिड्यूल')}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold shadow-2xs",
              mainViewMode === 'monthly' ? "bg-amber-400 text-slate-900" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            )}>
              {totalMonthlyCustomers} Active
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewPatient(prev => ({ ...prev, isMonthlyCustomer: false }));
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Enroll New Patient</span>
          </button>
        </div>
      </div>

      {/* Main Display: either Aggregated Monthly Customers Manager OR Directory Split View */}
      {mainViewMode === 'monthly' ? (
        <MonthlyCustomersManager
          patients={patients}
          inventoryMedicines={medicines}
          onSelectPatient={(p) => {
            setSelectedPatient(p);
            setActiveSubTab('monthly');
            setMainViewMode('directory');
          }}
          onUpdatePatient={handlePatientUpdated}
          onOpenAddPatient={() => {
            setNewPatient(prev => ({ ...prev, isMonthlyCustomer: true }));
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
          {/* Left Sidebar: Patient List */}
          <div className="flex w-80 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search name, mobile, condition..."
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-800"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPatientFilter('all')}
                  className={cn(
                    "flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                    patientFilter === 'all'
                      ? "bg-slate-900 text-white dark:bg-blue-600"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  All ({patients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPatientFilter('monthly')}
                  className={cn(
                    "flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                    patientFilter === 'monthly'
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                  )}
                >
                  <Sparkles size={10} />
                  <span>Monthly ({totalMonthlyCustomers})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPatientFilter('allergies')}
                  className={cn(
                    "py-1 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                    patientFilter === 'allergies'
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300"
                  )}
                >
                  Allergy
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pb-4 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Loading records...</p>
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => {
                  const hasAllergies = patient.allergies && patient.allergies.length > 0;
                  const isMonthly = patient.isMonthlyCustomer || (patient.monthlyMedicines && patient.monthlyMedicines.length > 0);
                  const isSelected = selectedPatient?.id === patient.id;

                  return (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all cursor-pointer border",
                        isSelected 
                          ? "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100 shadow-xs" 
                          : "border-transparent even:bg-slate-50/50 dark:even:bg-slate-800/30 odd:bg-transparent hover:bg-blue-50/50 dark:hover:bg-slate-800/70 hover:border-slate-200/60 dark:hover:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm",
                        isSelected ? "bg-blue-600 text-white shadow-xs" : isMonthly ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                      )}>
                        {patient.name.charAt(0).toUpperCase()}
                        {hasAllergies && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" title="Drug Allergies Listed" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{patient.name}</p>
                          {isMonthly && (
                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-300 shrink-0">
                              Day {patient.preferredDayOfMonth || 5}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span>{patient.mobile}</span>
                          {isMonthly && (
                            <span className="text-[9px] font-semibold text-emerald-600">
                              {(patient.monthlyMedicines || []).length} meds
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className={cn(
                        "opacity-0 transition-opacity text-blue-600",
                        isSelected ? "opacity-100" : ""
                      )} />
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <User size={32} className="mb-2 opacity-20" />
                  <p className="text-xs">No matching patients</p>
                </div>
              )}
            </div>
          </div>

      {/* Main Area: Patient Details & Notes */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {selectedPatient ? (
          <>
            {/* Header */}
            <div className="border-b border-slate-100 p-5 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-md">
                    {selectedPatient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedPatient.name}</h2>
                      {selectedPatient.isMonthlyCustomer && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-2xs">
                          <Sparkles size={10} className="text-amber-300" />
                          <span>MONTHLY CUSTOMER (DAY {selectedPatient.preferredDayOfMonth || 5})</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Phone size={11} /> {selectedPatient.mobile}</span>
                      <span className="flex items-center gap-1"><User size={11} /> {selectedPatient.age} Yrs / {selectedPatient.gender}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} /> Joined {new Date(selectedPatient.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Subtab Switcher */}
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 shrink-0">
                  <button
                    onClick={() => setActiveSubTab('monthly')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                      activeSubTab === 'monthly' ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    )}
                  >
                    <CalendarDays size={13} className="text-blue-600" />
                    <span>Monthly Refill</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {(selectedPatient.monthlyMedicines || []).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('notes')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                      activeSubTab === 'notes' ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    )}
                  >
                    <FileText size={13} />
                    <span>Observations</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('vitals')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                      activeSubTab === 'vitals' ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    )}
                  >
                    <Activity size={13} />
                    <span>Health Trends</span>
                  </button>
                </div>
              </div>

              {/* Allergies Banner / Chips */}
              <div className={cn(
                "rounded-xl p-3 border flex flex-wrap items-center justify-between gap-2",
                selectedPatient.allergies && selectedPatient.allergies.length > 0
                  ? "bg-red-50/80 border-red-200 dark:bg-red-950/40 dark:border-red-900/60"
                  : "bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/60"
              )}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-bold",
                    selectedPatient.allergies && selectedPatient.allergies.length > 0
                      ? "text-red-700 dark:text-red-300"
                      : "text-slate-600 dark:text-slate-400"
                  )}>
                    <ShieldAlert size={15} className={selectedPatient.allergies && selectedPatient.allergies.length > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"} />
                    <span>Known Drug Allergies:</span>
                  </div>

                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                    selectedPatient.allergies.map(allergy => (
                      <span
                        key={allergy}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-2xs"
                      >
                        <AlertTriangle size={11} />
                        <span>{allergy}</span>
                        <button
                          onClick={() => handleRemoveAllergyFromSelected(allergy)}
                          className="hover:text-red-200 cursor-pointer ml-0.5"
                          title={`Remove ${allergy}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-medium text-slate-500 italic">
                      No known drug allergies (NKDA) recorded
                    </span>
                  )}
                </div>

                {/* Add Allergy Button / Input */}
                <div className="flex items-center gap-1.5">
                  {showAllergyInput ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={customAllergyInput}
                        onChange={(e) => setCustomAllergyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAllergyToSelected(customAllergyInput);
                          }
                        }}
                        placeholder="e.g. Penicillin, Sulfa"
                        className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none w-36"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddAllergyToSelected(customAllergyInput)}
                        disabled={!customAllergyInput.trim()}
                        className="bg-red-600 text-white rounded-lg px-2 py-1 text-xs font-bold hover:bg-red-700 cursor-pointer disabled:opacity-40"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAllergyInput(false);
                          setCustomAllergyInput('');
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAllergyInput(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>+ Add Allergy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Split */}
            <div className="flex flex-1 overflow-hidden">
              {activeSubTab === 'monthly' ? (
                <PatientMonthlyRefillTab
                  patient={selectedPatient}
                  inventoryMedicines={medicines}
                  onUpdatePatient={handlePatientUpdated}
                  onNavigateTab={(tab) => {
                    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab } }));
                  }}
                />
              ) : activeSubTab === 'notes' ? (
                <>
                  {/* Note History */}
                  <div className="flex-1 overflow-y-auto border-r border-slate-100 p-6 dark:border-slate-800">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <History size={14} />
                      Observation Logs
                    </div>
                    
                    <div className="space-y-4">
                      {selectedPatient.notes.length > 0 ? (
                        [...selectedPatient.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((note, nIdx) => (
                          <div 
                            key={note.id} 
                            className={cn(
                              "relative rounded-xl border p-4 transition-all",
                              nIdx % 2 === 0 ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800" : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60",
                              "hover:bg-blue-50/50 dark:hover:bg-slate-800/80 hover:border-blue-200 dark:hover:border-blue-900 shadow-2xs"
                            )}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white",
                                note.type === 'observation' ? "bg-orange-500" : note.type === 'prescription' ? "bg-green-600" : "bg-blue-600"
                              )}>
                                {note.type}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                <Clock size={10} /> {new Date(note.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                              {note.content}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <FileText size={48} className="mb-2 opacity-10" />
                          <p className="text-xs italic">No clinical notes recorded for this patient.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dictation / Add Note Panel */}
                  <div className="w-96 flex flex-col p-6 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <Mic size={14} />
                      New Observation
                    </div>

                    <div className="flex-1 flex flex-col gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Note Type</label>
                        <div className="flex gap-1">
                          {(['general', 'observation', 'prescription'] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => setNoteType(type)}
                              className={cn(
                                "flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                                noteType === type 
                                  ? "bg-slate-900 text-white dark:bg-blue-600 shadow-md" 
                                  : "bg-white text-slate-400 hover:bg-slate-100 dark:bg-slate-800"
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative flex-1">
                        <textarea
                          placeholder="Start dictating or type observation logs..."
                          className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900"
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                        />
                        <div className="absolute bottom-4 right-4 flex gap-2">
                          <button
                            onClick={toggleDictation}
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-xl shadow-lg transition-all active:scale-95",
                              isDictating 
                                ? "animate-pulse bg-red-600 text-white" 
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                          >
                            {isDictating ? <MicOff size={20} /> : <Mic size={20} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleAddNote}
                          disabled={!noteContent.trim()}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-bold text-white shadow-xl transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-95 dark:bg-blue-600"
                        >
                          <Save size={18} />
                          <span>Save Observation</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRxModalOpen(true)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 font-bold text-white shadow-lg transition-all hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
                          title="Scan Doctor's Prescription with Camera and auto-format note"
                        >
                          <Camera size={18} />
                          <span className="text-xs uppercase tracking-wider">Scan Rx</span>
                          <Sparkles size={12} className="text-amber-300" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Vitals Trends Chart */}
                  <div className="flex-1 overflow-y-auto border-r border-slate-100 p-6 dark:border-slate-800">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <Activity size={14} />
                        Vital Statistics Chart
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-600" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Weight</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">BP (Sys)</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8 h-80 w-full rounded-2xl bg-white p-4 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      {selectedPatient.vitals && selectedPatient.vitals.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...selectedPatient.vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(ts) => new Date(String(ts)).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              tick={{ fontSize: 10, fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                              dy={10}
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                              }}
                              labelFormatter={(ts) => new Date(String(ts)).toLocaleDateString([], { dateStyle: 'long' })}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="weight" 
                              stroke="#2563eb" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6 }}
                              name="Weight (kg)"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="systolic" 
                              stroke="#ef4444" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6 }}
                              name="BP Sys"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-slate-400">
                          <Activity size={48} className="mb-2 opacity-10" />
                          <p className="text-xs italic">Record at least two readings to see trends.</p>
                        </div>
                      )}
                    </div>

                    {/* Vitals History List */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Historical Readings</h4>
                      {selectedPatient.vitals && [...selectedPatient.vitals].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((record, vIdx) => (
                        <div 
                          key={record.id} 
                          className={cn(
                            "flex items-center justify-between rounded-xl border p-4 shadow-2xs transition-all",
                            vIdx % 2 === 0 ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800" : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60",
                            "hover:bg-blue-50/60 dark:hover:bg-slate-800/80 hover:border-blue-200 dark:hover:border-blue-800"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-800">
                              <Calendar size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Date(record.timestamp).toLocaleDateString()}</p>
                              <p className="text-[10px] font-bold uppercase text-slate-400">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          <div className="flex gap-6">
                            {record.weight && (
                              <div className="text-center">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{record.weight} kg</p>
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Weight</p>
                              </div>
                            )}
                            {record.systolic && record.diastolic && (
                              <div className="text-center">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{record.systolic}/{record.diastolic}</p>
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">BP</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Vitals Panel */}
                  <div className="w-96 flex flex-col p-6 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <Plus size={14} />
                      Log Vitals
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                              <Scale size={12} /> Body Weight (kg)
                            </label>
                            <input
                              type="number"
                              placeholder="0.0"
                              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
                              value={newVital.weight}
                              onChange={(e) => setNewVital({...newVital, weight: e.target.value})}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                              <Heart size={12} /> Blood Pressure (mmHg)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Sys"
                                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
                                value={newVital.systolic}
                                onChange={(e) => setNewVital({...newVital, systolic: e.target.value})}
                              />
                              <span className="text-slate-300 font-bold">/</span>
                              <input
                                type="number"
                                placeholder="Dia"
                                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
                                value={newVital.diastolic}
                                onChange={(e) => setNewVital({...newVital, diastolic: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleAddVital}
                          disabled={!newVital.weight && !newVital.systolic}
                          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-50 active:scale-95"
                        >
                          <Save size={18} />
                          <span>Record Vitals</span>
                        </button>
                      </div>

                      <div className="rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20">
                        <div className="flex gap-3">
                          <AlertCircle size={16} className="text-blue-600 shrink-0" />
                          <p className="text-[10px] font-medium leading-relaxed text-blue-700 dark:text-blue-400">
                            Regular vital monitoring helps in tracking efficacy of prescribed medications and identifying early health risks.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-50 text-slate-200 dark:bg-slate-800">
              <Users size={48} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Patient Records Terminal</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
              Select a patient from the directory to view clinical history, monthly refills, or record observation logs.
            </p>
          </div>
        )}
      </div>
    </div>
  )}

      {/* Add Patient Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={() => setIsAddModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">New Patient Profile</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Initialize electronic health record & refill schedule</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddPatient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Full Name</label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800 text-sm font-medium"
                    placeholder="Patient Name"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Mobile Number (WhatsApp Enabled)</label>
                  <input
                    required
                    type="tel"
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800 text-sm font-medium"
                    placeholder="10-digit number (e.g. 9876543210)"
                    value={newPatient.mobile}
                    onChange={(e) => setNewPatient({...newPatient, mobile: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Age</label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800 text-sm"
                      placeholder="Yrs"
                      value={newPatient.age}
                      onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Gender</label>
                    <select
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800 text-sm"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Monthly Customer Option */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPatient.isMonthlyCustomer}
                        onChange={(e) => setNewPatient({...newPatient, isMonthlyCustomer: e.target.checked})}
                        className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        Enroll as Monthly Regular Customer (मासिक ग्राहक)
                      </span>
                    </label>
                    <Sparkles size={14} className="text-amber-500" />
                  </div>

                  {newPatient.isMonthlyCustomer && (
                    <div className="space-y-3 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                            Preferred Day of Month
                          </label>
                          <select
                            value={newPatient.preferredDayOfMonth}
                            onChange={(e) => setNewPatient({...newPatient, preferredDayOfMonth: Number(e.target.value)})}
                            className="w-full mt-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold outline-none dark:border-blue-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>
                                {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of every month
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                            Chronic Condition
                          </label>
                          <input
                            type="text"
                            value={newPatient.chronicConditions}
                            onChange={(e) => setNewPatient({...newPatient, chronicConditions: e.target.value})}
                            placeholder="e.g. Diabetes, BP, Thyroid"
                            className="w-full mt-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs outline-none dark:border-blue-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">
                        ✨ Once created, you can specify regular monthly medicines and refill quantities directly in their profile or batch refill dashboard.
                      </p>
                    </div>
                  )}
                </div>

                {/* Allergies Input Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    <span>Known Drug Allergies (Optional, comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-red-200 bg-red-50/50 px-4 py-2.5 outline-none focus:border-red-500 dark:border-red-900/60 dark:bg-red-950/20 text-xs text-red-900 dark:text-red-200 placeholder-red-300 dark:placeholder-red-700"
                    placeholder="e.g. Penicillin, Sulfa, Aspirin, Ibuprofen"
                    value={newPatient.allergies}
                    onChange={(e) => setNewPatient({...newPatient, allergies: e.target.value})}
                  />
                  <p className="text-[10px] text-slate-400">
                    Entering allergies enables instant automatic contraindication alerts in the AI Assistant.
                  </p>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 rounded-xl py-2.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-slate-800 dark:bg-blue-600 cursor-pointer"
                  >
                    Create Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Prescription Scanner Modal */}
      {isRxModalOpen && (
        <PrescriptionScannerModal
          onClose={() => setIsRxModalOpen(false)}
          availableMedicines={medicines}
          patientContextName={selectedPatient?.name}
          onSaveToPatientNotes={handleSavePrescriptionToPatient}
        />
      )}
    </div>
  );
};

export default Patients;
