'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function Header({ userName, expiresAt }: { userName: string; expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        clearInterval(timer);
        router.push('/login');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, router]);

  const handleLogout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm shadow-slate-50">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 font-bold text-[14px] text-white">K</div>
        <span className="text-[15px] font-black tracking-tight text-slate-900 uppercase">Keyring</span>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Session</span>
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
          <span className="text-[11px] font-mono font-bold text-slate-600">{timeLeft}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">{userName}님</span>
          <button 
            onClick={handleLogout}
            className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
