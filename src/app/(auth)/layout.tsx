export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-full flex items-center justify-center overflow-hidden bg-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob aurora-blob-a -top-40 -left-32 h-[32rem] w-[32rem] bg-blue-600" />
        <div className="aurora-blob aurora-blob-b top-1/3 -right-40 h-[36rem] w-[36rem] bg-indigo-500" />
        <div className="aurora-blob aurora-blob-c -bottom-48 left-1/4 h-[30rem] w-[30rem] bg-blue-900" />
      </div>
      {children}
    </div>
  );
}
