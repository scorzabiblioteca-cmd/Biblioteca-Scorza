import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import "./panel.css";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper md:flex">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-3 pb-28 pt-5 sm:px-6 sm:pb-24 md:px-8 md:pb-8 md:pt-8">{children}</main>
        <footer className="px-3 pb-5 text-left text-xs leading-relaxed text-[#8793a4] sm:px-6 md:px-8 md:pb-6">
          © 2026 Derechos reservados al colegio Manuel Scorza Torres, R.R.R.H.Y.
        </footer>
      </div>
    </div>
  );
}
