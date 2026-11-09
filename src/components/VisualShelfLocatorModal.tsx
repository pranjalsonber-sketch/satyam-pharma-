import React, { useState, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Layers, 
  Compass, 
  Search, 
  Check, 
  Edit3, 
  Navigation, 
  Thermometer, 
  AlertTriangle, 
  Package, 
  Sparkles, 
  Calendar, 
  Printer, 
  Copy, 
  CheckCircle2, 
  ArrowRight,
  Info,
  Sliders,
  Grid,
  Maximize2
} from 'lucide-react';
import { Medicine, StorageLocation } from '../types';
import { 
  getMedicineLocation, 
  PHARMACY_FLOOR_ZONES, 
  AISLE_PRESETS, 
  RACK_PRESETS, 
  SHELF_PRESETS, 
  BIN_PRESETS 
} from '../lib/locationUtils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface VisualShelfLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  allMedicines: Medicine[];
  onLocationUpdated?: () => void;
  onSelectMedicine?: (med: Medicine) => void;
}

export const VisualShelfLocatorModal: React.FC<VisualShelfLocatorModalProps> = ({
  isOpen,
  onClose,
  medicine: initialMedicine,
  allMedicines,
  onLocationUpdated,
  onSelectMedicine
}) => {
  const { tText } = useLanguage();
  const [activeMedicine, setActiveMedicine] = useState<Medicine | null>(initialMedicine);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeViewTab, setActiveViewTab] = useState<'floor' | 'shelf' | 'edit'>('floor');
  const [copiedDirection, setCopiedDirection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit location form state
  const [editAisle, setEditAisle] = useState('');
  const [editRack, setEditRack] = useState('');
  const [editShelf, setEditShelf] = useState('');
  const [editBin, setEditBin] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Keep active medicine synced with props if initialMedicine changes
  React.useEffect(() => {
    if (initialMedicine) {
      setActiveMedicine(initialMedicine);
      const loc = getMedicineLocation(initialMedicine);
      setEditAisle(loc.aisle);
      setEditRack(loc.rack);
      setEditShelf(loc.shelf);
      setEditBin(loc.bin || 'Bin 01');
      setEditNotes(loc.notes || '');
    } else if (allMedicines.length > 0 && !activeMedicine) {
      setActiveMedicine(allMedicines[0]);
      const loc = getMedicineLocation(allMedicines[0]);
      setEditAisle(loc.aisle);
      setEditRack(loc.rack);
      setEditShelf(loc.shelf);
      setEditBin(loc.bin || 'Bin 01');
      setEditNotes(loc.notes || '');
    }
  }, [initialMedicine, allMedicines]);

  const activeLocation: StorageLocation = useMemo(() => {
    if (!activeMedicine) {
      return {
        aisle: 'Aisle A',
        rack: 'Rack R-01',
        shelf: 'Shelf Level 2',
        bin: 'Bin 01',
        zone: 'tablets',
        temperature: '15°C - 25°C',
        notes: 'Oral solid dosage'
      };
    }
    return getMedicineLocation(activeMedicine);
  }, [activeMedicine]);

  // Find active floor zone
  const activeZone = useMemo(() => {
    return PHARMACY_FLOOR_ZONES.find(z => z.id === activeLocation.aisle) || PHARMACY_FLOOR_ZONES[0];
  }, [activeLocation.aisle]);

  // Filtered search list inside locator
  const searchedMedicines = useMemo(() => {
    if (!searchQuery.trim()) return allMedicines.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return allMedicines.filter(m => 
      m.name.toLowerCase().includes(q) ||
      m.genericName?.toLowerCase().includes(q) ||
      m.salt?.toLowerCase().includes(q) ||
      m.barcode?.includes(q)
    ).slice(0, 10);
  }, [searchQuery, allMedicines]);

  // Find other medicines sharing the same aisle/rack
  const nearbyMedicines = useMemo(() => {
    if (!activeMedicine) return [];
    return allMedicines.filter(m => {
      if (m.id === activeMedicine.id) return false;
      const loc = getMedicineLocation(m);
      return loc.aisle === activeLocation.aisle && loc.rack === activeLocation.rack;
    }).slice(0, 6);
  }, [activeMedicine, activeLocation, allMedicines]);

  // Save updated custom location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMedicine) return;

    try {
      setIsSaving(true);
      const updatedLocation: StorageLocation = {
        aisle: editAisle || 'Aisle A',
        rack: editRack || 'Rack R-01',
        shelf: editShelf || 'Shelf Level 2',
        bin: editBin || 'Bin 01',
        notes: editNotes,
        temperature: activeLocation.temperature
      };

      const docRef = doc(db, 'inventory', activeMedicine.id);
      await updateDoc(docRef, {
        location: updatedLocation,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      const updatedMed = {
        ...activeMedicine,
        location: updatedLocation
      };
      setActiveMedicine(updatedMed);
      if (onLocationUpdated) onLocationUpdated();
      setActiveViewTab('shelf');
    } catch (err) {
      console.error('Error updating shelf location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyDirection = () => {
    if (!activeMedicine) return;
    const text = `📦 MEDICINE PICK SLIP
Item: ${activeMedicine.name} (${activeMedicine.genericName || 'Generic'})
Type: ${activeMedicine.type?.toUpperCase()} | Current Stock: ${activeMedicine.stockQuantity} units
📍 LOCATION: ${activeLocation.aisle} ➔ ${activeLocation.rack} ➔ ${activeLocation.shelf} ➔ ${activeLocation.bin || 'N/A'}
❄️ Storage: ${activeLocation.temperature || 'Room Temperature (15-25°C)'}
📝 Notes: ${activeLocation.notes || 'FIFO Pick - Earliest Expiry First'}`;

    navigator.clipboard.writeText(text);
    setCopiedDirection(true);
    setTimeout(() => setCopiedDirection(false), 2500);
  };

  if (!isOpen) return null;

  // Extract shelf number from string (e.g. "Shelf Level 2" -> 2)
  const activeShelfNum = parseInt(activeLocation.shelf.replace(/[^0-9]/g, '')) || 2;
  const activeBinIndex = parseInt((activeLocation.bin || '01').replace(/[^0-9]/g, '')) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Modal Card */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="relative w-full max-w-5xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <Compass size={22} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{tText('Pharmacy Visual Stock Locator', 'फार्मेसी विजुअल स्टॉक लोकेटर')}</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
                  <Navigation size={10} />
                  <span>Aisle & Shelf Navigation</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {tText('Instant 3D shelf coordinate mapping & retrieval path for pharmacists', 'फार्मासिस्टों के लिए तुरंत शेल्फ और भंडारण गलियारा खोज')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveViewTab('floor')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
                  activeViewTab === 'floor'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Grid size={13} />
                <span>{tText('Floor Plan', 'फ्लोर मैप')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('shelf')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
                  activeViewTab === 'shelf'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Layers size={13} />
                <span>{tText('Shelf Elevation', 'शेल्फ रैक व्यू')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('edit')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
                  activeViewTab === 'edit'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Edit3 size={13} />
                <span>{tText('Edit Location', 'स्थान बदलें')}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Search & Current Item Header Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-5 sm:px-7 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Quick Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={tText('Search any medicine to locate physical shelf...', 'दवा का नाम खोजें और शेल्फ पता करें...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Matching Medicine Pills */}
          {searchedMedicines.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                {tText('Select Item:', 'दवा चुनें:')}
              </span>
              {searchedMedicines.map(m => {
                const isSelected = activeMedicine?.id === m.id;
                const mLoc = getMedicineLocation(m);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMedicine(m);
                      setEditAisle(mLoc.aisle);
                      setEditRack(mLoc.rack);
                      setEditShelf(mLoc.shelf);
                      setEditBin(mLoc.bin || 'Bin 01');
                      setEditNotes(mLoc.notes || '');
                      if (onSelectMedicine) onSelectMedicine(m);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-xs shrink-0 transition-all border cursor-pointer flex items-center gap-1.5",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="truncate max-w-[110px]">{m.name}</span>
                    <span className={cn(
                      "text-[9px] px-1 py-0.2 rounded font-black",
                      isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {mLoc.aisle.replace('Aisle ', 'A-')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeMedicine ? (
            <>
              {/* Active Medicine Banner & Exact Physical Coordinates */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900 border border-blue-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                        {activeMedicine.name}
                      </h3>
                      <span className="rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        {activeMedicine.type}
                      </span>
                      {activeMedicine.genericName && (
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          ({activeMedicine.genericName})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                      <span>Stock: <strong className="text-slate-900 dark:text-slate-200">{activeMedicine.stockQuantity} units</strong></span>
                      <span>•</span>
                      <span>Rate: <strong className="text-slate-900 dark:text-slate-200">₹{activeMedicine.rate}</strong></span>
                      <span>•</span>
                      <span>Expiry: <strong className="text-slate-900 dark:text-slate-200">{formatDate(activeMedicine.expiryDate)}</strong></span>
                      {activeLocation.temperature && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400 font-bold">
                            <Thermometer size={12} />
                            <span>{activeLocation.temperature}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* High-Contrast Location Badge Coordinates */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-white dark:bg-slate-950 border-2 border-blue-500 rounded-xl px-3.5 py-2 shadow-xs">
                      <div className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <MapPin size={11} className="text-blue-600 animate-bounce" />
                        <span>EXACT PHYSICAL POSITION</span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-blue-600 dark:text-blue-400 underline decoration-2">{activeLocation.aisle}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span>{activeLocation.rack}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeLocation.shelf}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs">
                          {activeLocation.bin || 'Bin 01'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyDirection}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border",
                        copiedDirection
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                      )}
                      title="Copy exact pick instructions to clipboard"
                    >
                      {copiedDirection ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      <span>{copiedDirection ? tText('Copied!', 'कॉपी हो गया!') : tText('Copy Pick Slip', 'पिक स्लिप कॉपी करें')}</span>
                    </button>
                  </div>
                </div>

                {activeLocation.notes && (
                  <div className="mt-3 pt-2.5 border-t border-blue-100 dark:border-slate-700/60 flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                    <Info size={13} className="text-blue-600 shrink-0" />
                    <span><strong>Retrieval Guidance:</strong> {activeLocation.notes}</span>
                  </div>
                )}
              </div>

              {/* VIEW 1: INTERACTIVE 2D PHARMACY FLOOR PLAN */}
              {activeViewTab === 'floor' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Navigation size={15} className="text-blue-600" />
                        <span>{tText('Pharmacy Dispensary Layout & Walking Path', 'फार्मेसी लेआउट और नेविगेशन पाथ')}</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        {tText('Interactive floor zones. The glowing pin highlights the target aisle & rack.', 'सक्रिय गलियारे और रैक को हाइलाइट किया गया है।')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span className="h-3 w-3 rounded-full bg-blue-500 animate-ping inline-block" />
                        <span>Target Item</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span className="h-3 w-3 rounded bg-purple-200 border border-purple-400 inline-block" />
                        <span>Counter</span>
                      </span>
                    </div>
                  </div>

                  {/* 2D Interactive Dispensary Map Stage */}
                  <div className="relative w-full aspect-[16/9] max-h-[380px] bg-slate-900 rounded-3xl border-4 border-slate-800 p-4 shadow-xl overflow-hidden select-none">
                    {/* Architectural Grid Lines */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

                    {/* Entrance Marker */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-800/90 text-slate-400 border border-slate-700 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 z-10">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Pharmacy Dispensary Entrance</span>
                    </div>

                    {/* Render All Floor Plan Zones */}
                    {PHARMACY_FLOOR_ZONES.map((zone) => {
                      const isTargetZone = zone.id === activeLocation.aisle;
                      
                      return (
                        <div
                          key={zone.id}
                          style={{
                            left: `${zone.gridX}%`,
                            top: `${zone.gridY}%`,
                            width: `${zone.width}%`,
                            height: `${zone.height}%`
                          }}
                          className={cn(
                            "absolute rounded-2xl p-2.5 transition-all duration-300 flex flex-col justify-between border-2 z-10",
                            isTargetZone
                              ? "bg-blue-950/80 border-blue-400 shadow-2xl shadow-blue-500/40 ring-4 ring-blue-500/30 scale-[1.02]"
                              : "bg-slate-800/60 border-slate-700/80 hover:bg-slate-800/90 hover:border-slate-600"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                              isTargetZone ? "bg-blue-600 text-white animate-pulse" : "bg-slate-700/80 text-slate-300"
                            )}>
                              {zone.aisleCode}
                            </span>
                            
                            {isTargetZone && (
                              <span className="flex items-center gap-1 text-[9px] font-black text-blue-300 bg-blue-900/80 px-2 py-0.5 rounded-full border border-blue-400/40 animate-bounce">
                                <MapPin size={10} />
                                <span>TARGET</span>
                              </span>
                            )}
                          </div>

                          <div className="my-auto">
                            <p className={cn(
                              "text-xs font-extrabold truncate",
                              isTargetZone ? "text-blue-100" : "text-slate-300"
                            )}>
                              {zone.name.split(':')[1] || zone.name}
                            </p>
                            
                            {/* Racks inside zone */}
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {zone.racks.map(r => {
                                const isTargetRack = isTargetZone && r === activeLocation.rack;
                                return (
                                  <span
                                    key={r}
                                    className={cn(
                                      "text-[8px] font-black px-1.5 py-0.5 rounded tracking-tighter transition-all",
                                      isTargetRack
                                        ? "bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-300 animate-pulse"
                                        : "bg-slate-700/60 text-slate-400"
                                    )}
                                  >
                                    {r.replace('Rack ', '')}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <p className="text-[8px] text-slate-400 line-clamp-1">
                            {zone.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Retrieval Path Summary Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Navigation size={18} />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-slate-100">
                          {tText('Retrieval Path from POS Counter:', 'बिलिंग काउंटर से जाने का रास्ता:')}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-xs">
                          Walk forward to <strong>{activeLocation.aisle}</strong> ➔ Locate <strong>{activeLocation.rack}</strong> ➔ Pick from <strong>{activeLocation.shelf} ({activeLocation.bin || 'Bin 01'})</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveViewTab('shelf')}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
                    >
                      <Layers size={14} />
                      <span>{tText('Inspect Shelf Racks', 'शेल्फ रैक देखें')}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 2: VERTICAL SHELF RACK ELEVATION (CROSS SECTION) */}
              {activeViewTab === 'shelf' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Layers size={16} className="text-blue-600" />
                        <span>
                          {activeLocation.aisle} ➔ {activeLocation.rack} ({tText('Vertical Shelf Elevation', 'ऊर्ध्वाधर शेल्फ रैक दृश्य')})
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        {tText('Physical 4-tier rack structure with bin slots. Active slot is illuminated.', '4-टियर रैक और बिन स्लॉट। दवा का सटीक स्लॉट चमक रहा है।')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold">
                        {activeLocation.shelf}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
                        {activeLocation.bin || 'Bin 01'}
                      </span>
                    </div>
                  </div>

                  {/* 4-Tier Rack Diagram */}
                  <div className="bg-slate-900 rounded-3xl p-5 border-4 border-slate-800 shadow-2xl space-y-3.5">
                    {/* Rack Header Label */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 text-xs">
                      <span className="font-mono font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                        <Package size={13} className="text-blue-400" />
                        <span>BAY ELEVATION: {activeLocation.rack}</span>
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Storage Capacity: 32 Bins (4 Tiers × 8 Bins)
                      </span>
                    </div>

                    {/* 4 Shelf Tiers */}
                    {SHELF_PRESETS.map((tier) => {
                      const isTargetTier = activeShelfNum === tier.level;

                      return (
                        <div 
                          key={tier.id}
                          className={cn(
                            "rounded-2xl p-3 border-2 transition-all",
                            isTargetTier 
                              ? "bg-blue-950/70 border-blue-400/90 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30" 
                              : "bg-slate-800/40 border-slate-700/60"
                          )}
                        >
                          {/* Shelf Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                isTargetTier ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"
                              )}>
                                {tier.label}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                Level {tier.level}
                              </span>
                            </div>

                            {isTargetTier && (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 animate-pulse">
                                <CheckCircle2 size={11} />
                                <span>{activeMedicine.name} sits here</span>
                              </span>
                            )}
                          </div>

                          {/* 8 Bins in This Shelf */}
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {BIN_PRESETS.map((binName, idx) => {
                              const binNum = idx + 1;
                              const isTargetBin = isTargetTier && (
                                activeLocation.bin === binName || 
                                activeBinIndex === binNum ||
                                (activeLocation.bin && activeLocation.bin.includes(binNum.toString()))
                              );

                              return (
                                <div
                                  key={binName}
                                  className={cn(
                                    "rounded-xl p-2 flex flex-col justify-between text-center transition-all min-h-[64px] border",
                                    isTargetBin
                                      ? "bg-gradient-to-b from-blue-600 to-indigo-700 text-white border-blue-300 shadow-xl shadow-blue-600/40 ring-4 ring-blue-400 scale-105 z-10"
                                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:border-slate-500"
                                  )}
                                >
                                  <span className={cn(
                                    "text-[9px] font-black uppercase",
                                    isTargetBin ? "text-blue-100" : "text-slate-500"
                                  )}>
                                    {binName}
                                  </span>

                                  {isTargetBin ? (
                                    <div className="my-auto py-0.5">
                                      <p className="text-[10px] font-black leading-tight text-white line-clamp-1">
                                        {activeMedicine.name}
                                      </p>
                                      <p className="text-[8px] font-bold text-blue-200">
                                        {activeMedicine.stockQuantity} in stock
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-slate-600 my-auto">
                                      -
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Other Medicines in this Rack / Aisle */}
                  {nearbyMedicines.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Package size={14} className="text-blue-600" />
                          <span>{tText(`Other medicines in ${activeLocation.aisle} • ${activeLocation.rack}:`, `${activeLocation.aisle} में अन्य दवाएं:`)}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Pick all items in 1 trip
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {nearbyMedicines.map(item => {
                          const itemLoc = getMedicineLocation(item);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveMedicine(item);
                                setEditAisle(itemLoc.aisle);
                                setEditRack(itemLoc.rack);
                                setEditShelf(itemLoc.shelf);
                                setEditBin(itemLoc.bin || 'Bin 01');
                                setEditNotes(itemLoc.notes || '');
                              }}
                              className="text-left p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-all cursor-pointer shadow-2xs"
                            >
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                                <span>{itemLoc.shelf}</span>
                                <span className="font-bold text-blue-600">{item.stockQuantity} units</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: EDIT SHELF LOCATION FORM */}
              {activeViewTab === 'edit' && (
                <form onSubmit={handleSaveLocation} className="space-y-5">
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Sliders size={16} className="text-blue-600" />
                        <span>{tText('Assign Custom Shelf & Rack Position', 'कस्टम शेल्फ और रैक स्थान सेट करें')}</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        {tText('Update exact physical coordinates for', 'इसके लिए सटीक भौतिक स्थान अपडेट करें:')} <strong>{activeMedicine.name}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Storage Aisle / Zone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tText('Storage Aisle / Zone', 'भंडारण गलियारा / ज़ोन')}
                        </label>
                        <select
                          value={editAisle}
                          onChange={(e) => setEditAisle(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 outline-none focus:border-blue-500"
                        >
                          {AISLE_PRESETS.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Rack / Bay */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tText('Rack / Bay', 'रैक / बे')}
                        </label>
                        <select
                          value={editRack}
                          onChange={(e) => setEditRack(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 outline-none focus:border-blue-500"
                        >
                          {RACK_PRESETS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      {/* Shelf Level */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tText('Shelf Level (Tier)', 'शेल्फ स्तर (टियर)')}
                        </label>
                        <select
                          value={editShelf}
                          onChange={(e) => setEditShelf(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 outline-none focus:border-blue-500"
                        >
                          {SHELF_PRESETS.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Bin / Slot */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tText('Bin / Slot', 'बिन / स्लॉट')}
                        </label>
                        <select
                          value={editBin}
                          onChange={(e) => setEditBin(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 outline-none focus:border-blue-500"
                        >
                          {BIN_PRESETS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      {/* Retrieval / Handling Notes */}
                      <div className="col-span-1 sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tText('Handling / Picking Notes (Optional)', 'हैंडलिंग व पिकिंग निर्देश (वैकल्पिक)')}
                        </label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="e.g. Keep in amber bottle • FIFO pick earliest batch • Fast OTC pick"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveViewTab('shelf')}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {tText('Cancel', 'रद्द करें')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isSaving ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <Check size={15} />
                          <span>{tText('Save & Update Coordinates', 'स्थान सहेजें')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Compass size={40} className="opacity-30" />
              <p className="text-sm font-bold">{tText('No medicine selected for shelf location', 'स्थान देखने के लिए कोई दवा चुनें')}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-5 sm:px-7 py-3 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles size={14} className="text-blue-500" />
            <span>FIFO Picking Protocol: Always dispense earliest expiring batch first.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {tText('Done', 'पूर्ण')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VisualShelfLocatorModal;
