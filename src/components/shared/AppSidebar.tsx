"use client";

import { useState } from "react";
import { vaultService } from "@/services/vaultService";
import { VaultScope } from "@/types";
import { ScopeType } from "./DashboardContent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Building2,
  FolderKanban,
  Globe,
  Plus,
  type LucideIcon,
  Hash,
} from "lucide-react";

interface AppSidebarProps {
  activeType: ScopeType;
  activeScopeId: string | null;
  onScopeChange: (type: ScopeType, scopeId: string | null) => void;
  scopes: VaultScope[];
  onRefresh: () => void;
}

export function AppSidebar({
  activeType,
  activeScopeId,
  onScopeChange,
  scopes,
  onRefresh,
}: AppSidebarProps) {
  const [addingTo, setAddingTo] = useState<ScopeType | null>(null);
  const [newScopeName, setNewScopeName] = useState("");

  const menuItems: { id: ScopeType; label: string; icon: LucideIcon }[] = [
    { id: "provider", label: "Cloud Providers", icon: Building2 },
    { id: "project", label: "Projects", icon: FolderKanban },
    { id: "global", label: "Global Vault", icon: Globe },
  ];

  const handleAddScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScopeName || !addingTo) return;
    try {
      await vaultService.createScope(addingTo, newScopeName);
      setNewScopeName("");
      setAddingTo(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to add scope", err);
    }
  };

  return (
    <aside className="w-72 border-r border-slate-100 bg-white p-6 overflow-y-auto">
      <div className="mb-10 px-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Main Categories
        </h3>
      </div>

      <nav className="space-y-10">
        {menuItems.map((item) => (
          <div key={item.id} className="space-y-4">
            <div className="flex items-center justify-between group px-1">
              <button
                onClick={() => onScopeChange(item.id, null)}
                className={cn(
                  "flex flex-1 items-center gap-3 py-1.5 text-sm font-bold transition-all",
                  activeType === item.id && activeScopeId === null
                    ? "text-indigo-600"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                    activeType === item.id && activeScopeId === null
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                {item.label}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-slate-100"
                onClick={() =>
                  setAddingTo(addingTo === item.id ? null : item.id)
                }
              >
                <Plus className="h-4 w-4 text-slate-400" />
              </Button>
            </div>

            <div className="ml-5 border-l-2 border-slate-50 pl-4 space-y-1">
              {addingTo === item.id && (
                <form onSubmit={handleAddScope} className="mb-2">
                  <Input
                    autoFocus
                    placeholder="New scope..."
                    className="h-9 text-xs bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                    value={newScopeName}
                    onChange={(e) => setNewScopeName(e.target.value)}
                    onBlur={() => !newScopeName && setAddingTo(null)}
                  />
                </form>
              )}

              {scopes
                .filter((s) => s.scope === item.id)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onScopeChange(item.id, s.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all group/item",
                      activeScopeId === s.id
                        ? "text-indigo-600 bg-indigo-50/50 shadow-sm"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/50"
                    )}
                  >
                    <Hash
                      className={cn(
                        "h-3.5 w-3.5",
                        activeScopeId === s.id
                          ? "text-indigo-600"
                          : "text-slate-300 group-hover/item:text-slate-400"
                      )}
                    />
                    {s.scope_id}
                  </button>
                ))}

              {scopes.filter((s) => s.scope === item.id).length === 0 &&
                !addingTo && (
                  <p className="py-2 text-[11px] text-slate-300 font-medium italic">
                    Empty storage
                  </p>
                )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
