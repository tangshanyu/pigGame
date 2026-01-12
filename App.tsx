
import React, { useState } from 'react';
import WhacAMoleGame from './components/WhacAMoleGame';
import RhythmGame from './components/RhythmGame';
import FlyingCalfGame from './components/FlyingCalfGame';

type ViewState = 'MENU' | 'WHAC_A_MOLE' | 'RHYTHM' | 'FLYING';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('MENU');

  if (view === 'WHAC_A_MOLE') {
    return <WhacAMoleGame onBack={() => setView('MENU')} />;
  }

  if (view === 'RHYTHM') {
    return <RhythmGame onBack={() => setView('MENU')} />;
  }

  if (view === 'FLYING') {
    return <FlyingCalfGame onBack={() => setView('MENU')} />;
  }

  return (
    <div className="min-h-screen bg-sky-100 flex flex-col items-center justify-center p-4 relative overflow-hidden overflow-y-auto">
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none fixed">
         <div className="absolute top-0 left-0 w-full h-1/2 bg-sky-200"></div>
         <div className="absolute bottom-0 left-0 w-full h-1/2 bg-green-200"></div>
         <div className="absolute bottom-1/2 left-10 text-8xl transform translate-y-1/2">🏡</div>
         <div className="absolute bottom-1/2 right-10 text-8xl transform translate-y-1/2">🌳</div>
      </div>

      <div className="relative z-10 text-center mb-8 mt-8">
        <h1 className="text-5xl md:text-7xl font-black text-amber-800 drop-shadow-white stroke-white mb-2">
          農場運動會
        </h1>
        <p className="text-xl text-amber-700 font-bold bg-white/50 inline-block px-6 py-2 rounded-full">
          選擇你想玩的遊戲！
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl pb-8">
        
        {/* Card 1: Whac-A-Mole */}
        <button 
          onClick={() => setView('WHAC_A_MOLE')}
          className="group relative bg-white rounded-[2rem] p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 border-b-8 border-amber-200 active:border-b-0 active:translate-y-0 h-full flex flex-col items-center justify-between"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-1 rounded-full font-bold shadow-md text-sm whitespace-nowrap">
            經典模式
          </div>
          <div className="text-7xl mb-4 group-hover:scale-110 transition-transform mt-4">
             🔨🐷
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">小牛打小豬</h2>
            <p className="text-gray-500 font-medium text-sm">
                拿著木槌，把那些調皮的小豬敲回去！<br/>
                (小心不要敲到手喔)
            </p>
          </div>
        </button>

        {/* Card 2: Rhythm Game */}
        <button 
          onClick={() => setView('RHYTHM')}
          className="group relative bg-white rounded-[2rem] p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 border-b-8 border-pink-200 active:border-b-0 active:translate-y-0 h-full flex flex-col items-center justify-between"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-1 rounded-full font-bold shadow-md text-sm whitespace-nowrap">
            音樂模式
          </div>
          <div className="text-7xl mb-4 group-hover:scale-110 transition-transform animate-bounce mt-4">
             🎵🐮
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">小牛跳跳樂</h2>
            <p className="text-gray-500 font-medium text-sm">
                跟著佩奇風格的音樂節奏，<br/>
                接住掉下來的小牛們！
            </p>
          </div>
        </button>

        {/* Card 3: Flying Game */}
        <button 
          onClick={() => setView('FLYING')}
          className="group relative bg-white rounded-[2rem] p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 border-b-8 border-sky-200 active:border-b-0 active:translate-y-0 h-full flex flex-col items-center justify-between"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-4 py-1 rounded-full font-bold shadow-md text-sm whitespace-nowrap">
            飛行模式
          </div>
          <div className="text-7xl mb-4 group-hover:rotate-12 transition-transform mt-4">
             🐮🥽
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">小牛飛天</h2>
            <p className="text-gray-500 font-medium text-sm">
                點擊螢幕讓小牛飛起來，<br/>
                閃避前方的豬柵欄！
            </p>
          </div>
        </button>

      </div>

      <div className="text-gray-500 text-sm font-bold opacity-50 mt-4 mb-4 z-10">
        Designed for Fun & Cows
      </div>
    </div>
  );
};

export default App;
