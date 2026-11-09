import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import { Clock, Activity, Calendar, Zap, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DosageTimeSlot {
  time: string;
  slot: string;
  doseMg: number;
  status?: string;
  levelPct: number;
}

export interface PlasmaCurvePoint {
  hour: string;
  concentration: number;
  threshold?: number;
}

export interface DosageScheduleData {
  type?: 'dosage_schedule';
  medicine?: string;
  regimen?: string;
  frequencyPattern?: string;
  schedule?: DosageTimeSlot[];
  plasmaCurve?: PlasmaCurvePoint[];
}

interface DosageScheduleChartProps {
  data?: DosageScheduleData;
  medicineName?: string;
}

const DEFAULT_SCHEDULES: Record<string, { regimen: string; pattern: string; slots: DosageTimeSlot[]; plasma: PlasmaCurvePoint[] }> = {
  OD: {
    regimen: 'OD (Once Daily)',
    pattern: 'Every 24 hours (Morning at 08:00 AM)',
    slots: [
      { time: '08:00 AM', slot: 'Morning', doseMg: 500, status: 'Primary Dose', levelPct: 100 },
      { time: '02:00 PM', slot: 'Afternoon', doseMg: 0, status: 'Resting', levelPct: 60 },
      { time: '08:00 PM', slot: 'Evening', doseMg: 0, status: 'Resting', levelPct: 35 },
      { time: '11:00 PM', slot: 'Night', doseMg: 0, status: 'Trough', levelPct: 20 },
    ],
    plasma: [
      { hour: '0h', concentration: 15, threshold: 20 },
      { hour: '2h', concentration: 95, threshold: 20 },
      { hour: '6h', concentration: 70, threshold: 20 },
      { hour: '12h', concentration: 45, threshold: 20 },
      { hour: '18h', concentration: 30, threshold: 20 },
      { hour: '24h', concentration: 20, threshold: 20 },
    ]
  },
  BD: {
    regimen: 'BD (Twice Daily)',
    pattern: 'Every 12 hours (08:00 AM & 08:00 PM)',
    slots: [
      { time: '08:00 AM', slot: 'Morning', doseMg: 500, status: '1st Dose', levelPct: 100 },
      { time: '02:00 PM', slot: 'Afternoon', doseMg: 0, status: 'Sustained', levelPct: 55 },
      { time: '08:00 PM', slot: 'Night', doseMg: 500, status: '2nd Dose', levelPct: 100 },
      { time: '02:00 AM', slot: 'Late Night', doseMg: 0, status: 'Sustained', levelPct: 55 },
    ],
    plasma: [
      { hour: '0h', concentration: 20, threshold: 20 },
      { hour: '2h', concentration: 90, threshold: 20 },
      { hour: '6h', concentration: 55, threshold: 20 },
      { hour: '12h', concentration: 25, threshold: 20 },
      { hour: '14h', concentration: 92, threshold: 20 },
      { hour: '18h', concentration: 60, threshold: 20 },
      { hour: '24h', concentration: 22, threshold: 20 },
    ]
  },
  TDS: {
    regimen: 'TDS (Three Times Daily)',
    pattern: 'Every 8 hours (08:00 AM, 02:00 PM & 08:00 PM)',
    slots: [
      { time: '08:00 AM', slot: 'Morning', doseMg: 500, status: '1st Dose', levelPct: 100 },
      { time: '02:00 PM', slot: 'Afternoon', doseMg: 500, status: '2nd Dose', levelPct: 100 },
      { time: '08:00 PM', slot: 'Night', doseMg: 500, status: '3rd Dose', levelPct: 100 },
      { time: '02:00 AM', slot: 'Late Night', doseMg: 0, status: 'Elimination', levelPct: 35 },
    ],
    plasma: [
      { hour: '0h', concentration: 20, threshold: 20 },
      { hour: '2h', concentration: 95, threshold: 20 },
      { hour: '6h', concentration: 40, threshold: 20 },
      { hour: '8h', concentration: 95, threshold: 20 },
      { hour: '12h', concentration: 50, threshold: 20 },
      { hour: '14h', concentration: 98, threshold: 20 },
      { hour: '18h', concentration: 60, threshold: 20 },
      { hour: '24h', concentration: 25, threshold: 20 },
    ]
  },
  QDS: {
    regimen: 'QDS (Four Times Daily)',
    pattern: 'Every 6 hours (06:00 AM, 12:00 PM, 06:00 PM & 10:00 PM)',
    slots: [
      { time: '06:00 AM', slot: 'Early Morning', doseMg: 250, status: '1st Dose', levelPct: 100 },
      { time: '12:00 PM', slot: 'Noon', doseMg: 250, status: '2nd Dose', levelPct: 100 },
      { time: '06:00 PM', slot: 'Evening', doseMg: 250, status: '3rd Dose', levelPct: 100 },
      { time: '10:00 PM', slot: 'Bedtime', doseMg: 250, status: '4th Dose', levelPct: 100 },
    ],
    plasma: [
      { hour: '0h', concentration: 25, threshold: 20 },
      { hour: '2h', concentration: 88, threshold: 20 },
      { hour: '6h', concentration: 92, threshold: 20 },
      { hour: '12h', concentration: 95, threshold: 20 },
      { hour: '18h', concentration: 90, threshold: 20 },
      { hour: '22h', concentration: 96, threshold: 20 },
      { hour: '24h', concentration: 30, threshold: 20 },
    ]
  }
};

export const DosageScheduleChart: React.FC<DosageScheduleChartProps> = ({ data, medicineName }) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'plasma'>('timeline');
  const [selectedRegimen, setSelectedRegimen] = useState<'OD' | 'BD' | 'TDS' | 'QDS'>('TDS');

  const medTitle = data?.medicine || medicineName || 'Medicine Dosage Schedule';
  const currentPreset = DEFAULT_SCHEDULES[selectedRegimen];
  const scheduleData = data?.schedule && data.schedule.length > 0 ? data.schedule : currentPreset.slots;
  const plasmaData = data?.plasmaCurve && data.plasmaCurve.length > 0 ? data.plasmaCurve : currentPreset.plasma;
  const regimenText = data?.regimen || currentPreset.regimen;
  const patternText = data?.frequencyPattern || currentPreset.pattern;

  return (
    <div id="dosage-schedule-chart-container" className="my-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div id="dosage-chart-header" className="border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Clock size={18} />
            </div>
            <div>
              <h4 id="dosage-chart-med-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">{medTitle}</h4>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {regimenText} &bull; <span className="text-blue-600 dark:text-blue-400">{patternText}</span>
              </p>
            </div>
          </div>

          <div id="dosage-preset-selector" className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {(['OD', 'BD', 'TDS', 'QDS'] as const).map((r) => (
              <button
                key={r}
                id={`preset-btn-${r.toLowerCase()}`}
                onClick={() => setSelectedRegimen(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase transition-all",
                  selectedRegimen === r
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <button
              id="tab-daily-timeline"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                activeTab === 'timeline'
                  ? "bg-slate-900 text-white dark:bg-blue-600"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              )}
            >
              <Calendar size={13} />
              <span>Daily Intake Timeline</span>
            </button>
            <button
              id="tab-plasma-concentration"
              onClick={() => setActiveTab('plasma')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                activeTab === 'plasma'
                  ? "bg-slate-900 text-white dark:bg-blue-600"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              )}
            >
              <Activity size={13} />
              <span>24h Concentration Curve</span>
            </button>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
            <Zap size={12} />
            Therapeutic Level Active
          </span>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-slate-900">
        {activeTab === 'timeline' ? (
          <div>
            <p className="mb-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Info size={12} className="text-blue-500 dark:text-blue-400" />
              Dosage intensity and timing throughout a 24-hour cycle:
            </p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scheduleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as DosageTimeSlot;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{item.time} ({item.slot})</p>
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                              Dose: {item.doseMg > 0 ? `${item.doseMg} mg` : 'No Dose Needed'}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Status: {item.status || 'Scheduled'}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="levelPct" radius={[8, 8, 0, 0]}>
                    {scheduleData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.doseMg > 0 ? '#3b82f6' : '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Activity size={12} className="text-emerald-500 dark:text-emerald-400" />
              Simulated blood plasma concentration profile over 24 hours:
            </p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={plasmaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plasmaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as PlasmaCurvePoint;
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Time: {item.hour}</p>
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                              Plasma Conc: {item.concentration}%
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Therapeutic Minimum: {item.threshold || 20}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="concentration"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#plasmaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[10px] text-slate-500 dark:border-slate-700/50 dark:bg-slate-900/50 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <AlertCircle size={12} className="text-amber-500" />
          Always follow specific doctor instructions & prescription labeling.
        </span>
        <span className="font-semibold text-slate-600 dark:text-slate-400">Interactive Clinical Model</span>
      </div>
    </div>
  );
};
