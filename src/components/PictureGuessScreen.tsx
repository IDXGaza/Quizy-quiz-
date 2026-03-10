import React, { useState } from 'react';
import { GameConfig, Player, Question } from '../types';

const ChallengeImage = ({ keyword, emoji, imageUrl }: { keyword?: string, emoji?: string, imageUrl?: string }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  if (error) {
    return <span className="text-6xl md:text-8xl drop-shadow-lg">{emoji || '❓'}</span>;
  }
  
  const src = imageUrl || (keyword ? `https://loremflickr.com/512/512/${encodeURIComponent(keyword)}` : '');

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-800">
      {!loaded && !error && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] text-slate-500 font-bold">جاري التحميل...</span>
        </div>
      )}
      {src && !error ? (
        <img 
          src={src} 
          alt={keyword || 'image'}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl md:text-8xl drop-shadow-lg">{emoji || '❓'}</span>
          {keyword && <span className="text-xs text-slate-500 font-bold">{keyword}</span>}
        </div>
      )}
    </div>
  );
};

interface Props {
  config: GameConfig;
  questions: Question[];
  players: Player[];
  onFinish: (players: Player[]) => void;
}

const PictureGuessScreen: React.FC<Props> = ({ config, questions, players: initialPlayers, onFinish }) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  // Preload images for the next few questions
  useEffect(() => {
    const preloadImages = () => {
      const nextIndex = currentQuestionIndex + 1;
      const endIndex = Math.min(nextIndex + 3, questions.length);
      
      for (let i = nextIndex; i < endIndex; i++) {
        const q = questions[i];
        if (q.pictureElements) {
          q.pictureElements.forEach(el => {
            if (el.type === 'image') {
              const src = el.imageUrl || (el.value ? `https://loremflickr.com/512/512/${encodeURIComponent(el.value)}` : '');
              if (src) {
                const img = new Image();
                img.src = src;
              }
            }
          });
        }
      }
    };
    preloadImages();
  }, [currentQuestionIndex, questions]);

  const activeQuestion = questions[currentQuestionIndex];

  const handleCorrect = (playerId: string) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, score: p.score + (activeQuestion.points || 100) } : p));
    handleNext();
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setRevealed(false);
      setShowScoring(false);
      setShowHint(false);
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length);
    } else {
      onFinish(players);
    }
  };

  if (!activeQuestion) return null;

  return (
    <div className="flex flex-col items-center gap-6 md:gap-10 py-4 md:py-8 min-h-screen bg-slate-950 text-white">
      {/* Scoreboard (Sticky) */}
      <div className="sticky top-20 z-40 flex flex-wrap justify-center gap-3 md:gap-6 w-full max-w-7xl px-4 backdrop-blur-md bg-slate-900/50 py-4 rounded-3xl shadow-sm border border-white/5">
        {players.map((p, idx) => {
          const isCurrent = idx === currentPlayerIndex;
          return (
            <div 
              key={p.id} 
              className={`flex-1 min-w-[140px] md:min-w-[180px] bg-slate-900 p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 flex items-center gap-3 md:gap-5 transform transition-all ${isCurrent ? 'scale-105 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]' : 'border-slate-800 opacity-80 hover:opacity-100'}`}
            >
              <div 
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-3xl font-black shadow-lg shrink-0" 
                style={{backgroundColor: p.color}}
              >
                {p.score}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5">
                  النقاط
                  {isCurrent && <span className="mr-2 text-sky-500">● دورك</span>}
                </span>
                <p className="text-lg md:text-xl font-black text-white truncate w-full">{p.name}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Challenge Area */}
      <div className="w-full max-w-5xl px-4 flex flex-col items-center">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl w-full text-center relative overflow-hidden">
          
          <div className="mb-8">
            <span className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-full font-black text-sm tracking-widest uppercase">
              السؤال {currentQuestionIndex + 1} من {questions.length}
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-12">
            {activeQuestion.text}
          </h2>

          {/* Images Grid */}
          <div className="flex justify-center items-center flex-wrap gap-4 md:gap-6 mb-12" dir="rtl">
            {activeQuestion.pictureElements ? activeQuestion.pictureElements.map((el, idx) => (
              <React.Fragment key={idx}>
                {el.type === 'image' ? (
                  <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-2xl bg-slate-800 flex items-center justify-center transform hover:scale-105 transition-transform">
                    <ChallengeImage keyword={el.value} emoji={el.emoji} imageUrl={el.imageUrl} />
                  </div>
                ) : (
                  <div className="text-5xl md:text-7xl font-black text-white px-2 drop-shadow-lg">
                    {el.value}
                  </div>
                )}
              </React.Fragment>
            )) : (
              /* Fallback for old questions */
              activeQuestion.imageKeywords?.map((keyword, idx) => (
                <div key={idx} className="w-32 h-32 md:w-56 md:h-56 rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-2xl bg-slate-800 flex items-center justify-center transform hover:scale-105 transition-transform">
                  <ChallengeImage keyword={keyword} emoji={activeQuestion.emojis?.[idx]} />
                </div>
              ))
            )}
          </div>

          {/* Answer Area */}
          <div className="min-h-[120px] flex flex-col items-center justify-center gap-4">
            {!revealed ? (
              <>
                <button 
                  onClick={() => setRevealed(true)}
                  className="px-12 py-6 bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl text-2xl font-black text-white shadow-lg shadow-sky-500/30 hover:scale-105 transition-transform"
                >
                  إظهار الإجابة 👁️
                </button>
                {(!showHint && (activeQuestion.hint || activeQuestion.category)) && (
                  <button 
                    onClick={() => setShowHint(true)}
                    className="px-6 py-3 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-xl font-bold hover:bg-amber-500/30 transition-colors"
                  >
                    💡 إظهار تلميح
                  </button>
                )}
                {showHint && (
                  <div className="px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 font-bold animate-fade-in">
                    تلميح: {activeQuestion.hint || activeQuestion.category}
                  </div>
                )}
              </>
            ) : !showScoring ? (
              <div className="animate-fade-up flex flex-col items-center w-full">
                <div className="text-4xl md:text-6xl font-black text-emerald-400 mb-8 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                  {activeQuestion.answer}
                </div>
                {activeQuestion.explanation && (
                  <div className="text-xl md:text-2xl text-slate-300 font-bold mb-8 max-w-2xl text-center leading-relaxed bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <span className="text-sky-400 block mb-2 text-sm uppercase tracking-wider">كيف تكونت الكلمة؟</span>
                    {activeQuestion.explanation}
                  </div>
                )}
                <button 
                  onClick={() => setShowScoring(true)}
                  className="px-12 py-6 bg-emerald-500 text-white rounded-2xl text-2xl font-black shadow-xl hover:bg-emerald-600 hover:scale-105 transition-all"
                >
                  رصد الدرجات 📝
                </button>
              </div>
            ) : (
              <div className="animate-fade-up flex flex-col items-center w-full">
                <div className="text-4xl md:text-6xl font-black text-emerald-400 mb-8 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                  {activeQuestion.answer}
                </div>
                {activeQuestion.explanation && (
                  <div className="text-xl md:text-2xl text-slate-300 font-bold mb-8 max-w-2xl text-center leading-relaxed bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <span className="text-sky-400 block mb-2 text-sm uppercase tracking-wider">كيف تكونت الكلمة؟</span>
                    {activeQuestion.explanation}
                  </div>
                )}
                
                <div className="w-full h-px bg-white/10 my-6"></div>
                
                <h4 className="text-slate-400 font-bold mb-4">من أجاب إجابة صحيحة؟</h4>
                <div className="flex flex-wrap justify-center gap-3 w-full">
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleCorrect(p.id)}
                      className="flex-1 min-w-[120px] py-4 rounded-xl font-black text-white transition-transform hover:scale-105"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    onClick={handleNext}
                    className="flex-1 min-w-[120px] py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-slate-300 transition-colors"
                  >
                    لا أحد (تخطي)
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="mt-auto pb-8">
        <button 
          onClick={() => onFinish(players)}
          className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-colors"
        >
          إنهاء اللعبة وعرض النتائج
        </button>
      </div>
    </div>
  );
};

export default PictureGuessScreen;
