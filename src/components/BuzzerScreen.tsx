import React, { useState, useEffect } from 'react';
import { GameConfig, Player, Question } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { db, auth } from '../firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestoreUtils';

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
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [roomId] = useState(config.sessionId || Math.random().toString(36).substr(2, 9));
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<Partial<Question>>({});
  const [activeQuestion, setActiveQuestion] = useState<Question>(questions[0]);

  useEffect(() => {
    setActiveQuestion(questions[currentQuestionIndex]);
    setEditedQuestion(questions[currentQuestionIndex]);
    setIsEditing(false);
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const roomRef = doc(db, 'rooms', roomId);
    
    // Create room
    const roomPath = `rooms/${roomId}`;
    setDoc(roomRef, {
      hostId: auth.currentUser.uid,
      gameState: 'waiting',
      buzzedPlayerId: null,
      buzzedAt: null,
      createdAt: new Date().toISOString()
    }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));

    // Listen to room state
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.buzzedPlayerId && data.gameState === 'question') {
          setBuzzedPlayerId(data.buzzedPlayerId);
          setGameState('buzzed');
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(() => {});
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, roomPath);
    });

    // Listen to players
    const playersPath = `rooms/${roomId}/players`;
    const playersRef = collection(db, 'rooms', roomId, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const currentPlayers: Player[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        currentPlayers.push({
          id: doc.id,
          name: data.name,
          color: data.color,
          score: data.score || 0,
          powers: data.powers || {
            FREEZE: 1,
            STEAL: 1,
            SHIELD: 1
          }
        });
      });
      setConnectedPlayers(currentPlayers);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, playersPath);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'question' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (gameState === 'question' && timeLeft === 0) {
      setGameState('revealed');
      const roomPath = `rooms/${roomId}`;
      updateDoc(doc(db, roomPath), { gameState: 'revealed' }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft, roomId]);

  const startGame = () => {
    setPlayers(connectedPlayers.map(p => ({ ...p, score: 0 })));
    setGameState('playing');
    const roomPath = `rooms/${roomId}`;
    updateDoc(doc(db, roomPath), { gameState: 'playing' }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setGameState('question');
      setBuzzedPlayerId(null);
      setShowAnswer(false);
      setTimeLeft(15);
      const roomPath = `rooms/${roomId}`;
      updateDoc(doc(db, roomPath), { 
        gameState: 'question',
        buzzedPlayerId: null,
        buzzedAt: null
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
    } else {
      const roomPath = `rooms/${roomId}`;
      const playersRef = collection(db, 'rooms', roomId, 'players');
      getDocs(playersRef).then(snapshot => {
        snapshot.forEach(d => deleteDoc(d.ref));
      }).then(() => {
        deleteDoc(doc(db, roomPath));
      }).catch(console.error);
      onFinish(players);
    }
  };

  const showQuestion = () => {
    setGameState('question');
    setBuzzedPlayerId(null);
    setShowAnswer(false);
    setTimeLeft(15);
    const roomPath = `rooms/${roomId}`;
    updateDoc(doc(db, roomPath), { 
      gameState: 'question',
      buzzedPlayerId: null,
      buzzedAt: null
    }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
  };

  const handleSaveEdit = () => {
    if (activeQuestion && editedQuestion) {
      const updatedQ = { ...activeQuestion, ...editedQuestion } as Question;
      setActiveQuestion(updatedQ);
      setIsEditing(false);
    }
  };

  const baseUrl = process.env.SHARED_APP_URL || window.location.origin;
  const joinUrl = `${baseUrl}?mode=remote&roomId=${roomId}`;

  const handleAnswer = (isCorrect: boolean | null) => {
    if (isCorrect === true && buzzedPlayerId) {
      const updatedPlayers = players.map(p => 
        p.id === buzzedPlayerId ? { ...p, score: p.score + (activeQuestion.points || 100) } : p
      );
      setPlayers(updatedPlayers);
      
      // Update player score in Firestore
      const playerPath = `rooms/${roomId}/players/${buzzedPlayerId}`;
      updateDoc(doc(db, playerPath), {
        score: updatedPlayers.find(p => p.id === buzzedPlayerId)?.score || 0
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, playerPath));

      setGameState('revealed');
      const roomPath = `rooms/${roomId}`;
      updateDoc(doc(db, roomPath), { gameState: 'revealed' }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
    } else if (isCorrect === false) {
      // If wrong, reset buzzer and let others buzz
      setBuzzedPlayerId(null);
      setShowAnswer(false);
      setGameState('question');
      const roomPath = `rooms/${roomId}`;
      updateDoc(doc(db, roomPath), { 
        gameState: 'question',
        buzzedPlayerId: null,
        buzzedAt: null
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
    } else {
      // No one answered / skip
      setGameState('revealed');
      const roomPath = `rooms/${roomId}`;
      updateDoc(doc(db, roomPath), { gameState: 'revealed' }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
    }
  };

  const skipQuestion = () => {
    setGameState('revealed');
    const roomPath = `rooms/${roomId}`;
    updateDoc(doc(db, roomPath), { gameState: 'revealed' }).catch(err => handleFirestoreError(err, OperationType.WRITE, roomPath));
  };

  if (!auth.currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="text-6xl">🔒</div>
        <h2 className="text-2xl font-black text-slate-800">عذراً، نظام البازر يتطلب تفعيل المصادقة</h2>
        <p className="text-slate-500 max-w-md">
          يجب تفعيل "Anonymous Authentication" في Firebase Console لتتمكن من استخدام ميزة البازر عن بُعد.
        </p>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-amber-800 text-sm text-right">
          <p className="font-bold mb-2">خطوات الحل:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>اذهب إلى Firebase Console</li>
            <li>Authentication {"->"} Sign-in method</li>
            <li>قم بتفعيل "Anonymous"</li>
          </ol>
        </div>
      </div>
    );
  }

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
      <div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full max-w-6xl px-4">
        {players.map(p => (
          <div key={p.id} className="flex-1 min-w-[160px] md:min-w-[200px] bg-white p-4 md:p-6 rounded-[2rem] md:rounded-3xl border-2 border-slate-100 shadow-lg flex items-center gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-md shrink-0" style={{backgroundColor: p.color}}>
              {p.score}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">النقاط</span>
              <p className="text-base md:text-lg font-black text-slate-800 truncate">{p.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Game Area */}
      <div className="w-full max-w-4xl mx-auto bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl border-4 md:border-8 border-slate-50 text-center relative overflow-hidden">
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
            
            <div className="flex justify-center gap-3 mb-6 relative">
              {config.hexMode === 'manual' && gameState !== 'playing' && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute -top-12 right-0 p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-sky-100 hover:text-sky-600 transition-colors"
                  title="تعديل السؤال"
                >
                  ✏️
                </button>
              )}
              <span className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-500 font-bold text-sm">{activeQuestion.category}</span>
              <span className="px-4 py-2 bg-sky-50 text-sky-600 rounded-2xl font-bold text-sm">{activeQuestion.points || 100} نقطة</span>
            </div>

            {isEditing ? (
              <div className="space-y-4 text-right bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                <h3 className="text-2xl font-black text-slate-800 mb-4">تعديل السؤال</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">نص السؤال</label>
                  <textarea 
                    value={editedQuestion.text || ''} 
                    onChange={e => setEditedQuestion({...editedQuestion, text: e.target.value})}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold text-lg"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1">الإجابة</label>
                  <input 
                    type="text"
                    value={editedQuestion.answer || ''} 
                    onChange={e => setEditedQuestion({...editedQuestion, answer: e.target.value})}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold text-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">الفئة</label>
                    <input 
                      type="text"
                      value={editedQuestion.category || ''} 
                      onChange={e => setEditedQuestion({...editedQuestion, category: e.target.value})}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">النقاط</label>
                    <input 
                      type="number"
                      value={editedQuestion.points || 100} 
                      onChange={e => setEditedQuestion({...editedQuestion, points: parseInt(e.target.value) || 0})}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={handleSaveEdit} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-black hover:bg-green-600">حفظ التعديلات</button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl font-black hover:bg-slate-300">إلغاء</button>
                </div>
              </div>
            ) : (
              <h3 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-8">
                {activeQuestion.text}
              </h3>
            )}

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
              <div className="py-8 animate-fade-in w-full">
                <div className="inline-block p-8 rounded-[3rem] shadow-2xl mb-8 animate-bounce" style={{backgroundColor: players.find(p => p.id === buzzedPlayerId)?.color || '#38bdf8'}}>
                  <p className="text-white text-sm font-black uppercase tracking-widest mb-2 opacity-80">المتسابق الأسرع</p>
                  <h4 className="text-5xl font-black text-white">{players.find(p => p.id === buzzedPlayerId)?.name}</h4>
                </div>
                
                {!showAnswer ? (
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setShowAnswer(true)}
                      className="px-12 py-6 bg-sky-500 text-white rounded-2xl text-2xl font-black shadow-xl hover:bg-sky-600 hover:scale-105 transition-all"
                    >
                      إظهار الإجابة 👁️
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8 animate-fade-up">
                    <div className="p-8 bg-[#fefcd2] rounded-3xl border-4 border-black shadow-inner">
                      <p className="text-sm font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">الإجابة النموذجية</p>
                      <p className="text-4xl font-black text-black">{activeQuestion.answer}</p>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center">
                      <button onClick={() => handleAnswer(true)} className="flex-1 min-w-[200px] px-10 py-5 bg-green-500 text-white rounded-2xl text-2xl font-black shadow-lg hover:bg-green-600 hover:scale-105 transition-all">
                        إجابة صحيحة ✓
                      </button>
                      <button onClick={() => handleAnswer(false)} className="flex-1 min-w-[200px] px-10 py-5 bg-red-500 text-white rounded-2xl text-2xl font-black shadow-lg hover:bg-red-600 hover:scale-105 transition-all">
                        إجابة خاطئة ✗
                      </button>
                      <button onClick={() => handleAnswer(null)} className="flex-1 min-w-[200px] px-10 py-5 bg-slate-500 text-white rounded-2xl text-2xl font-black shadow-lg hover:bg-slate-600 hover:scale-105 transition-all">
                        لم يجب أحد / تخطي
                      </button>
                    </div>
                  </div>
                )}
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
