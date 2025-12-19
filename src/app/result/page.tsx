import { Suspense } from 'react';
import ResultListClient from './ResultListClient';

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 pb-16">
          <div className="mx-auto mt-8 max-w-[108rem] space-y-4">
            <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
              加载中...
            </div>
          </div>
        </div>
      }
    >
      <ResultListClient />
    </Suspense>
  );
}
