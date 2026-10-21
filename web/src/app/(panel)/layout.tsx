import Sidebar from "@/components/Sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 p-3 pb-24 sm:p-6 md:pb-6">{children}</main>
        <footer className="px-3 pb-4 text-left text-xs text-slate-400 sm:px-6 md:pb-5">
          © 2026 Derechos reservados al colegio Manuel Scorza Torres, R.R.R.H.Y.
        </footer>
      </div>
    </div>
  );
}
