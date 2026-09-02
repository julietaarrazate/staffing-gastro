/** Banner inline de error persistente (para estados de carga fallidos). */
export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl bg-danger-tint px-4 py-3 text-sm font-medium text-danger-text ring-1 ring-danger/15">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-semibold underline decoration-danger/40 underline-offset-2 hover:opacity-80"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
