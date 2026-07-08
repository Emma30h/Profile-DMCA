export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex items-center justify-center bg-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
