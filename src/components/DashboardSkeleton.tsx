import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 animate-pulse select-none">
      {/* Header Skeleton */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mt-1.5 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="h-9 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </header>

      {/* Monthly Idea Widget Banner Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2 w-full sm:w-auto">
              <div className="h-4 w-48 sm:w-64 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-36 sm:w-80 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
          </div>
          <div className="h-9 w-32 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
        </div>
      </div>

      {/* 5 Stats Cards Grid Skeleton */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="h-3 w-64 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
                <div className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800/60" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-7 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-36 rounded bg-slate-100 dark:bg-slate-800/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Expiries Summary Widget Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-24 rounded-full bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="h-3 w-64 rounded bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="h-8 w-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        {/* Urgency Summary Pill Rows */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/30"
            >
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>

        {/* Expiry Items List Skeletons */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3.5 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                  <div className="h-3 w-48 rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="h-3 w-60 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              </div>
              <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 self-end sm:self-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column Section: Chart & Recent Sales */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Sales Chart Skeleton */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-28 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="h-[280px] w-full flex items-end gap-4 pt-8 px-4 pb-2 border-b border-l border-slate-100 dark:border-slate-800">
            {[40, 65, 30, 85, 55, 90, 75].map((heightPct, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full rounded-t-lg bg-slate-200/80 dark:bg-slate-800/80"
                  style={{ height: `${heightPct}%` }}
                />
                <div className="h-2.5 w-6 rounded bg-slate-100 dark:bg-slate-800/60" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-slate-50 p-4 dark:border-slate-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-800 ml-auto" />
                  <div className="h-2.5 w-10 rounded bg-slate-100 dark:bg-slate-800/60 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligent Services Quick Access Skeleton */}
        <div className="lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-3 w-36 rounded bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="mb-2 h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mb-4 space-y-1">
                  <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity Logs Skeleton */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-7 w-36 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex gap-4 rounded-xl border border-slate-50 p-4 dark:border-slate-800/50"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-10 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                  <div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
