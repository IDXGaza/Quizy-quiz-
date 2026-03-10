import React, { useState, useEffect, useCallback } from 'react';
import { GameConfig, Player, Question } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface Props {
  config: GameConfig;
  questions: Question[];
  players: Player[];
  onFinish: (players: Player[]) => void;
}

const TimedChallengeScreen: React.FC<Props> = ({ config, questions, players: initialPlayers, onFinish }) => {
  const { settings } = useSettings();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(settings.timedDuration);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'turn_finished' | 'finished'>('ready');
  const [revealed, setRevealed] = useState(false);
  const [roundScore, setRoundScore] = useState(0);

  const activeQuestion = questions[currentQuestionIndex];
  const currentPlayer = players[currentPlayerIndex];

  useEffect(() => {
    let timer: number;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (gameState === 'playing' && timeLeft <= 0) {
      setGameState('turn_finished');
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleStartTurn = () => {
    setTimeLeft(settings.timedDuration);
    setRoundScore(0);
    setGameState('playing');
  };

  const handleNextTurn = () => {
    if (currentPlayerIndex < players.length - 1 && currentQuestionIndex < questions.length) {
      setCurrentPlayerIndex(prev => prev + 1);
      setGameState('ready');
    } else {
      setGameState('finished');
    }
  };

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (isCorrect) {
      const points = activeQuestion?.points || 100;
      setRoundScore(prev => prev + points);
      setPlayers(prev => prev.map((p, idx) => {
        if (idx === currentPlayerIndex) {
          return { ...p, score: p.score + points };
        }
        return p;
      }));
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setRevealed(false);
    } else {
      setGameState('finished');
    }
  }, [activeQuestion, currentQuestionIndex, questions.length, currentPlayerIndex]);

  const renderWinnerModal = () => {
    if (gameState !== 'finished') return null;

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl text-center border-[16px] border-slate-50 overflow-y-auto max-h-[90vh]">
          <div className="text-8xl mb-8">🏆</div>
          <h2 className="text-5xl font-black text-slate-900 mb-4">انتهت اللعبة!</h2>
          <div className="inline-block px-8 py-3 rounded-2xl text-white text-2xl font-black mb-8" style={{backgroundColor: winner.color}}>
            الفائز: {winner.name}
          </div>
          <p className="text-slate-500 font-bold mb-12">
            بمجموع نقاط ({winner.score} نقطة)!
          </p>
          <button 
            onClick={() => onFinish(players)}
            className="w-full py-6 sky-btn rounded-2xl text-2xl font-black shadow-xl"
          >
            عرض النتائج النهائية
          </button>
        </div>
      </div>
    );
  };

  if (gameState === 'ready') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50/50">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-2xl w-full border-4 border-slate-100">
          <div className="text-8xl mb-8 animate-bounce">⏱️</div>
          <h2 className="text-5xl font-black text-slate-800 mb-6">دور {currentPlayer.name}</h2>
          <p className="text-xl text-slate-500 font-bold mb-12 leading-relaxed">
            أمامك {settings.timedDuration} ثانية للإجابة على أكبر عدد ممكن من الأسئلة. 
            السرعة والتركيز هما مفتاح الفوز!
          </p>
          <button 
            onClick={handleStartTurn}
            className="w-full py-6 text-white rounded-2xl text-3xl font-black shadow-xl hover:scale-105 transition-transform"
            style={{ backgroundColor: currentPlayer.color }}
          >
            ابدأ التحدي الآن!
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'turn_finished') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50/50">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-2xl w-full border-4 border-slate-100">
          <div className="text-8xl mb-8">⏰</div>
          <h2 className="text-5xl font-black text-slate-800 mb-6">انتهى وقتك يا {currentPlayer.name}!</h2>
          <p className="text-2xl text-slate-600 font-bold mb-12 leading-relaxed">
            لقد حصدت <span className="text-sky-500 text-4xl">{roundScore}</span> نقطة في هذه الجولة.
          </p>
          <button 
            onClick={handleNextTurn}
            className="w-full py-6 bg-slate-800 text-white rounded-2xl text-3xl font-black shadow-xl hover:scale-105 transition-transform"
          >
            {currentPlayerIndex < players.length - 1 ? 'التالي' : 'إنهاء اللعبة'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 md:gap-10 py-4 md:py-8 min-h-screen bg-slate-50/50">
      {/* Header: Timer and Scores (Sticky) */}
      <div className="sticky top-20 z-40 flex flex-wrap justify-center items-center gap-3 md:gap-6 w-full max-w-7xl px-4 backdrop-blur-md bg-white/30 py-4 rounded-3xl shadow-sm">
        {/* Timer */}
        <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-2 border-red-100 shadow-lg flex items-center gap-4 shrink-0">
          <div className={`text-4xl md:text-5xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className="text-red-400 text-xs md:text-sm font-black uppercase tracking-widest">الوقت المتبقي</div>
        </div>

        {/* Scores */}
        {players.map((p, idx) => {
          const isCurrent = idx === currentPlayerIndex;
          return (
            <div 
              key={p.id} 
              className={`flex-1 min-w-[140px] md:min-w-[180px] bg-white p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 shadow-lg flex items-center gap-3 md:gap-5 transform transition-all ${isCurrent ? 'scale-105 border-sky-400 ring-4 ring-sky-100' : 'border-slate-200 opacity-90 hover:opacity-100'}`}
            >
              <div 
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-3xl font-black shadow-md shrink-0" 
                style={{backgroundColor: p.color, boxShadow: `0 8px 16px ${p.color}44`}}
              >
                {p.score}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5">
                  النقاط
                  {isCurrent && <span className="mr-2 text-sky-500">● دورك</span>}
                </span>
                <p className="text-lg md:text-xl font-black text-slate-800 truncate w-full">{p.name}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Question Area */}
      {activeQuestion && (
        <div className="w-full max-w-4xl px-4 animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl border-4 border-slate-100 p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
              <div 
                className="h-full bg-sky-400 transition-all duration-1000"
                style={{ width: `${(timeLeft / settings.timedDuration) * 100}%` }}
              />
            </div>

            <div className="space-y-8 mt-4">
              <div className="flex justify-center gap-3">
                <p className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-400 font-black tracking-widest uppercase text-xs">
                  السؤال {currentQuestionIndex + 1} من {questions.length}
                </p>
                <p className="px-4 py-2 bg-sky-50 text-sky-600 rounded-2xl font-black tracking-widest uppercase text-xs">
                  {activeQuestion.category}
                </p>
              </div>
              
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">
                {activeQuestion.text}
              </h3>

              {!revealed ? (
                <div className="pt-8 flex flex-col gap-4">
                  <button 
                    onClick={() => setRevealed(true)}
                    className="w-full md:w-auto px-12 py-6 bg-slate-800 text-white rounded-2xl text-2xl font-black shadow-xl hover:bg-slate-700 transition-colors"
                  >
                    إظهار الإجابة
                  </button>
                  <button 
                    onClick={() => handleAnswer(false)}
                    className="w-full md:w-auto px-12 py-4 bg-slate-100 text-slate-500 rounded-2xl text-xl font-black hover:bg-slate-200 transition-colors"
                  >
                    تخطي السؤال
                  </button>
                </div>
              ) : (
                <div className="space-y-8 animate-fade-up pt-8 border-t-2 border-slate-100">
                  <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner">
                    <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                    <p className="text-4xl md:text-5xl font-black text-black">{activeQuestion.answer}</p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <button 
                      onClick={() => handleAnswer(true)}
                      className="flex-1 py-6 rounded-2xl text-white text-xl font-black shadow-lg hover:scale-105 transition-transform"
                      style={{ backgroundColor: currentPlayer.color }}
                    >
                      إجابة صحيحة
                    </button>
                    <button 
                      onClick={() => handleAnswer(false)}
                      className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-2xl text-xl font-black hover:bg-slate-200 transition-colors"
                    >
                      إجابة خاطئة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {renderWinnerModal()}
    </div>
  );
};

export default TimedChallengeScreen;
