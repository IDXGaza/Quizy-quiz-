
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestoreUtils';

const RemoteBuzzer: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{id: string, name: string, color: string} | null>(null);
  const [status, setStatus] = useState<'idle' | 'pressed' | 'error' | 'connecting' | 'locked'>('connecting');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((error: any) => {
          if (error.code === 'auth/admin-restricted-operation') {
            setAuthError("عذراً، يجب تفعيل 'Anonymous Authentication' في لوحة تحكم Firebase.");
          } else {
            console.error("Auth Error:", error);
            setAuthError(error.message);
          }
        });
      } else {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const params = new URLSearchParams(window.location.search);
    const rid = params.get('roomId');
    
    if (rid && isAuthReady && auth.currentUser) {
      setRoomId(rid);
      setStatus('idle');
      
      const roomRef = doc(db, 'rooms', rid);
      const unsubscribe = onSnapshot(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
          setStatus('error');
          return;
        }
        
        const data = snapshot.data();
        if (data.buzzedPlayerId) {
          if (selectedPlayer && data.buzzedPlayerId === selectedPlayer.id) {
            setStatus('pressed');
          } else {
            setStatus('locked');
          }
        } else {
          setStatus('idle');
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${rid}`);
      });

      return () => unsubscribe();
    }
  }, [selectedPlayer, isAuthReady]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerNameInput.trim() || !roomId || !auth.currentUser) return;
    
    const newPlayer = {
      id: auth.currentUser.uid,
      name: playerNameInput.trim(),
      color: '#38bdf8' // Default color
    };
    
    setSelectedPlayer(newPlayer);
    
    // Add player to room
    const playerPath = `rooms/${roomId}/players/${auth.currentUser.uid}`;
    setDoc(doc(db, playerPath), {
      name: newPlayer.name,
      color: newPlayer.color,
      score: 0,
      joinedAt: new Date().toISOString()
    }).catch(err => handleFirestoreError(err, OperationType.WRITE, playerPath));
  };

  const handlePress = () => {
    if (!selectedPlayer || !roomId || status !== 'idle') return;

    setStatus('pressed');
    
    // Update room with buzzed player
    const roomPath = `rooms/${roomId}`;
    updateDoc(doc(db, roomPath), {
      buzzedPlayerId: selectedPlayer.id,
      buzzedAt: new Date().toISOString()
    }).catch(err => {
      console.error("Error buzzing in:", err);
      setStatus('idle');
      handleFirestoreError(err, OperationType.WRITE, roomPath);
    });
    
    if (window.navigator.vibrate) window.navigator.vibrate(200);
  };

  const goHome = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-bold text-red-500 mb-4">خطأ في المصادقة</h2>
        <p className="text-slate-500 max-w-md mb-6">{authError}</p>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm mb-6">
          يرجى إبلاغ منظم المسابقة بتفعيل "Anonymous Authentication" في إعدادات Firebase.
        </div>
        <button onClick={goHome} className="px-10 py-4 sky-btn rounded-2xl font-bold shadow-lg text-white">العودة للرئيسية</button>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">خطأ في الجلسة</h2>
        <button onClick={goHome} className="px-10 py-4 sky-btn rounded-2xl font-bold shadow-lg text-white">العودة للرئيسية</button>
      </div>
    );
  }

  if (!selectedPlayer) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-sky-50 text-center">
          <div className="text-4xl mb-6">👤</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">من المتسابق؟</h2>
          <p className="text-slate-400 text-sm mb-8 font-medium">أدخل اسمك للبدء باستخدام البازر</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <input 
              type="text" 
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              placeholder="اسم المتسابق"
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-lg text-center focus:border-sky-400 focus:ring-4 focus:ring-sky-50 outline-none transition-all"
              required
            />
            <button
              type="submit"
              className="w-full py-5 sky-btn text-white rounded-2xl font-black text-xl shadow-xl hover:scale-105 transition-transform"
            >
              انضمام
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between py-12 px-6 overflow-hidden relative">
      <div className="text-center z-10">
        <p className="text-sky-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2">ركن المتسابق</p>
        <h2 className="text-4xl font-black text-slate-800 mb-2">{selectedPlayer.name}</h2>
        <div className="inline-flex items-center gap-2 px-4 py-1 bg-sky-50 rounded-full border border-sky-100">
          <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
          <span className="text-sky-700 text-[10px] font-bold uppercase tracking-widest">متصل</span>
        </div>
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <button
          onClick={handlePress}
          disabled={status !== 'idle'}
          className={`relative w-72 h-72 rounded-full border-[12px] shadow-3xl transition-all duration-300 flex flex-col items-center justify-center select-none touch-manipulation ${
            status === 'pressed' 
            ? 'bg-green-500 border-green-200 scale-95 shadow-inner' 
            : status === 'locked'
            ? 'bg-slate-300 border-slate-200 opacity-50 cursor-not-allowed'
            : 'bg-gradient-to-tr from-sky-600 to-sky-400 border-white shadow-2xl hover:scale-105 active:scale-95'
          }`}
        >
          <span className="text-white text-8xl mb-2">
            {status === 'pressed' ? '✓' : status === 'locked' ? '🔒' : '⚡'}
          </span>
          <span className="text-white font-black text-3xl tracking-widest">
            {status === 'pressed' ? 'أنت الأسرع!' : status === 'locked' ? 'مغلق' : 'BUZZ'}
          </span>
        </button>
      </div>

      <div className="z-10 text-center">
        <p className="text-slate-400 text-sm font-bold">
          {status === 'idle' ? 'اضغط بأسرع ما يمكن عند ظهور السؤال!' : 
           status === 'pressed' ? 'انتظر قرار المقدم...' : 
           status === 'locked' ? 'سبقك متسابق آخر!' : ''}
        </p>
      </div>
    </div>
  );
};

export default RemoteBuzzer;