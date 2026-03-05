import React, { useState } from 'react';
import { GameConfig, GameMode, QuestionType, Player, Difficulty } from '../types';

interface Props {
  onStart: (config: GameConfig) => void;
}

const ConfigScreen: React.FC<Props> = ({ onStart }) => {
  const [topic, setTopic] = useState('ثقافة عامة');
  const [mode, setMode] = useState<GameMode>(GameMode.HEX_GRID);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [playerNames, setPlayerNames] = useState<string[]>(['الفريق الأحمر', 'الفريق الأخضر']);
  
  const [hexMode, setHexMode] = useState<'ai' | 'manual'>('ai');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [manualQuestions, setManualQuestions] = useState<Record<string, {question: string, answer: string}>>({});

  const CATEGORIES = ['علوم وطبيعة', 'جغرافيا', 'تاريخ', 'رياضة', 'ثقافة عامة', 'فن وأدب'];
  const LETTERS = [
    ['أ', 'ب', 'ت', 'ث', 'ج'],
    ['ح', 'خ', 'د', 'ذ', 'ر'],
    ['ز', 'س', 'ش', 'ص', 'ض'],
    ['ط', 'ظ', 'ع', 'غ', 'ف'],
    ['ق', 'ك', 'ل', 'م', 'ن']
  ];

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleManualChange = (letter: string, field: 'question' | 'answer', value: string) => {
    setManualQuestions(prev => ({
      ...prev,
      [letter]: { ...prev[letter] || { question: '', answer: '' }, [field]: value }
    }));
  };

  const isManualValid = () => {
    for (const row of LETTERS) {
      for (const letter of row) {
        const q = manualQuestions[letter];
        if (!q || !q.question.trim() || !q.answer.trim() || !q.answer.trimStart().startsWith(letter)) {
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === GameMode.HEX_GRID && hexMode === 'manual' && !isManualValid()) {
      alert('الرجاء إكمال جميع الأسئلة اليدوية بشكل صحيح');
      return;
    }

    // استخدام الألوان الصريحة للمسارات
    const hexColors = ['#ff0000', '#008000']; 
    const defaultColors = ['#0ea5e9', '#1e3a8a', '#0369a1', '#0c4a6e'];
    
    const colors = mode === GameMode.HEX_GRID ? hexColors : defaultColors;

    const players: Player[] = playerNames.map((name, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      score: 0,
      color: colors[i % colors.length]
    }));
    
    onStart({ 
      topic, 
      numQuestions: mode === GameMode.HEX_GRID ? 30 : 20, 
      mode, 
      questionTypes: [QuestionType.OPEN], 
      difficulty,
      players,
      manualQuestions: [],
      hexMode,
      hexCategories: selectedCategories,
      hexManualQuestions: manualQuestions
    });
  };

  return (
    <div className="bg-slate-900 text-white rounded-[3rem] p-10 md:p-16 max-w-5xl mx-auto shadow-2xl border border-slate-800 animate-fade-up">
      <div className="mb-14 text-center">
        <h2 className="text-4xl font-black mb-3">تجهيز المسابقة</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">اصنع تحديك الخاص بالذكاء الاصطناعي</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="space-y-4">
          <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">موضوع التحدي</label>
          <input 
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 p-6 rounded-3xl focus:ring-4 focus:ring-sky-500/20 outline-none transition-all text-2xl font-black text-white shadow-sm"
            placeholder="مثال: الفضاء، تاريخ الأندلس، كرة القدم..."
            required={mode !== GameMode.HEX_GRID || hexMode === 'ai'}
          />
        </div>

        {mode === GameMode.HEX_GRID && (
          <div className="space-y-8 border-2 border-slate-800 p-8 rounded-3xl bg-slate-800/50">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">كيف تريد إضافة الأسئلة؟</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <button 
                type="button"
                onClick={() => setHexMode('ai')}
                className={`p-6 rounded-2xl border-4 transition-all text-right ${hexMode === 'ai' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
              >
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-2xl font-bold mb-2">ذكاء اصطناعي</h3>
                <p className="text-slate-400">يولد أسئلة متنوعة تلقائياً لكل حرف بناءً على الموضوع المختار.</p>
              </button>
              
              <button 
                type="button"
                onClick={() => setHexMode('manual')}
                className={`p-6 rounded-2xl border-4 transition-all text-right ${hexMode === 'manual' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
              >
                <div className="text-4xl mb-4">✍️</div>
                <h3 className="text-2xl font-bold mb-2">إضافة يدوية</h3>
                <p className="text-slate-400">أضف أسئلتك وإجاباتك يدوياً لكل حرف في اللوح.</p>
              </button>
            </div>

            {hexMode === 'manual' && (
              <div className="space-y-6 animate-fade-in pt-6 border-t border-slate-700">
                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 mb-6">
                  <p className="font-bold text-amber-400">⚠️ تنبيه: يجب أن تبدأ الإجابة بالحرف المخصص للخلية.</p>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {LETTERS.flat().map(letter => {
                    const q = manualQuestions[letter] || { question: '', answer: '' };
                    const isValid = q.answer.trim() === '' || q.answer.trimStart().startsWith(letter);
                    
                    return (
                      <div key={letter} className={`flex gap-4 items-start p-4 rounded-xl border-2 bg-slate-800 ${!isValid ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700'}`}>
                        <div className="w-16 h-16 shrink-0 bg-slate-900 text-white rounded-lg flex items-center justify-center text-3xl font-bold font-['Scheherazade_New']">
                          {letter}
                        </div>
                        <div className="flex-1 space-y-3">
                          <input 
                            type="text" 
                            placeholder="نص السؤال..." 
                            value={q.question}
                            onChange={e => handleManualChange(letter, 'question', e.target.value)}
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg focus:border-amber-500 outline-none text-white"
                          />
                          <input 
                            type="text" 
                            placeholder={`الإجابة (يجب أن تبدأ بحرف ${letter})`} 
                            value={q.answer}
                            onChange={e => handleManualChange(letter, 'answer', e.target.value)}
                            className={`w-full p-3 bg-slate-900 border rounded-lg outline-none text-white ${!isValid ? 'border-red-500 text-red-400' : 'border-slate-700 focus:border-amber-500'}`}
                          />
                          {!isValid && <p className="text-red-400 text-sm font-bold">الإجابة لا تبدأ بحرف "{letter}"!</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-5">
            <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">نظام اللعبة</label>
            <div className="grid gap-3">
              {[
                { val: GameMode.HEX_GRID, label: 'شبكة الحروف (المسارات)', icon: '🔠' },
                { val: GameMode.GRID, label: 'الشبكة الكلاسيكية (فئات)', icon: '🎯' },
                { val: GameMode.BUZZER, label: 'تحدي أسرع إجابة (بازر)', icon: '⚡' }
              ].map(m => (
                <button
                  key={m.val}
                  type="button"
                  onClick={() => setMode(m.val)}
                  className={`p-5 rounded-2xl border-2 flex items-center gap-5 transition-all ${mode === m.val ? 'border-sky-500 bg-sky-500/10 shadow-md scale-102' : 'border-slate-800 bg-slate-800 hover:border-slate-700'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${mode === m.val ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {m.icon}
                  </div>
                  <span className={`text-lg font-black ${mode === m.val ? 'text-white' : 'text-slate-400'}`}>{m.label}</span>
                </button>
              ))}
            </div>
            
            <div className="pt-6 space-y-5">
              <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">مستوى الصعوبة</label>
              <div className="flex gap-3">
                {[
                  { val: Difficulty.EASY, label: 'سهل', color: 'bg-green-600' },
                  { val: Difficulty.MEDIUM, label: 'متوسط', color: 'bg-yellow-600' },
                  { val: Difficulty.HARD, label: 'صعب', color: 'bg-red-600' }
                ].map(d => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setDifficulty(d.val)}
                    className={`flex-1 py-4 rounded-2xl border-2 transition-all font-black text-lg ${difficulty === d.val ? `border-white ${d.color} text-white shadow-lg scale-105` : 'border-slate-800 bg-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">المتنافسون</label>
            <div className="space-y-3">
              {playerNames.map((name, i) => (
                <div key={i} className="group flex gap-3">
                  <input 
                    value={name}
                    onChange={e => {
                      const n = [...playerNames]; n[i] = e.target.value; setPlayerNames(n);
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg font-black focus:ring-2 focus:ring-sky-500/20 outline-none shadow-sm transition-all text-white"
                    placeholder={`متسابق ${i+1}`}
                  />
                  {playerNames.length > 2 && (
                    <button type="button" onClick={() => setPlayerNames(playerNames.filter((_, idx) => idx !== i))} className="w-12 h-12 bg-red-900/30 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold">✕</button>
                  )}
                </div>
              ))}
              {playerNames.length < 4 && mode !== GameMode.HEX_GRID && (
                <button type="button" onClick={() => setPlayerNames([...playerNames, `متسابق جديد`])} className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 text-xs font-black hover:bg-slate-800 hover:border-slate-600 transition-all">+ إضافة منافس</button>
              )}
            </div>
          </div>
        </div>

        <button type="submit" className="w-full py-7 sky-btn rounded-3xl text-2xl font-black shadow-2xl mt-10 tracking-widest text-white uppercase">
          انطلاق المسابقة
        </button>
      </form>
    </div>
  );
};

export default ConfigScreen;