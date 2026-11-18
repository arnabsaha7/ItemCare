import {
  CheckCircle2,
  FileText,
  Home,
  Mail,
  RotateCcw,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppSettings } from '@/src/types/homevault';

interface ProfileViewProps {
  settings: AppSettings;
  assetCount: number;
  documentCount: number;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export function ProfileView({
  settings,
  assetCount,
  documentCount,
  onUpdateSettings,
}: ProfileViewProps) {
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [residenceName, setResidenceName] = useState(settings.residenceName);
  const [ownerEmail, setOwnerEmail] = useState(settings.ownerEmail);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setOwnerName(settings.ownerName);
    setResidenceName(settings.residenceName);
    setOwnerEmail(settings.ownerEmail);
  }, [settings.ownerName, settings.residenceName, settings.ownerEmail]);

  const isDirty =
    ownerName !== settings.ownerName ||
    residenceName !== settings.residenceName ||
    ownerEmail !== settings.ownerEmail;

  const displayOwner = ownerName.trim() || 'Homeowner';
  const displayResidence = residenceName.trim() || 'Main Residence';
  const displayEmail = ownerEmail.trim();

  const initials = displayOwner
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await onUpdateSettings({
        ownerName: displayOwner,
        residenceName: displayResidence,
        ownerEmail: displayEmail,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setOwnerName(settings.ownerName);
    setResidenceName(settings.residenceName);
    setOwnerEmail(settings.ownerEmail);
    setSaved(false);
    setSaveError(null);
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6 sm:px-8">
      <div className="max-w-[1160px] mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
            Household Profile
          </h1>
          <p className="text-[13px] text-hv-muted mt-0.5">
            Manage homeowner details displayed on your residence profile and insurance valuation reports.
          </p>
        </div>

        {/* Identity Banner */}
        <section className="bg-hv-card border border-hv-border rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-hv-accent text-white font-semibold text-[18px] flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[17px] font-semibold text-hv-text truncate">
                {settings.ownerName}
              </div>
              <div className="text-[13px] text-hv-muted truncate mt-0.5">
                {settings.residenceName}
                {settings.ownerEmail ? ` · ${settings.ownerEmail}` : ''}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-hv-border border border-hv-border rounded-lg bg-hv-subtle shrink-0">
            <div className="px-4 py-2.5 text-center">
              <div className="text-[16px] font-semibold tabular-nums text-hv-text">
                {assetCount}
              </div>
              <div className="text-[11px] text-hv-muted">Assets</div>
            </div>
            <div className="px-4 py-2.5 text-center">
              <div className="text-[16px] font-semibold tabular-nums text-hv-text">
                {documentCount}
              </div>
              <div className="text-[11px] text-hv-muted">Documents</div>
            </div>
            <div className="px-4 py-2.5 text-center">
              <div className="text-[16px] font-semibold text-hv-accent-fg">
                {settings.currency}
              </div>
              <div className="text-[11px] text-hv-muted">Currency</div>
            </div>
          </div>
        </section>

        {/* Balanced 2-Column Equal-Height Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left: Editable Form */}
          <form
            onSubmit={(e) => void handleSave(e)}
            className="h-full flex flex-col justify-between bg-hv-card border border-hv-border rounded-xl p-6 space-y-5"
          >
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-hv-text">
                  Owner & Residence Details
                </h2>
                <p className="text-[12px] text-hv-muted mt-0.5">
                  Update your name, primary home label, and contact email.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-hv-muted">
                    <User className="w-3.5 h-3.5" />
                    <span>Owner Name</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent-fg/40"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-hv-muted">
                    <Home className="w-3.5 h-3.5" />
                    <span>Primary Residence Label</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={residenceName}
                    onChange={(e) => setResidenceName(e.target.value)}
                    placeholder="e.g., Main Residence"
                    className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent-fg/40"
                  />
                </label>

                <label className="sm:col-span-2 block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-hv-muted">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Contact Email</span>
                  </span>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent-fg/40"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-hv-border">
              <div className="min-h-[20px]">
                {saveError ? (
                  <span className="text-[12.5px] text-hv-danger font-medium">{saveError}</span>
                ) : saved ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-hv-success font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Profile saved
                  </span>
                ) : isDirty ? (
                  <span className="text-[12px] text-hv-warning font-medium">
                    Unsaved changes
                  </span>
                ) : (
                  <span className="text-[12px] text-hv-muted">
                    All profile details up to date
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-hv-border-strong text-[13px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </form>

          {/* Right: Valuation Report Header Preview */}
          <section className="h-full flex flex-col justify-between bg-hv-card border border-hv-border rounded-xl p-6 space-y-5">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-hv-accent-fg" />
                  <h2 className="text-[15px] font-semibold text-hv-text">
                    Valuation Report Header Preview
                  </h2>
                </div>
                <p className="text-[12px] text-hv-muted mt-0.5">
                  Live preview of how your homeowner header appears on exported valuation PDFs.
                </p>
              </div>

              <div className="rounded-lg border border-hv-border bg-hv-subtle p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-3 border-b border-hv-border pb-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-hv-accent-fg">
                      HomeVault Insurance Report
                    </div>
                    <div className="text-[15px] font-semibold text-hv-text mt-0.5 truncate">
                      {displayResidence}
                    </div>
                  </div>
                  <div className="text-right text-[11.5px] text-hv-muted tabular-nums shrink-0">
                    {assetCount} assets · {documentCount} docs
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
                  <div>
                    <dt className="text-hv-muted">Homeowner</dt>
                    <dd className="font-medium text-hv-text truncate mt-0.5">
                      {displayOwner}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-hv-muted">Report Currency</dt>
                    <dd className="font-medium text-hv-text mt-0.5">
                      {settings.currency}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-hv-muted">Contact Email</dt>
                    <dd className="font-medium text-hv-text truncate mt-0.5">
                      {displayEmail || 'Not specified'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="pt-4 border-t border-hv-border flex items-center justify-between text-[12px] text-hv-muted">
              <span>Applies automatically to Insurance & Moving Exports</span>
              <span className="font-medium text-hv-text">Ready</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
