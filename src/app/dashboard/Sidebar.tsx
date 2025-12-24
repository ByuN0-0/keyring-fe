'use client';

export type ScopeType = 'provider' | 'project' | 'global';

export interface VaultScope {
  scope: ScopeType;
  scope_id: string;
}

export default function Sidebar({ 
  activeType, 
  activeScopeId, 
  onScopeChange,
  scopes
}: { 
  activeType: ScopeType; 
  activeScopeId: string | null;
  onScopeChange: (type: ScopeType, scopeId: string | null) => void;
  scopes: VaultScope[];
}) {
  const menuItems: { id: ScopeType; label: string; icon: string }[] = [
    { id: 'provider', label: '서비스 공급자', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'project', label: '프로젝트', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2zm0 0l7 7 7-7' },
    { id: 'global', label: '전역 설정', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-50/50 p-4 overflow-y-auto">
      <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        저장소 메뉴
      </div>
      <nav className="space-y-4">
        {menuItems.map((item) => (
          <div key={item.id} className="space-y-1">
            <button
              onClick={() => onScopeChange(item.id, null)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all ${
                activeType === item.id && activeScopeId === null
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <svg className={`h-4 w-4 ${activeType === item.id && activeScopeId === null ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </button>
            
            {/* Nested scope_ids */}
            <div className="ml-9 space-y-1">
              {scopes
                .filter((s) => s.scope === item.id)
                .map((s) => (
                  <button
                    key={s.scope_id}
                    onClick={() => onScopeChange(item.id, s.scope_id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                      activeType === item.id && activeScopeId === s.scope_id
                        ? 'text-blue-600 bg-blue-50/50'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className={`h-1 w-1 rounded-full ${activeType === item.id && activeScopeId === s.scope_id ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                    {s.scope_id}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}