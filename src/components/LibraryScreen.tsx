import React, { useState, useEffect } from 'react';
import { GameMode, Difficulty, QuestionType, SavedSet, Question, Player } from '../types';
import { generateQuestions } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';

interface Props {
  onPlaySet: (set: SavedSet, players: Player[]) => void;
  onClose: () => void;
}

const LibraryScreen: React.FC<Props> = ({ onPlaySet, onClose }) => {
  const { settings } = useSettings();
  const [savedSets, setSavedSets] = useState<SavedSet[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [mode, setMode] = useState<GameMode>(GameMode.POINTS);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);

  // Play State
  const [selectedSetToPlay, setSelectedSetToPlay] = useState<SavedSet | null>(null);
  const [playersConfig, setPlayersConfig] = useState<{name: string, color: string}[]>([
    { name: 'الفريق الأحمر', color: '#ef4444' },
    { name: 'الفريق الأخضر', color: '#22c55e' }
  ]);

  useEffect(() => {
    const sets = localStorage.getItem('savedSets');
    if (sets) {
      try {
        setSavedSets(JSON.parse(sets));
      } catch (e) {
        console.error('Failed to parse saved sets', e);
      }
    }
  }, []);

  const saveSetsToLocal = (sets: SavedSet[]) => {
    localStorage.setItem('savedSets', JSON.stringify(sets));
    setSavedSets(sets);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المجموعة؟')) {
      const newSets = savedSets.filter(s => s.id !== id);
      saveSetsToLocal(newSets);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !topic.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const requiredCount = mode === GameMode.HEX_GRID ? 25 : (mode === GameMode.GRID ? 20 : numQuestions);
      
      const generated = await generateQuestions(
        topic,
        requiredCount,
        [QuestionType.OPEN],
        mode,
        difficulty,
        settings.aiModel
      );

      if (!generated || generated.length === 0) {
        throw new Error("لم يتم العثور على أسئلة، حاول تغيير الموضوع.");
      }

      const newSet: SavedSet = {
        id: `set-${Date.now()}`,
        name,
        topic,
        numQuestions: requiredCount,
        mode,
        difficulty,
        questions: generated,
        createdAt: Date.now()
      };

      saveSetsToLocal([newSet, ...savedSets]);
      setIsCreating(false);
      // Reset form
      setName('');
      setTopic('');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء توليد الأسئلة');
    } finally {
      setIsLoading(false);
    }
  };

  const getModeLabel = (m: GameMode) => {
    switch (m) {
      case GameMode.HEX_GRID: return 'شبكة الحروف';
      case GameMode.GRID: return 'الشبكة الكلاسيكية';
      case GameMode.BUZZER: return 'تحدي البازر';
      case GameMode.TIMED: return 'تحدي الوقت';
      case GameMode.PICTURE_GUESS: return 'تحدي الصور';
      default: return 'نقاط';
    }
  };

  const getDifficultyLabel = (d: Difficulty) => {
    switch (d) {
      case Difficulty.EASY: return 'سهل';
      case Difficulty.MEDIUM: return 'متوسط';
      case Difficulty.HARD: return 'صعب';
      default: return '';
    }
  };

  const handleStartPlay = () => {
    if (!selectedSetToPlay) return;
    const finalPlayers: Player[] = playersConfig.map((p, i) => ({
      id: `p${i+1}`,
      name: p.name || `متسابق ${i+1}`,
      score: 0,
      color: p.color,
      powers: {
        FREEZE: 1,
        STEAL: 1,
        SHIELD: 1
      }
    }));
    onPlaySet(selectedSetToPlay, finalPlayers);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl text-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 max-w-5xl mx-auto shadow-2xl border border-white/10 animate-fade-up relative overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
          {selectedSetToPlay ? 'تجهيز المتسابقين' : 'مكتبة الأسئلة'}
        </h2>
        <button onClick={() => selectedSetToPlay ? setSelectedSetToPlay(null) : onClose()} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
          {selectedSetToPlay ? '🔙' : '✕'}
        </button>
      </div>

      {selectedSetToPlay ? (
        <div className="space-y-8">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
            <h3 className="text-xl font-black text-white mb-2">المجموعة: {selectedSetToPlay.name}</h3>
            <div className="flex gap-2 text-sm text-slate-400">
              <span>{getModeLabel(selectedSetToPlay.mode)}</span> • 
              <span>{selectedSetToPlay.numQuestions} سؤال</span> • 
              <span>{getDifficultyLabel(selectedSetToPlay.difficulty)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-300">المتنافسون</h3>
            {playersConfig.map((p, i) => (
              <div key={i} className="group flex gap-3 items-center bg-slate-900/50 p-2 rounded-2xl border border-white/5">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-700 shrink-0">
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

          <button 
            onClick={handleStartPlay}
            className="w-full py-6 bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl text-2xl font-black text-white shadow-lg shadow-sky-500/30 hover:scale-[1.02] transition-transform"
          >
            بدء اللعب 🚀
          </button>
        </div>
      ) : !isCreating ? (
        <div className="space-y-6">
          <button 
            onClick={() => setIsCreating(true)}
            className="w-full py-6 border-2 border-dashed border-sky-500/50 rounded-2xl text-sky-400 font-black text-xl hover:bg-sky-500/10 transition-all flex items-center justify-center gap-3"
          >
            <span className="text-3xl">+</span> إنشاء مجموعة جديدة
          </button>

          {savedSets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-xl font-bold">لا توجد مجموعات محفوظة بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedSets.map(set => (
                <div key={set.id} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col gap-4 hover:border-sky-500/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-black text-white mb-1">{set.name}</h3>
                      <p className="text-sm text-slate-400">{set.topic}</p>
                    </div>
                    <button onClick={() => handleDelete(set.id)} className="text-red-400 hover:text-red-300 p-2 bg-red-500/10 rounded-lg transition-colors">
                      🗑️
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="px-3 py-1 bg-slate-700 rounded-full text-slate-300">{getModeLabel(set.mode)}</span>
                    <span className="px-3 py-1 bg-slate-700 rounded-full text-slate-300">{set.numQuestions} سؤال</span>
                    <span className="px-3 py-1 bg-slate-700 rounded-full text-slate-300">{getDifficultyLabel(set.difficulty)}</span>
                  </div>

                  <button 
                    onClick={() => setSelectedSetToPlay(set)}
                    className="w-full py-3 mt-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black transition-colors"
                  >
                    لعب هذه المجموعة ▶️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-6 bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-black text-white">إنشاء مجموعة جديدة</h3>
            <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white">إلغاء</button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">اسم المجموعة</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-sky-500"
                placeholder="مثال: مسابقة العائلة الكبرى" required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">الموضوع</label>
              <input 
                value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-sky-500"
                placeholder="مثال: التاريخ الإسلامي" required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">نظام اللعبة</label>
                <select 
                  value={mode} onChange={e => setMode(e.target.value as GameMode)}
                  className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-sky-500"
                >
                  <option value={GameMode.POINTS}>نقاط</option>
                  <option value={GameMode.HEX_GRID}>شبكة الحروف</option>
                  <option value={GameMode.GRID}>الشبكة الكلاسيكية</option>
                  <option value={GameMode.BUZZER}>تحدي البازر</option>
                  <option value={GameMode.TIMED}>تحدي الوقت</option>
                  <option value={GameMode.PICTURE_GUESS}>تحدي الصور</option>
                </select>
              </div>

              {mode !== GameMode.HEX_GRID && mode !== GameMode.GRID && (
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">عدد الأسئلة</label>
                  <input 
                    type="number" min="5" max="50"
                    value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value) || 10)}
                    className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">مستوى الصعوبة</label>
                <select 
                  value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                  className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-sky-500"
                >
                  <option value={Difficulty.EASY}>سهل</option>
                  <option value={Difficulty.MEDIUM}>متوسط</option>
                  <option value={Difficulty.HARD}>صعب</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-4 rounded-xl text-xl font-black text-white transition-all ${isLoading ? 'bg-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-500/20'}`}
          >
            {isLoading ? 'جاري توليد الأسئلة...' : 'إنشاء وحفظ المجموعة'}
          </button>
        </form>
      )}
    </div>
  );
};

export default LibraryScreen;
