import Sidebar from "@/components/Sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-3 pb-24 sm:p-6 md:pb-6">{children}</main>
    </div>
  );
}
