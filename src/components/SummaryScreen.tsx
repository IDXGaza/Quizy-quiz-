
import React from 'react';
import { Player } from '../types';

interface Props {
  players: Player[];
  onRestart: () => void;
}

const SummaryScreen: React.FC<Props> = ({ players, onRestart }) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  
  return (
    <div className="bg-white/90 backdrop-blur-xl p-12 md:p-20 max-w-2xl mx-auto text-center rounded-[4rem] shadow-2xl border border-white animate-fade-up">
      <div className="mb-14">
        <div className="text-7xl mb-6">🏆</div>
        <h2 className="text-4xl font-black sky-text mb-2">انتهى التحدي</h2>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">النتائج النهائية للمسابقة</p>
      </div>

      <div className="space-y-4 mb-16">
        {sorted.map((p, idx) => (
          <div key={p.id} className={`flex items-center justify-between p-6 rounded-3xl border transition-all ${idx === 0 ? 'border-sky-200 bg-sky-50/50 shadow-lg' : 'border-slate-100 bg-slate-50/50'}`}>
            <div className="flex items-center gap-5">
              <span className={`text-xl font-black w-10 h-10 rounded-xl flex items-center justify-center ${idx === 0 ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
                {idx + 1}
              </span>
              <span className={`text-2xl font-black ${idx === 0 ? 'text-sky-900' : 'text-slate-600'}`}>{p.name}</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black sky-text">{p.score}</span>
              <span className="text-[10px] font-bold text-slate-300 block uppercase tracking-widest">نقطة</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onRestart} className="sky-btn w-full py-6 rounded-2xl font-black text-2xl shadow-xl">العودة للرئيسية</button>
    </div>
  );
};

export default SummaryScreen;
