'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { encryptData, decryptData } from '@/lib/crypto';
import Header from './Header';
import Sidebar, { ScopeType, VaultScope } from './Sidebar';

interface User {
  id: string;
  name: string;
  email: string;
}

interface VaultFragment {
  scope_pk: string;
  user_id: string;
  encrypted_blob: string;
  salt: string;
  updated_at: string;
  scope: ScopeType;
  scope_id: string | null;
}

interface MeResponse {
  user: User;
  expiresAt: number;
  fragments?: VaultFragment[];
  scopes?: VaultScope[];
}

interface ScopesResponse {
  scopes: VaultScope[];
}

interface FragmentsResponse {
  fragments: VaultFragment[];
}

interface SuccessResponse {
  success: boolean;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [activeType, setActiveType] = useState<ScopeType>('provider');
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<VaultScope[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [fragments, setFragments] = useState<VaultFragment[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newScopeId, setNewScopeId] = useState('');
  const [showNewValue, setShowNewValue] = useState(false);
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  const scopeNames = {
    provider: '서비스 공급자',
    project: '프로젝트',
    global: '전역 설정'
  };

  const fetchScopes = useCallback(async () => {
    try {
      const data = await apiFetch<ScopesResponse>('/vault/scopes');
      setScopes(data.scopes);
    } catch (err) {
      console.error('Failed to fetch scopes', err);
    }
  }, []);

  const fetchFragments = useCallback(async () => {
    try {
      const data = await apiFetch<FragmentsResponse>('/vault');
      setFragments(data.fragments);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const data = await apiFetch<MeResponse>('/auth/me');
        setUser(data.user);
        setExpiresAt(data.expiresAt);
        if (data.fragments) setFragments(data.fragments);
        if (data.scopes) setScopes(data.scopes);
      } catch (err) {
        router.push('/login');
      }
    };
    initDashboard();
  }, [router]);

  const handleScopeChange = (type: ScopeType, scopeId: string | null) => {
    setActiveType(type);
    setActiveScopeId(scopeId);
    setNewScopeId(scopeId || '');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setError('데이터 암호화를 위해 마스터 패스프레이즈를 먼저 입력해주세요.');
      return;
    }
    try {
      const { encrypted_blob, salt } = await encryptData(newValue, passphrase);
      await apiFetch<SuccessResponse>('/vault', {
        method: 'POST',
        body: JSON.stringify({
          scope_pk: newKey,
          scope: activeType,
          scope_id: newScopeId || null,
          encrypted_blob,
          salt,
        }),
      });
      setNewKey('');
      setNewValue('');
      setIsAdding(false);
      fetchFragments();
      fetchScopes();
      setError('');
    } catch (err) {
      setError('비밀값 저장에 실패했습니다. 입력 내용을 확인해주세요.');
    }
  };

  const handleDecrypt = async (fragment: VaultFragment) => {
    if (!passphrase) {
      setError('비밀값을 복호화하려면 마스터 패스프레이즈가 필요합니다.');
      return;
    }
    try {
      const decrypted = await decryptData(fragment.encrypted_blob, fragment.salt, passphrase);
      setDecryptedValues((prev) => ({ ...prev, [fragment.scope_pk]: decrypted }));
      setVisibleSecrets((prev) => ({ ...prev, [fragment.scope_pk]: true }));
      setError('');
    } catch (err) {
      setError('복호화 실패: 패스프레이즈가 틀렸거나 데이터가 손상되었습니다.');
    }
  };

  const toggleVisibility = (key: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredFragments = fragments.filter(f => {
    const typeMatch = (f.scope || 'global') === activeType;
    const idMatch = activeScopeId ? f.scope_id === activeScopeId : true;
    return typeMatch && idMatch;
  });

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-50/50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-400">보안 환경을 구성하는 중...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900">
      <Header userName={user.name} expiresAt={expiresAt} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          activeType={activeType} 
          activeScopeId={activeScopeId} 
          onScopeChange={handleScopeChange}
          scopes={scopes}
        />
        
        <main className="flex-1 overflow-y-auto bg-slate-50/20 p-8">
          <div className="mx-auto max-w-5xl">
            {/* Page Title & Actions */}
            <div className="mb-10 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {scopeNames[activeType]} {activeScopeId && <span className="text-blue-600 ml-2">› {activeScopeId}</span>}
                </h2>
                <p className="mt-1 text-slate-500 font-medium">안전하게 보관된 {activeScopeId || scopeNames[activeType]}의 비밀값 목록입니다.</p>
              </div>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="btn-primary gap-2 bg-slate-900 hover:bg-black transition-all shadow-md shadow-slate-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                항목 추가
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Security Section */}
            <div className="card mb-8 p-6 border-slate-200 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <h3 className="font-bold text-sm tracking-tight uppercase">마스터 패스프레이즈</h3>
              </div>
              <input
                type="password"
                placeholder="암호화/복호화에 사용할 키를 입력하세요"
                className="input-field max-w-md border-slate-300 focus:ring-slate-400 focus:border-slate-500"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              <p className="mt-2 text-[11px] text-slate-500 font-medium italic">* 본인만 아는 안전한 키를 사용하세요. 서버에 저장되지 않습니다.</p>
            </div>

            {/* Add Secret Form */}
            {isAdding && (
              <div className="card mb-8 animate-in fade-in slide-in-from-top-4 p-6 border-slate-200 shadow-md duration-300">
                <h3 className="mb-5 font-bold text-slate-900">새로운 비밀값 생성</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">세부 분류 (Scope ID)</label>
                    <input
                      type="text"
                      placeholder="예: AWS, ProjectA"
                      className="input-field border-slate-300"
                      value={newScopeId}
                      onChange={(e) => setNewScopeId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">키 이름 (Key)</label>
                    <input
                      type="text"
                      placeholder="예: API_KEY"
                      className="input-field border-slate-300"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">값 (Value)</label>
                    <div className="relative">
                      <input
                        type={showNewValue ? "text" : "password"}
                        placeholder="비밀값 입력"
                        className="input-field border-slate-300 pr-10"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowNewValue(!showNewValue)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewValue ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="btn-primary w-full h-10 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100/50">암호화 및 저장</button>
                  </div>
                </form>
              </div>
            )}

            {/* Secrets List */}
            <div className="card overflow-hidden border-slate-200 shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="grid grid-cols-12 gap-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  <div className="col-span-4">키 이름</div>
                  <div className="col-span-6">데이터 (복호화 시 확인 가능)</div>
                  <div className="col-span-2 text-right">작업</div>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {filteredFragments.map((f) => (
                  <div key={f.scope_pk} className="grid grid-cols-12 items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-4 font-mono text-sm font-bold text-slate-800">
                      {f.scope_pk}
                    </div>
                    <div className="col-span-6 flex items-center gap-3">
                      {decryptedValues[f.scope_pk] ? (
                        <>
                          <div className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 font-mono text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            {visibleSecrets[f.scope_pk] ? decryptedValues[f.scope_pk] : '••••••••••••'}
                          </div>
                          <button 
                            onClick={() => toggleVisibility(f.scope_pk)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {visibleSecrets[f.scope_pk] ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="flex gap-1.5 px-1">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-1 w-1 rounded-full bg-slate-300"></div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      {!decryptedValues[f.scope_pk] && (
                        <button
                          onClick={() => handleDecrypt(f)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline"
                        >
                          복호화
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredFragments.length === 0 && (
                  <div className="py-24 text-center">
                    <p className="text-sm font-bold text-slate-400">저장된 비밀값이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}