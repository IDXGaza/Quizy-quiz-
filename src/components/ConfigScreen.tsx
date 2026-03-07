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
  
  const [inputMethod, setInputMethod] = useState<'ai' | 'manual'>('ai');
  const [manualQuestions, setManualQuestions] = useState<Record<string, {question: string, answer: string, category?: string, points?: number}>>({});

  const LETTERS = [
    ['أ', 'ب', 'ت', 'ث', 'ج'],
    ['ح', 'خ', 'د', 'ذ', 'ر'],
    ['ز', 'س', 'ش', 'ص', 'ض'],
    ['ط', 'ظ', 'ع', 'غ', 'ف'],
    ['ق', 'ك', 'ل', 'م', 'ن']
  ];

  const JEOPARDY_STRUCTURE = [
    { category: 'الفئة الأولى', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الثانية', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الثالثة', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الرابعة', points: [100, 200, 300, 400, 500] },
  ];

  const handleManualChange = (key: string, field: string, value: any) => {
    setManualQuestions(prev => ({
      ...prev,
      [key]: { ...prev[key] || { question: '', answer: '' }, [field]: value }
    }));
  };

  const isManualValid = () => {
    if (mode === GameMode.HEX_GRID) {
      for (const letter of LETTERS.flat()) {
        const q = manualQuestions[letter];
        if (!q || !q.question.trim() || !q.answer.trim() || !q.answer.trimStart().startsWith(letter)) return false;
      }
    } else if (mode === GameMode.GRID) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          const key = `j-${i}-${j}`;
          const q = manualQuestions[key];
          if (!q || !q.question.trim() || !q.answer.trim()) return false;
        }
      }
    } else {
      // For Buzzer/Points, let's assume 10 questions
      for (let i = 0; i < 10; i++) {
        const q = manualQuestions[`b-${i}`];
        if (!q || !q.question.trim() || !q.answer.trim()) return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMethod === 'manual' && !isManualValid()) {
      alert('الرجاء إكمال جميع الأسئلة المطلوبة بشكل صحيح');
      return;
    }

    const hexColors = ['#ff0000', '#008000']; 
    const defaultColors = ['#0ea5e9', '#1e3a8a', '#0369a1', '#0c4a6e'];
    const colors = mode === GameMode.HEX_GRID ? hexColors : defaultColors;

    const players: Player[] = playerNames.map((name, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      score: 0,
      color: colors[i % colors.length]
    }));

    // Convert manual questions to standard format if needed
    let finalManualQuestions: any[] = [];
    if (inputMethod === 'manual') {
      if (mode === GameMode.HEX_GRID) {
        // Handled by GameScreen via hexManualQuestions
      } else if (mode === GameMode.GRID) {
        JEOPARDY_STRUCTURE.forEach((cat, i) => {
          cat.points.forEach((p, j) => {
            const q = manualQuestions[`j-${i}-${j}`];
            finalManualQuestions.push({
              id: `m-${i}-${j}`,
              text: q.question,
              answer: q.answer,
              category: q.category || cat.category,
              points: p,
              type: QuestionType.OPEN,
              difficulty
            });
          });
        });
      } else {
        for (let i = 0; i < 10; i++) {
          const q = manualQuestions[`b-${i}`];
          finalManualQuestions.push({
            id: `m-b-${i}`,
            text: q.question,
            answer: q.answer,
            category: topic,
            points: 100,
            type: QuestionType.OPEN,
            difficulty
          });
        }
      }
    }
    
    onStart({ 
      topic, 
      numQuestions: mode === GameMode.HEX_GRID ? 25 : (mode === GameMode.GRID ? 20 : 10), 
      mode, 
      questionTypes: [QuestionType.OPEN], 
      difficulty,
      players,
      manualQuestions: finalManualQuestions,
      hexMode: inputMethod,
      hexManualQuestions: mode === GameMode.HEX_GRID ? manualQuestions as any : undefined
    });
  };

  return (
    <div className="bg-slate-900 text-white rounded-[3rem] p-10 md:p-16 max-w-5xl mx-auto shadow-2xl border border-slate-800 animate-fade-up">
      <div className="mb-14 text-center">
        <h2 className="text-4xl font-black mb-3">تجهيز المسابقة</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">اختر طريقة اللعب ومصدر الأسئلة</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Game Mode Selection */}
        <div className="space-y-5">
          <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">نظام اللعبة</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { val: GameMode.HEX_GRID, label: 'شبكة الحروف', icon: '🔠', desc: 'مسارات وتوصيل حروف' },
              { val: GameMode.GRID, label: 'الشبكة الكلاسيكية', icon: '🎯', desc: 'فئات ونقاط (جيبوردي)' },
              { val: GameMode.BUZZER, label: 'تحدي البازر', icon: '⚡', desc: 'أسرع إجابة' }
            ].map(m => (
              <button
                key={m.val}
                type="button"
                onClick={() => setMode(m.val)}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${mode === m.val ? 'border-sky-500 bg-sky-500/10 shadow-lg scale-105' : 'border-slate-800 bg-slate-800 hover:border-slate-700'}`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${mode === m.val ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {m.icon}
                </div>
                <div className="text-center">
                  <div className={`text-lg font-black ${mode === m.val ? 'text-white' : 'text-slate-400'}`}>{m.label}</div>
                  <div className="text-[10px] text-slate-500 font-bold">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Input Method Selection */}
        <div className="space-y-8 border-2 border-slate-800 p-8 rounded-[2.5rem] bg-slate-800/30">
          <div className="grid md:grid-cols-2 gap-6">
            <button 
              type="button"
              onClick={() => setInputMethod('ai')}
              className={`p-8 rounded-3xl border-4 transition-all text-right group ${inputMethod === 'ai' ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-5xl group-hover:scale-110 transition-transform">🤖</div>
                {inputMethod === 'ai' && <div className="bg-sky-500 text-white text-[10px] px-3 py-1 rounded-full font-black">مختار</div>}
              </div>
              <h3 className="text-2xl font-black mb-2">توليد بالذكاء الاصطناعي</h3>
              <p className="text-slate-400 text-sm leading-relaxed">توليد تلقائي فوري للمسابقة بناءً على الموضوع المختار. سريع وذكي.</p>
            </button>
            
            <button 
              type="button"
              onClick={() => setInputMethod('manual')}
              className={`p-8 rounded-3xl border-4 transition-all text-right group ${inputMethod === 'manual' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-5xl group-hover:scale-110 transition-transform">✍️</div>
                {inputMethod === 'manual' && <div className="bg-amber-500 text-white text-[10px] px-3 py-1 rounded-full font-black">مختار</div>}
              </div>
              <h3 className="text-2xl font-black mb-2">إضافة يدوية</h3>
              <p className="text-slate-400 text-sm leading-relaxed">أدخل أسئلتك الخاصة يدوياً لتتحكم في كل تفاصيل المسابقة.</p>
            </button>
          </div>

          {inputMethod === 'ai' ? (
            <div className="space-y-4 animate-fade-in">
              <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">موضوع التحدي</label>
              <input 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 p-6 rounded-2xl focus:ring-4 focus:ring-sky-500/20 outline-none transition-all text-2xl font-black text-white shadow-inner"
                placeholder="مثال: الفضاء، تاريخ الأندلس، كرة القدم..."
                required
              />
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in pt-6 border-t border-slate-700">
              <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30 flex justify-between items-center">
                <p className="font-black text-amber-400 text-sm">
                  {mode === GameMode.HEX_GRID 
                    ? '💡 أدخل سؤالاً وإجابة لكل حرف (25 حرفاً). يجب أن تبدأ الإجابة بالحرف المخصص.' 
                    : mode === GameMode.GRID 
                    ? '💡 أدخل 20 سؤالاً مقسمة على 4 فئات، كل فئة 5 مستويات من النقاط.'
                    : '💡 أدخل 10 أسئلة متنوعة للمسابقة.'}
                </p>
                <button 
                  type="button"
                  onClick={() => {
                    // Simple sample data generator
                    const samples: any = {};
                    if (mode === GameMode.HEX_GRID) {
                      LETTERS.flat().forEach(l => {
                        samples[l] = { question: `سؤال يبدأ بحرف ${l}؟`, answer: `${l} إجابة` };
                      });
                    } else if (mode === GameMode.GRID) {
                      JEOPARDY_STRUCTURE.forEach((cat, i) => {
                        samples[`cat-${i}`] = { category: `فئة ${i+1}` };
                        cat.points.forEach((p, j) => {
                          samples[`j-${i}-${j}`] = { question: `سؤال ${p} في فئة ${i+1}؟`, answer: `إجابة ${p}` };
                        });
                      });
                    } else {
                      Array.from({ length: 10 }).forEach((_, i) => {
                        samples[`b-${i}`] = { question: `سؤال رقم ${i+1}؟`, answer: `إجابة ${i+1}` };
                      });
                    }
                    setManualQuestions(samples);
                  }}
                  className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 transition-all"
                >
                  تعبئة تلقائية للتجربة
                </button>
              </div>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {mode === GameMode.HEX_GRID ? (
                  LETTERS.flat().map(letter => {
                    const q = manualQuestions[letter] || { question: '', answer: '' };
                    const isValid = q.answer.trim() === '' || q.answer.trimStart().startsWith(letter);
                    return (
                      <div key={letter} className={`flex gap-4 items-start p-5 rounded-2xl border-2 bg-slate-900 ${!isValid ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800'}`}>
                        <div className="w-14 h-14 shrink-0 bg-slate-800 text-white rounded-xl flex items-center justify-center text-2xl font-black">
                          {letter}
                        </div>
                        <div className="flex-1 space-y-3">
                          <input 
                            type="text" placeholder="نص السؤال..." value={q.question}
                            onChange={e => handleManualChange(letter, 'question', e.target.value)}
                            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white font-bold"
                          />
                          <input 
                            type="text" placeholder={`الإجابة (تبدأ بـ ${letter})`} value={q.answer}
                            onChange={e => handleManualChange(letter, 'answer', e.target.value)}
                            className={`w-full p-4 bg-slate-800 border rounded-xl outline-none text-white font-bold ${!isValid ? 'border-red-500 text-red-400' : 'border-slate-700 focus:border-amber-500'}`}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : mode === GameMode.GRID ? (
                  JEOPARDY_STRUCTURE.map((cat, catIdx) => (
                    <div key={catIdx} className="space-y-4 p-6 border-2 border-slate-800 rounded-3xl bg-slate-900/50">
                      <input 
                        className="bg-transparent text-xl font-black text-sky-400 w-full outline-none border-b border-slate-800 pb-2 mb-4"
                        value={manualQuestions[`cat-${catIdx}`]?.category || cat.category}
                        onChange={e => handleManualChange(`cat-${catIdx}`, 'category', e.target.value)}
                        placeholder="اسم الفئة..."
                      />
                      {cat.points.map((p, pIdx) => {
                        const key = `j-${catIdx}-${pIdx}`;
                        const q = manualQuestions[key] || { question: '', answer: '' };
                        return (
                          <div key={p} className="flex gap-4 items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                            <div className="w-16 text-center font-black text-amber-500">{p}</div>
                            <div className="flex-1 space-y-2">
                              <input 
                                type="text" placeholder="السؤال..." value={q.question}
                                onChange={e => handleManualChange(key, 'question', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-sky-500"
                              />
                              <input 
                                type="text" placeholder="الإجابة..." value={q.answer}
                                onChange={e => handleManualChange(key, 'answer', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  Array.from({ length: 10 }).map((_, i) => {
                    const key = `b-${i}`;
                    const q = manualQuestions[key] || { question: '', answer: '' };
                    return (
                      <div key={i} className="flex gap-4 items-center bg-slate-900 p-5 rounded-2xl border-2 border-slate-800">
                        <div className="w-10 h-10 shrink-0 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-500">{i + 1}</div>
                        <div className="flex-1 space-y-3">
                          <input 
                            type="text" placeholder="السؤال..." value={q.question}
                            onChange={e => handleManualChange(key, 'question', e.target.value)}
                            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-sky-500 font-bold"
                          />
                          <input 
                            type="text" placeholder="الإجابة..." value={q.answer}
                            onChange={e => handleManualChange(key, 'answer', e.target.value)}
                            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 font-bold"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Players and Difficulty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <label className="text-xs font-black text-sky-400 uppercase tracking-[0.3em] pr-2">المتنافسون</label>
            <div className="space-y-3">
              {playerNames.map((name, i) => (
                <div key={i} className="group flex gap-3">
                  <input 
                    value={name}
                    onChange={e => {
                      const n = [...playerNames]; n[i] = e.target.value; setPlayerNames(n);
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 p-5 rounded-2xl text-lg font-black focus:ring-2 focus:ring-sky-500/20 outline-none shadow-sm transition-all text-white"
                    placeholder={`متسابق ${i+1}`}
                  />
                  {playerNames.length > 2 && (
                    <button type="button" onClick={() => setPlayerNames(playerNames.filter((_, idx) => idx !== i))} className="w-14 h-14 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold">✕</button>
                  )}
                </div>
              ))}
              {playerNames.length < 4 && mode !== GameMode.HEX_GRID && (
                <button type="button" onClick={() => setPlayerNames([...playerNames, `متسابق جديد`])} className="w-full py-5 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 text-xs font-black hover:bg-slate-800 hover:border-slate-600 transition-all">+ إضافة منافس</button>
              )}
            </div>
          </div>

          <div className="space-y-6">
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
                  className={`flex-1 py-5 rounded-2xl border-2 transition-all font-black text-lg ${difficulty === d.val ? `border-white ${d.color} text-white shadow-lg scale-105` : 'border-slate-800 bg-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="w-full py-8 sky-btn rounded-[2rem] text-3xl font-black shadow-2xl mt-10 tracking-widest text-white uppercase">
          انطلاق المسابقة
        </button>
      </form>
    </div>
  );
};

export default ConfigScreen;