"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authService } from "@/services/authService";
import { User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogOut, Timer } from "lucide-react";

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
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        <Image
          src="/keyring.png"
          alt="Keyring Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <span className="font-bold tracking-tight text-lg">KEYRING</span>
      </div>

      <div className="flex items-center gap-6">
        <Badge
          variant="outline"
          className="font-mono flex items-center gap-2 py-1"
        >
          <Timer className="h-3 w-3" /> {timeLeft}
        </Badge>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{user.name}님</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> 로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}
