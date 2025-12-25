"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authService } from "@/services/authService";
import { User } from "@/types";
import { Bell, User as UserIcon } from "lucide-react";

export function AppHeader({
  user,
  expiresAt,
}: {
  user: User;
  expiresAt: number;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        clearInterval(timer);
        router.push("/login");
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs < 10 ? "0" : ""}${secs}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, router]);

  const handleLogout = async () => {
    await authService.logout();
    router.push("/login");
  };

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-100 bg-white px-10 shadow-sm z-50">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-indigo-100">
          <Image src="/keyring.png" alt="Logo" width={32} height={32} />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
            Keyring
          </span>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            Secure Vault
          </span>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2">
          <div className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-black font-mono text-slate-600 tracking-wider">
            SECURE SESSION: {timeLeft}
          </span>
        </div>

        <div className="h-8 w-px bg-slate-100" />

        <div className="flex items-center gap-5">
          <button className="text-slate-400 hover:text-slate-900 transition-colors">
            <Bell className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 pl-2 group cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-[10px] font-bold text-slate-400 text-left hover:text-red-500 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
