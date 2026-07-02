/** Banner inline de error persistente (para estados de carga fallidos). */
export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
      {message}
    </div>
  );
}
