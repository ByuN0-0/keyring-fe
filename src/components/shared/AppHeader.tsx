"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authService } from "@/services/authService";
import { User } from "@/types";
import { LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader({
  user,
  expiresAt,
}: {
  user: User;
  expiresAt: number;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
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
        setIsExpiringSoon(diff < 5 * 60 * 1000); // < 5분
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, router]);

  const handleLogout = async () => {
    await authService.logout();
    router.push("/login");
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 z-50">
      {/* Left: Logo + Brand */}
      <div className="flex items-center gap-2.5">
        <Image src="/keyring.png" alt="Keyring" width={22} height={22} />
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          Keyring
        </span>
      </div>

      {/* Right: Session + User */}
      <div className="flex items-center gap-3">
        {/* Session timer */}
        {timeLeft && (
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                isExpiringSoon ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
            <span
              className={`text-xs font-mono tabular-nums ${
                isExpiringSoon ? "text-red-500" : "text-slate-400"
              }`}
            >
              {timeLeft}
            </span>
          </div>
        )}

        <div className="h-4 w-px bg-slate-100" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold ring-1 ring-indigo-100 hover:bg-indigo-100 transition-colors focus:outline-none">
              {initials || <UserIcon className="h-3.5 w-3.5" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-900">
                  {user.name}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
