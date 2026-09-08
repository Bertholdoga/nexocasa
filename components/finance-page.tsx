import { chatGPTSignInPath } from '@/app/chatgpt-auth';
import {
  FinanceWorkspace,
  type WorkspaceView,
} from '@/components/finance-workspace';
import { getSiteUser } from '@/lib/server-user';

export async function FinancePage({ view }: { view: WorkspaceView }) {
  const user = await getSiteUser();

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#071817] px-5 text-white">
        <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="text-xl font-semibold tracking-[-0.03em]">
              NexoCasa
            </span>
          </div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-teal-300">
            Seu espaço privado
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.05em]">
            Finanças em sintonia, sem planilhas frágeis.
          </h1>
          <p className="mt-4 leading-7 text-white/65">
            Entre com sua conta ChatGPT para acessar lançamentos, orçamentos,
            metas e relatórios.
          </p>
          <a
            href={chatGPTSignInPath('/dashboard')}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-teal-300 px-5 font-semibold text-[#071817] transition hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
          >
            Entrar com ChatGPT
          </a>
        </section>
      </main>
    );
  }

  return (
    <FinanceWorkspace
      activeView={view}
      displayName={user.displayName}
      isLocalPreview={user.isLocalPreview}
    />
  );
}
