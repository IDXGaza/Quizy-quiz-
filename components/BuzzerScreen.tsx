import React, { useState, useEffect } from 'react';
import { GameConfig, Player, Question } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../services/socket';

interface BuzzerScreenProps {
  config: GameConfig;
  questions: Question[];
  players: Player[];
  onFinish: (players: Player[]) => void;
}

const BuzzerScreen: React.FC<BuzzerScreenProps> = ({ config, questions, players: initialPlayers, onFinish }) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'question' | 'buzzed' | 'revealed'>('waiting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [roomId] = useState(config.sessionId || Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    const joinRoom = () => {
      socket.emit('createRoom', roomId);
    };

    joinRoom(); // initial join
    socket.on('connect', joinRoom);

    const handlePlayerJoined = (roomPlayers: any[]) => {
      const connected = roomPlayers.map(rp => {
        const p = initialPlayers.find(ip => ip.id === rp.id);
        return p || rp;
      });
      setConnectedPlayers(connected);
    };

    socket.on('playerJoined', handlePlayerJoined);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('playerJoined', handlePlayerJoined);
    };
  }, [roomId, initialPlayers]);

  useEffect(() => {
    const handlePlayerBuzzed = (playerId: string) => {
      setGameState(prev => {
        if (prev === 'question') {
          setBuzzedPlayerId(playerId);
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(() => {});
          return 'buzzed';
        }
        return prev;
      });
    };

    socket.on('playerBuzzed', handlePlayerBuzzed);

    return () => {
      socket.off('playerBuzzed', handlePlayerBuzzed);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'question' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (gameState === 'question' && timeLeft === 0) {
      setGameState('revealed');
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft]);

  const startGame = () => {
    setPlayers(connectedPlayers.map(p => ({ ...p, score: 0 })));
    setGameState('playing');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setGameState('question');
      setBuzzedPlayerId(null);
      setTimeLeft(15);
      socket.emit('resetBuzzer', roomId);
    } else {
      onFinish(players);
    }
  };

  const showQuestion = () => {
    setGameState('question');
    setBuzzedPlayerId(null);
    setTimeLeft(15);
    socket.emit('resetBuzzer', roomId);
  };

  const activeQuestion = questions[currentQuestionIndex];
  const baseUrl = process.env.SHARED_APP_URL || window.location.origin;
  const joinUrl = `${baseUrl}?mode=remote&roomId=${roomId}`;

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect && buzzedPlayerId) {
      setPlayers(players.map(p => 
        p.id === buzzedPlayerId ? { ...p, score: p.score + (activeQuestion.points || 100) } : p
      ));
      setGameState('revealed');
    } else {
      // If wrong, reset buzzer and let others buzz
      setBuzzedPlayerId(null);
      setGameState('question');
      socket.emit('resetBuzzer', roomId);
    }
  };

  const skipQuestion = () => {
    setGameState('revealed');
  };

  if (gameState === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8">
        <h2 className="text-4xl font-black text-slate-800">شاشة الانضمام للبازر</h2>
        <p className="text-xl text-slate-500">امسح الكود باستخدام هاتفك للانضمام كمتسابق</p>
        
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-8 border-sky-50 flex flex-col items-center gap-4">
          <QRCodeSVG value={joinUrl} size={250} level="H" includeMargin={true} />
          <div className="px-4 py-2 bg-slate-100 rounded-lg text-center font-mono text-xs text-slate-500 select-all max-w-[250px] break-all">
            {joinUrl}
          </div>
        </div>
        
        <div className="flex gap-4 flex-wrap justify-center max-w-2xl">
          {Array.from({ length: Math.max(initialPlayers.length, connectedPlayers.length) }).map((_, i) => {
            const p = connectedPlayers[i];
            if (p) {
              return (
                <div key={p.id} className="px-6 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all bg-green-100 text-green-700 border-2 border-green-400">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  {p.name}
                </div>
              );
            }
            return (
              <div key={`empty-${i}`} className="px-6 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all bg-slate-100 text-slate-400 border-2 border-dashed border-slate-300">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                في انتظار متسابق...
              </div>
            );
          })}
        </div>

        <button 
          onClick={startGame}
          disabled={connectedPlayers.length === 0}
          className="px-12 py-5 sky-btn rounded-2xl text-2xl font-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-8"
        >
          {connectedPlayers.length > 0 ? 'بدء المسابقة' : 'في انتظار المتسابقين...'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 py-10 min-h-screen">
      {/* Scoreboard */}
      <div className="flex justify-center gap-6 w-full max-w-5xl px-6">
        {players.map(p => (
          <div key={p.id} className="flex-1 bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-lg flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md" style={{backgroundColor: p.color}}>
              {p.score}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">النقاط</span>
              <p className="text-lg font-black text-slate-800 truncate">{p.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Game Area */}
      <div className="w-full max-w-4xl bg-white rounded-[3rem] p-10 shadow-2xl border-8 border-slate-50 text-center relative overflow-hidden">
        {gameState === 'playing' ? (
          <div className="py-20">
            <h2 className="text-5xl font-black text-slate-800 mb-8">السؤال {currentQuestionIndex + 1}</h2>
            <button onClick={showQuestion} className="px-12 py-6 sky-btn rounded-2xl text-3xl font-black shadow-xl hover:scale-105 transition-transform">
              عرض السؤال
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {gameState === 'question' && (
              <div className="absolute top-0 left-0 h-2 bg-sky-500 transition-all duration-1000" style={{ width: `${(timeLeft / 15) * 100}%` }}></div>
            )}
            
            <div className="flex justify-center gap-3 mb-6">
              <span className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-500 font-bold text-sm">{activeQuestion.category}</span>
              <span className="px-4 py-2 bg-sky-50 text-sky-600 rounded-2xl font-bold text-sm">{activeQuestion.points || 100} نقطة</span>
            </div>

            <h3 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-8">
              {activeQuestion.text}
            </h3>

            {gameState === 'question' && (
              <div className="py-12 flex flex-col items-center gap-6">
                <div className="w-24 h-24 rounded-full border-8 border-slate-100 border-t-sky-500 animate-spin flex items-center justify-center">
                  <span className="text-3xl font-black text-slate-400 animate-none">{timeLeft}</span>
                </div>
                <p className="text-2xl font-bold text-slate-500 animate-pulse">في انتظار ضغط البازر...</p>
                <button onClick={skipQuestion} className="mt-4 px-8 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-slate-200">
                  تخطي السؤال
                </button>
              </div>
            )}

            {gameState === 'buzzed' && buzzedPlayerId && (
              <div className="py-8 animate-fade-in">
                <div className="inline-block p-8 rounded-[3rem] shadow-2xl mb-8 animate-bounce" style={{backgroundColor: players.find(p => p.id === buzzedPlayerId)?.color || '#38bdf8'}}>
                  <p className="text-white text-sm font-black uppercase tracking-widest mb-2 opacity-80">المتسابق الأسرع</p>
                  <h4 className="text-5xl font-black text-white">{players.find(p => p.id === buzzedPlayerId)?.name}</h4>
                </div>
                
                <div className="flex gap-4 justify-center">
                  <button onClick={() => handleAnswer(true)} className="px-10 py-5 bg-green-500 text-white rounded-2xl text-2xl font-black shadow-lg hover:bg-green-600 hover:scale-105 transition-all">
                    إجابة صحيحة ✓
                  </button>
                  <button onClick={() => handleAnswer(false)} className="px-10 py-5 bg-red-500 text-white rounded-2xl text-2xl font-black shadow-lg hover:bg-red-600 hover:scale-105 transition-all">
                    إجابة خاطئة ✗
                  </button>
                </div>
              </div>
            )}

            {gameState === 'revealed' && (
              <div className="py-8 animate-fade-up space-y-8">
                <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner">
                  <p className="text-sm font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                  <p className="text-4xl font-black text-black">{activeQuestion.answer}</p>
                </div>
                
                <button onClick={nextQuestion} className="w-full py-6 sky-btn rounded-2xl text-2xl font-black shadow-xl hover:scale-102 transition-transform">
                  {currentQuestionIndex < questions.length - 1 ? 'السؤال التالي' : 'إنهاء المسابقة'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuzzerScreen;
