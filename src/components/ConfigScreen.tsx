import React, { useState } from 'react';
import { GameConfig, GameMode, QuestionType, Player, Difficulty } from '../types';
import { Type } from "@google/genai";
import { getAI, extractJson } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';

interface Props {
  onStart: (config: GameConfig) => void;
}

const ConfigScreen: React.FC<Props> = ({ onStart }) => {
  const { showToast } = useToast();
  const [topic, setTopic] = useState('ثقافة عامة');
  const [mode, setMode] = useState<GameMode>(GameMode.HEX_GRID);
  const [numQuestionsState, setNumQuestionsState] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [categories, setCategories] = useState<string[]>(['', '', '', '', '']);
  const [playersConfig, setPlayersConfig] = useState<{name: string, color: string}[]>([
    { name: 'الفريق الأحمر', color: '#ef4444' },
    { name: 'الفريق الأخضر', color: '#22c55e' }
  ]);
  
  const [inputMethod, setInputMethod] = useState<'ai' | 'manual'>('ai');
  const [manualQuestions, setManualQuestions] = useState<Record<string, {question: string, answer: string, category?: string, points?: number, imageUrl?: string, explanation?: string}>>({});
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false);

  const LETTERS = [
    ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'],
    ['د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'],
    ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق'],
    ['ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي']
  ];

  const JEOPARDY_STRUCTURE = [
    { category: 'الفئة الأولى', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الثانية', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الثالثة', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الرابعة', points: [100, 200, 300, 400, 500] },
    { category: 'الفئة الخامسة', points: [100, 200, 300, 400, 500] },
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
      for (let i = 0; i < 5; i++) {
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

  const generateAISamples = async () => {
    if (!topic.trim()) {
      showToast("الرجاء إدخال موضوع المسابقة أولاً.", "error");
      return;
    }
    setIsGeneratingSamples(true);
    try {
      const ai = getAI();
      
      let prompt = '';
      let schema: any = {};

      if (mode === GameMode.HEX_GRID) {
        prompt = `أنت خبير في إعداد المسابقات. قم بتوليد 28 سؤالاً في موضوع "${topic}". 
يجب أن تبدأ إجابة كل سؤال بحرف مختلف من الحروف الـ 28 التالية بالترتيب: ${LETTERS.flat().join('، ')}.
تأكد من أن الإجابة تبدأ بالحرف المطلوب بالضبط (بدون ال التعريف إذا أمكن، أو اعتبر الحرف الأول بعد ال التعريف).`;
        schema = {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  letter: { type: Type.STRING },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                }
              }
            }
          }
        };
      } else if (mode === GameMode.GRID) {
        const catsToUse = categories.filter(c => c.trim() !== '');
        const catList = catsToUse.length > 0 ? catsToUse.join('، ') : topic;
        prompt = `أنت خبير في إعداد المسابقات. قم بتوليد 25 سؤالاً في الفئات التالية: ${catList}. 
كل فئة يجب أن تحتوي على 5 أسئلة متدرجة الصعوبة.`;
        schema = {
          type: Type.OBJECT,
          properties: {
            categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        };
      } else {
        prompt = `أنت خبير في إعداد المسابقات. قم بتوليد 10 أسئلة متنوعة ومشوقة في موضوع "${topic}".`;
        schema = {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                }
              }
            }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: schema
        }
      });

      let parsed: any = {};
      try {
        let textOutput = extractJson(response.text || "{}");
        // Fix potential JSON issues with extremely large numbers before parsing
        // Handle numbers that might be cut off or extremely long
        textOutput = textOutput.replace(/:\s*([0-9]{15,})[^,}\]]*/g, ': 100');
        parsed = JSON.parse(textOutput);
      } catch (e) {
        console.error("JSON Parse Error:", e, response.text);
        throw new Error("فشل في تحليل البيانات المستلمة من الذكاء الاصطناعي.");
      }
      
      const samples: any = {};

      if (mode === GameMode.HEX_GRID && parsed.questions) {
        parsed.questions.forEach((q: any) => {
          if (q.letter && q.question && q.answer) {
            samples[q.letter] = { question: q.question, answer: q.answer };
          }
        });
        // Fill missing letters with empty
        LETTERS.flat().forEach(l => {
          if (!samples[l]) samples[l] = { question: '', answer: '' };
        });
      } else if (mode === GameMode.GRID && parsed.categories) {
        parsed.categories.forEach((cat: any, i: number) => {
          if (i < 5) {
            samples[`cat-${i}`] = { category: cat.name };
            cat.questions?.forEach((q: any, j: number) => {
              if (j < 5) {
                samples[`j-${i}-${j}`] = { question: q.question, answer: q.answer };
              }
            });
          }
        });
      } else if (parsed.questions) {
        parsed.questions.forEach((q: any, i: number) => {
          if (i < 10) {
            samples[`b-${i}`] = { question: q.question, answer: q.answer };
          }
        });
      }

      setManualQuestions(samples);
    } catch (error) {
      console.error("Failed to generate samples:", error);
      showToast("حدث خطأ أثناء توليد الأسئلة. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMethod === 'manual' && !isManualValid()) {
      showToast('الرجاء إكمال جميع الأسئلة المطلوبة بشكل صحيح', "error");
      return;
    }

    const players: Player[] = playersConfig.map((p) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: p.name,
      score: 0,
      color: p.color,
      powers: {
        FREEZE: 1,
        STEAL: 1,
        SHIELD: 1
      }
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
        const count = numQuestionsState;
        for (let i = 0; i < count; i++) {
          const q = manualQuestions[`b-${i}`];
          finalManualQuestions.push({
            id: `m-b-${i}`,
            text: q?.question || '',
            answer: q?.answer || '',
            category: topic,
            points: 100,
            explanation: q?.explanation,
            type: QuestionType.OPEN,
            difficulty,
            ...(mode === GameMode.PICTURE_GUESS ? {
              pictureElements: q?.imageUrl 
                ? q.imageUrl.split(',').map((item: string) => {
                    const val = item.trim();
                    const isUrl = val.startsWith('http');
                    const isEmoji = /\p{Emoji}/u.test(val) && val.length < 5;
                    if (isUrl) return { type: 'image', value: 'manual', imageUrl: val };
                    if (isEmoji) return { type: 'text', value: val, emoji: val };
                    return { type: 'image', value: val };
                  })
                : [{ type: 'image', value: q?.question || 'question' }]
            } : {})
          });
        }
      }
    }
    
    onStart({ 
      topic, 
      numQuestions: mode === GameMode.HEX_GRID ? 28 : (mode === GameMode.GRID ? 25 : numQuestionsState), 
      mode, 
      questionTypes: [QuestionType.OPEN], 
      difficulty,
      players,
      categories: categories.filter(c => c.trim() !== ''),
      manualQuestions: finalManualQuestions,
      hexMode: inputMethod,
      hexManualQuestions: mode === GameMode.HEX_GRID ? manualQuestions as any : undefined
    });
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl text-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 max-w-5xl mx-auto shadow-2xl border border-white/10 animate-fade-up relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="mb-10 md:mb-14 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">تجهيز المسابقة</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs md:text-sm">اختر طريقة اللعب ومصدر الأسئلة</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-10 md:space-y-14">
          {/* Game Mode Selection */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-black">1</div>
              <label className="text-sm font-black text-white uppercase tracking-widest">نظام اللعبة</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            {[
              { val: GameMode.HEX_GRID, label: 'شبكة الحروف', icon: '🔠', desc: 'مسارات وتوصيل حروف' },
              { val: GameMode.GRID, label: 'الشبكة الكلاسيكية', icon: '🎯', desc: 'فئات ونقاط (جيبوردي)' },
              { val: GameMode.BUZZER, label: 'تحدي البازر', icon: '⚡', desc: 'أسرع إجابة' },
              { val: GameMode.TIMED, label: 'تحدي الوقت', icon: '⏱️', desc: 'أكبر عدد في وقت محدد' },
              { val: GameMode.PICTURE_GUESS, label: 'تحدي الصور', icon: '🖼️', desc: 'خمن الكلمة من الصور' }
            ].map(m => (
              <button
                key={m.val}
                type="button"
                onClick={() => setMode(m.val)}
                className={`relative p-6 md:p-8 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all duration-300 group overflow-hidden ${mode === m.val ? 'border-sky-400 bg-sky-900/40 shadow-[0_0_30px_rgba(56,189,248,0.2)] scale-[1.02]' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}
              >
                {mode === m.val && (
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-400/10 to-transparent opacity-50"></div>
                )}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${mode === m.val ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sky-500/50' : 'bg-slate-800 text-slate-400'}`}>
                  {m.icon}
                </div>
                <div className="text-center relative z-10">
                  <div className={`text-xl font-black mb-1 ${mode === m.val ? 'text-white' : 'text-slate-300'}`}>{m.label}</div>
                  <div className={`text-xs font-bold ${mode === m.val ? 'text-sky-200' : 'text-slate-500'}`}>{m.desc}</div>
                </div>
                {mode === m.val && (
                  <div className="absolute top-4 right-4 w-3 h-3 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.8)]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

          {/* Topic Selection */}
          <div className="space-y-6 animate-fade-in bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-sky-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">2</div>
              <label className="text-sm font-black text-white uppercase tracking-widest">
                {mode === GameMode.GRID ? 'فئات المسابقة (5 فئات)' : 'موضوع المسابقة'}
              </label>
            </div>
            
            {mode === GameMode.GRID ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat, i) => (
                  <div key={i} className="relative">
                    <input 
                      value={cat}
                      onChange={(e) => {
                        const newCats = [...categories];
                        newCats[i] = e.target.value;
                        setCategories(newCats);
                      }}
                      className="w-full bg-slate-900/80 border-2 border-white/10 p-4 rounded-xl focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all text-lg font-black text-white shadow-inner placeholder:text-slate-600"
                      placeholder={`الفئة ${i + 1}`}
                      required={i < 3}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <input 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-slate-900/80 border-2 border-white/10 p-6 md:p-8 rounded-2xl focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all text-2xl md:text-3xl font-black text-white shadow-inner placeholder:text-slate-600"
                    placeholder="مثال: الفضاء، تاريخ الأندلس، كرة القدم..."
                    required
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl opacity-50">🎯</div>
                </div>
                {mode !== GameMode.HEX_GRID && (
                  <div className="relative w-full md:w-48">
                    <div className="absolute -top-3 right-4 bg-slate-900 px-2 text-xs font-bold text-emerald-400 z-10">عدد الأسئلة</div>
                    <input 
                      type="number"
                      min="1"
                      max="100"
                      value={numQuestionsState}
                      onChange={(e) => setNumQuestionsState(parseInt(e.target.value) || 10)}
                      className="w-full h-full bg-slate-900/80 border-2 border-white/10 p-6 md:p-8 rounded-2xl focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all text-2xl md:text-3xl font-black text-white shadow-inner text-center"
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Method Selection */}
          <div className="space-y-6 md:space-y-8 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-black">3</div>
              <label className="text-sm font-black text-white uppercase tracking-widest">مصدر الأسئلة</label>
            </div>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <button 
                type="button"
                onClick={() => setInputMethod('ai')}
                className={`relative p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all duration-300 text-right overflow-hidden group/btn ${inputMethod === 'ai' ? 'border-amber-400 bg-amber-900/30 shadow-[0_0_30px_rgba(251,191,36,0.15)] scale-[1.02]' : 'border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-800/80'}`}
              >
                {inputMethod === 'ai' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-50"></div>
                )}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-4xl shadow-inner group-hover/btn:scale-110 group-hover/btn:-rotate-6 transition-transform duration-300">🤖</div>
                  {inputMethod === 'ai' && <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs px-4 py-1.5 rounded-full font-black shadow-lg">مختار</div>}
                </div>
                <h3 className={`text-xl md:text-2xl font-black mb-3 relative z-10 ${inputMethod === 'ai' ? 'text-white' : 'text-slate-300'}`}>توليد بالذكاء الاصطناعي</h3>
                <p className={`text-xs md:text-sm leading-relaxed relative z-10 ${inputMethod === 'ai' ? 'text-amber-100/80' : 'text-slate-500'}`}>توليد تلقائي فوري للمسابقة بناءً على الموضوع المختار. سريع وذكي.</p>
              </button>
              
              <button 
                type="button"
                onClick={() => setInputMethod('manual')}
                className={`relative p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all duration-300 text-right overflow-hidden group/btn ${inputMethod === 'manual' ? 'border-amber-400 bg-amber-900/30 shadow-[0_0_30px_rgba(251,191,36,0.15)] scale-[1.02]' : 'border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-800/80'}`}
              >
                {inputMethod === 'manual' && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-50"></div>
                )}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-4xl shadow-inner group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-transform duration-300">✍️</div>
                  {inputMethod === 'manual' && <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs px-4 py-1.5 rounded-full font-black shadow-lg">مختار</div>}
                </div>
                <h3 className={`text-xl md:text-2xl font-black mb-3 relative z-10 ${inputMethod === 'manual' ? 'text-white' : 'text-slate-300'}`}>إضافة يدوية</h3>
                <p className={`text-xs md:text-sm leading-relaxed relative z-10 ${inputMethod === 'manual' ? 'text-amber-100/80' : 'text-slate-500'}`}>أدخل أسئلتك الخاصة يدوياً لتتحكم في كل تفاصيل المسابقة.</p>
              </button>
            </div>

          {inputMethod === 'manual' && (
            <div className="space-y-6 animate-fade-in pt-6 border-t border-slate-700">
              <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30 flex flex-col md:flex-row gap-4 justify-between items-center">
                <p className="font-black text-amber-400 text-sm">
                  {mode === GameMode.HEX_GRID 
                    ? '💡 أدخل سؤالاً وإجابة لكل حرف (25 حرفاً). يجب أن تبدأ الإجابة بالحرف المخصص.' 
                    : mode === GameMode.GRID 
                    ? '💡 أدخل 20 سؤالاً مقسمة على 4 فئات، كل فئة 5 مستويات من النقاط.'
                    : '💡 أدخل 10 أسئلة متنوعة للمسابقة.'}
                </p>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    type="button"
                    onClick={generateAISamples}
                    disabled={isGeneratingSamples}
                    className="flex-1 md:flex-none px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-black hover:bg-sky-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGeneratingSamples ? (
                      <><span className="animate-spin">⏳</span> جاري التوليد...</>
                    ) : (
                      <><span className="text-lg">✨</span> تعبئة بأسئلة عشوائية (AI)</>
                    )}
                  </button>
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
                        const count = mode === GameMode.TIMED ? 20 : 10;
                        Array.from({ length: count }).forEach((_, i) => {
                          samples[`b-${i}`] = { question: `سؤال رقم ${i+1}؟`, answer: `إجابة ${i+1}` };
                        });
                      }
                      setManualQuestions(samples);
                    }}
                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-xs font-black hover:bg-slate-600 transition-all"
                  >
                    تعبئة تجريبية
                  </button>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[60vh] md:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {mode === GameMode.HEX_GRID ? (
                  LETTERS.flat().map(letter => {
                    const q = manualQuestions[letter] || { question: '', answer: '' };
                    const isValid = q.answer.trim() === '' || q.answer.trimStart().startsWith(letter);
                    return (
                      <div key={letter} className={`flex flex-col md:flex-row gap-4 items-start p-4 md:p-5 rounded-2xl border-2 bg-slate-900 ${!isValid ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800'}`}>
                        <div className="w-12 h-12 md:w-14 md:h-14 shrink-0 bg-slate-800 text-white rounded-xl flex items-center justify-center text-xl md:text-2xl font-black">
                          {letter}
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                          <input 
                            type="text" placeholder="نص السؤال..." value={q.question}
                            onChange={e => handleManualChange(letter, 'question', e.target.value)}
                            className="w-full p-3 md:p-4 bg-slate-800 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-white font-bold"
                          />
                          <input 
                            type="text" placeholder={`الإجابة (تبدأ بـ ${letter})`} value={q.answer}
                            onChange={e => handleManualChange(letter, 'answer', e.target.value)}
                            className={`w-full p-3 md:p-4 bg-slate-800 border rounded-xl outline-none text-white font-bold ${!isValid ? 'border-red-500 text-red-400' : 'border-slate-700 focus:border-amber-500'}`}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : mode === GameMode.GRID ? (
                  JEOPARDY_STRUCTURE.map((cat, catIdx) => (
                    <div key={catIdx} className="space-y-4 p-4 md:p-6 border-2 border-slate-800 rounded-2xl md:rounded-3xl bg-slate-900/50">
                      <input 
                        className="bg-transparent text-lg md:text-xl font-black text-sky-400 w-full outline-none border-b border-slate-800 pb-2 mb-4"
                        value={manualQuestions[`cat-${catIdx}`]?.category || cat.category}
                        onChange={e => handleManualChange(`cat-${catIdx}`, 'category', e.target.value)}
                        placeholder="اسم الفئة..."
                      />
                      {cat.points.map((p, pIdx) => {
                        const key = `j-${catIdx}-${pIdx}`;
                        const q = manualQuestions[key] || { question: '', answer: '' };
                        return (
                          <div key={p} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                            <div className="w-auto md:w-16 text-right md:text-center font-black text-amber-500">{p} نقطة</div>
                            <div className="flex-1 space-y-2 w-full">
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
                  Array.from({ length: numQuestionsState }).map((_, i) => {
                    const key = `b-${i}`;
                    const q = manualQuestions[key] || { question: '', answer: '', imageUrl: '', explanation: '' };
                    return (
                      <div key={i} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-900 p-4 md:p-5 rounded-2xl border-2 border-slate-800">
                        <div className="w-10 h-10 shrink-0 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-500">{i + 1}</div>
                        <div className="flex-1 space-y-3 w-full">
                          <input 
                            type="text" placeholder="السؤال..." value={q.question}
                            onChange={e => handleManualChange(key, 'question', e.target.value)}
                            className="w-full p-3 md:p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-sky-500 font-bold"
                          />
                          <input 
                            type="text" placeholder="الإجابة..." value={q.answer}
                            onChange={e => handleManualChange(key, 'answer', e.target.value)}
                            className="w-full p-3 md:p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 font-bold"
                          />
                          {mode === GameMode.PICTURE_GUESS && (
                            <>
                              <input 
                                type="text" placeholder="عناصر الصورة (إيموجي أو كلمات مفتاحية مفصولة بفاصلة)..." value={q.imageUrl || ''}
                                onChange={e => handleManualChange(key, 'imageUrl', e.target.value)}
                                className="w-full p-3 md:p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-purple-500 font-bold"
                                title="مثال: 👑, 🏪, 🍎"
                              />
                              <input 
                                type="text" placeholder="شرح طريقة الحل (اختياري)..." value={q.explanation || ''}
                                onChange={e => handleManualChange(key, 'explanation', e.target.value)}
                                className="w-full p-3 md:p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-amber-500 font-bold"
                              />
                            </>
                          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            <div className="space-y-6 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-pink-400 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-black">4</div>
                <label className="text-sm font-black text-white uppercase tracking-widest">المتنافسون</label>
              </div>
              <div className="space-y-4">
                {playersConfig.map((p, i) => (
                  <div key={i} className="group/player flex gap-3 items-center bg-slate-900/50 p-2 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-700 shrink-0 shadow-sm group-hover/player:scale-105 transition-transform">
                      <input 
                        type="color"
                        value={p.color}
                        onChange={e => {
                          const newPlayers = [...playersConfig];
                          newPlayers[i].color = e.target.value;
                          setPlayersConfig(newPlayers);
                        }}
                        className="absolute -top-4 -left-4 w-24 h-24 cursor-pointer"
                      />
                    </div>
                    <input 
                      value={p.name}
                      onChange={e => {
                        const newPlayers = [...playersConfig];
                        newPlayers[i].name = e.target.value;
                        setPlayersConfig(newPlayers);
                      }}
                      className="flex-1 bg-transparent border-none p-2 text-lg font-black outline-none text-white placeholder:text-slate-600"
                      placeholder={`متسابق ${i+1}`}
                    />
                    {playersConfig.length > 2 && (
                      <button type="button" onClick={() => setPlayersConfig(playersConfig.filter((_, idx) => idx !== i))} className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold shrink-0 mr-2">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setPlayersConfig([...playersConfig, { name: `متسابق ${playersConfig.length + 1}`, color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') }])} className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-slate-400 text-sm font-black hover:bg-white/5 hover:border-white/20 hover:text-white transition-all flex items-center justify-center gap-2">
                  <span className="text-xl">+</span> إضافة منافس
                </button>
              </div>
            </div>

            <div className="space-y-6 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-400 to-red-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-black">5</div>
                <label className="text-sm font-black text-white uppercase tracking-widest">مستوى الصعوبة</label>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { val: Difficulty.EASY, label: 'سهل', color: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/20' },
                  { val: Difficulty.MEDIUM, label: 'متوسط', color: 'from-amber-400 to-amber-600', shadow: 'shadow-amber-500/20' },
                  { val: Difficulty.HARD, label: 'صعب', color: 'from-rose-400 to-rose-600', shadow: 'shadow-rose-500/20' }
                ].map(d => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setDifficulty(d.val)}
                    className={`relative py-5 rounded-2xl border-2 transition-all duration-300 font-black text-lg overflow-hidden ${difficulty === d.val ? `border-transparent shadow-lg ${d.shadow} scale-[1.02]` : 'border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20 hover:bg-slate-800/80'}`}
                  >
                    {difficulty === d.val && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${d.color} opacity-90`}></div>
                    )}
                    <span className={`relative z-10 ${difficulty === d.val ? 'text-white' : ''}`}>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-6 md:py-8 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 rounded-[2rem] text-2xl md:text-3xl font-black shadow-[0_10px_40px_rgba(56,189,248,0.4)] mt-12 tracking-widest text-white uppercase hover:scale-[1.02] hover:shadow-[0_15px_50px_rgba(56,189,248,0.6)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative z-10 flex items-center justify-center gap-4">
              انطلاق المسابقة <span className="text-4xl">🚀</span>
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConfigScreen;