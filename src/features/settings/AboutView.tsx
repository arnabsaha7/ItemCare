import { HomeVaultIcon } from '@/src/components/shared/HomeVaultIcon';

export function AboutView({ embedded = false }: { embedded?: boolean }) {
  const details = [
    { label: 'Application', value: 'HomeVault' },
    { label: 'Version', value: '1.0.0' },
    { label: 'Created By', value: 'Arnab' },
    { label: 'Mode', value: 'Offline-First (Saved on your device)' },
    { label: 'Supported OS', value: 'Windows 10 & Windows 11' },
  ];

  const content = (
    <div className="space-y-6">
      {embedded && (
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
            About HomeVault
          </h2>
          <p className="text-[13px] text-hv-muted mt-0.5">
            Application information and version details.
          </p>
        </div>
      )}

      {/* App Identity Card */}
      <section className="bg-hv-card border border-hv-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <HomeVaultIcon className="w-14 h-14 shrink-0" />
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight text-hv-text">
            HomeVault
          </h3>
          <p className="text-[13.5px] text-hv-muted mt-0.5">
            Your Personal Home & Asset Command Center — keep household appliances, warranties,
            maintenance schedules, property specs, and important documents organized in one place.
          </p>
        </div>
      </section>

      {/* Consumer Details */}
      <section className="bg-hv-card border border-hv-border rounded-xl divide-y divide-hv-border">
        {details.map((row) => (
          <div
            key={row.label}
            className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
          >
            <span className="text-[13px] text-hv-muted">{row.label}</span>
            <span className="text-[13.5px] font-medium text-hv-text">
              {row.value}
            </span>
          </div>
        ))}
      </section>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6 sm:px-8">
      <div className="max-w-[880px] mx-auto">{content}</div>
    </div>
  );
}
