"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface PassphrasePanelProps {
  passphrase: string;
  onPassphraseChange: (value: string) => void;
}

export function PassphrasePanel({
  passphrase,
  onPassphraseChange,
}: PassphrasePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row items-center gap-4 rounded-xl bg-white border p-4 transition-all duration-300",
        passphrase
          ? "border-emerald-200 border-l-2 border-l-emerald-500"
          : "border-slate-200 border-l-2 border-l-indigo-400"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
          passphrase
            ? "bg-emerald-50 text-emerald-600"
            : "bg-indigo-50 text-indigo-500"
        )}
      >
        {passphrase ? (
          <ShieldCheck className="h-5 w-5" />
        ) : (
          <ShieldAlert className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">
          마스터 패스프레이즈
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          암호화 및 복호화를 위한 키입니다. 서버에 저장되지 않습니다.
        </p>
      </div>
      <div className="w-full md:w-72">
        <Input
          type="password"
          placeholder="패스프레이즈 입력"
          className="h-9 bg-slate-50 border-slate-200 font-mono text-sm rounded-lg"
          value={passphrase}
          onChange={(e) => onPassphraseChange(e.target.value)}
        />
      </div>
    </div>
  );
}
