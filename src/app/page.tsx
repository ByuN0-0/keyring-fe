export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,#f0f9ff_0%,#ffffff_100%)]"></div>

      <main className="text-center px-6">
        <div className="mb-6 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          클라이언트 사이드 암호화 적용
        </div>

        <h1 className="mb-6 text-6xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
          안전한 <span className="text-blue-600">Keyring</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 leading-relaxed">
          Zero-Knowledge 기반의 비밀값 관리 솔루션입니다. 모든 데이터는
          브라우저에서 AES-GCM 방식으로 암호화되며, 서버는 당신의 원문 데이터를
          절대 알 수 없습니다.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-8 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 sm:w-auto"
          >
            시작하기
          </a>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-slate-400 font-medium">
        Hono, Next.js, WebCrypto 기술로 구축되었습니다.
      </footer>
    </div>
  );
}
