import {
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Paintbrush,
  Phone,
  Plus,
  Router,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ElectricalBreaker,
  NetworkSetting,
  PaintRecord,
  PropertySpecsBundle,
  UtilityRecord,
} from '@/src/types/homevault';
import { copyTextNative } from '@/src/services/tauri/bridge';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface PropertySpecsViewProps {
  specs: PropertySpecsBundle;
  onRefresh: () => Promise<void>;
}

export function PropertySpecsView({ specs, onRefresh }: PropertySpecsViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealWifiPass, setRevealWifiPass] = useState(false);

  // Add Paint state
  const [addingPaint, setAddingPaint] = useState(false);
  const [paintForm, setPaintForm] = useState({
    roomName: '',
    brand: '',
    colorName: '',
    hexCode: '#F2EFE9',
    finish: 'Eggshell',
    notes: '',
  });

  // Add Breaker state
  const [addingBreaker, setAddingBreaker] = useState(false);
  const [breakerForm, setBreakerForm] = useState({
    breakerNumber: '',
    circuitLabel: '',
    amperage: '16A',
    zone: 'Main DB',
    notes: '',
  });

  // Edit Network state
  const primaryNet: NetworkSetting | undefined = specs.network[0];
  const [editingNet, setEditingNet] = useState(false);
  const [netForm, setNetForm] = useState({
    routerName: primaryNet?.routerName ?? '',
    model: primaryNet?.model ?? '',
    ssid: primaryNet?.ssid ?? '',
    encryptedPassword: primaryNet?.encryptedPassword ?? '',
    ipAddress: primaryNet?.ipAddress ?? '192.168.1.1',
    notes: primaryNet?.notes ?? '',
  });

  // Add Utility state
  const [addingUtility, setAddingUtility] = useState(false);
  const [utilForm, setUtilForm] = useState({
    serviceType: '',
    providerName: '',
    accountNumber: '',
    supportContact: '',
    vendorPhone: '',
    notes: '',
  });

  const handleCopy = async (key: string, value: string) => {
    await copyTextNative(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleAddPaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paintForm.roomName.trim() || !paintForm.brand.trim()) return;
    await homeVaultService.upsertPaintRecord(paintForm);
    setPaintForm({ roomName: '', brand: '', colorName: '', hexCode: '#F2EFE9', finish: 'Eggshell', notes: '' });
    setAddingPaint(false);
    await onRefresh();
  };

  const handleAddBreaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakerForm.breakerNumber.trim() || !breakerForm.circuitLabel.trim()) return;
    await homeVaultService.upsertElectricalBreaker(breakerForm);
    setBreakerForm({ breakerNumber: '', circuitLabel: '', amperage: '16A', zone: 'Main DB', notes: '' });
    setAddingBreaker(false);
    await onRefresh();
  };

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    await homeVaultService.upsertNetworkSetting({
      id: primaryNet?.id,
      ...netForm,
    });
    setEditingNet(false);
    await onRefresh();
  };

  const handleAddUtility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utilForm.providerName.trim()) return;
    await homeVaultService.upsertUtilityRecord(utilForm);
    setUtilForm({ serviceType: '', providerName: '', accountNumber: '', supportContact: '', vendorPhone: '', notes: '' });
    setAddingUtility(false);
    await onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
          Property Specs
        </h1>
        <p className="text-[13px] text-hv-muted mt-0.5">
          Paint codes, electrical breaker schedules, home network credentials, and utility vendor contacts.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* PAINT RECORDS */}
        <section className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-hv-accent-fg" />
              <h2 className="text-[15px] font-semibold text-hv-text">
                Paint Records
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAddingPaint((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-hv-accent-fg hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Room Paint</span>
            </button>
          </div>

          {addingPaint && (
            <form onSubmit={(e) => void handleAddPaint(e)} className="p-3.5 rounded-lg bg-hv-subtle border border-hv-border grid grid-cols-2 gap-2.5">
              <input
                required
                placeholder="Room (e.g., Study)"
                value={paintForm.roomName}
                onChange={(e) => setPaintForm({ ...paintForm, roomName: e.target.value })}
                className={inputCls}
              />
              <input
                required
                placeholder="Brand (e.g., Asian Paints)"
                value={paintForm.brand}
                onChange={(e) => setPaintForm({ ...paintForm, brand: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Shade Name"
                value={paintForm.colorName}
                onChange={(e) => setPaintForm({ ...paintForm, colorName: e.target.value })}
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={paintForm.hexCode}
                  onChange={(e) => setPaintForm({ ...paintForm, hexCode: e.target.value.toUpperCase() })}
                  className="h-8 w-10 rounded border border-hv-border-strong bg-transparent cursor-pointer"
                />
                <input
                  value={paintForm.hexCode}
                  onChange={(e) => setPaintForm({ ...paintForm, hexCode: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <input
                placeholder="Finish (Eggshell / Matte)"
                value={paintForm.finish}
                onChange={(e) => setPaintForm({ ...paintForm, finish: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Notes"
                value={paintForm.notes}
                onChange={(e) => setPaintForm({ ...paintForm, notes: e.target.value })}
                className={inputCls}
              />
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAddingPaint(false)} className="px-3 py-1 text-[12px] text-hv-muted hover:text-hv-text">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 rounded-md bg-hv-accent hover:bg-hv-accent-hover text-white text-[12px] font-medium">
                  Save Paint
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-hv-border">
            {specs.paintRecords.map((p: PaintRecord) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg border border-hv-border-strong shrink-0"
                    style={{ backgroundColor: p.hexCode }}
                    title={p.hexCode}
                  />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-hv-text">
                      {p.roomName}
                    </div>
                    <div className="text-[12px] text-hv-muted truncate">
                      {p.brand} · {p.finish} {p.colorName ? `· ${p.colorName}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopy(`hex-${p.id}`, p.hexCode)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-hv-elevated text-[12px] font-mono text-hv-text hover:bg-hv-hover"
                  >
                    {copiedKey === `hex-${p.id}` ? (
                      <Check className="w-3 h-3 text-hv-success" />
                    ) : (
                      <Copy className="w-3 h-3 text-hv-muted" />
                    )}
                    <span>{p.hexCode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void homeVaultService.deletePaintRecord(p.id).then(onRefresh)}
                    title="Delete paint record"
                    className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ELECTRICAL BREAKER MAP */}
        <section className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-hv-warning" />
              <h2 className="text-[15px] font-semibold text-hv-text">
                Electrical Breaker Map
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAddingBreaker((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-hv-accent-fg hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Circuit</span>
            </button>
          </div>

          {addingBreaker && (
            <form onSubmit={(e) => void handleAddBreaker(e)} className="p-3.5 rounded-lg bg-hv-subtle border border-hv-border grid grid-cols-2 gap-2.5">
              <input
                required
                placeholder="Breaker # (e.g., 04)"
                value={breakerForm.breakerNumber}
                onChange={(e) => setBreakerForm({ ...breakerForm, breakerNumber: e.target.value })}
                className={inputCls}
              />
              <input
                required
                placeholder="Amperage (e.g., 20A)"
                value={breakerForm.amperage}
                onChange={(e) => setBreakerForm({ ...breakerForm, amperage: e.target.value })}
                className={inputCls}
              />
              <input
                required
                placeholder="Circuit Label"
                value={breakerForm.circuitLabel}
                onChange={(e) => setBreakerForm({ ...breakerForm, circuitLabel: e.target.value })}
                className={`col-span-2 ${inputCls}`}
              />
              <input
                placeholder="Panel Zone"
                value={breakerForm.zone}
                onChange={(e) => setBreakerForm({ ...breakerForm, zone: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Notes"
                value={breakerForm.notes}
                onChange={(e) => setBreakerForm({ ...breakerForm, notes: e.target.value })}
                className={inputCls}
              />
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAddingBreaker(false)} className="px-3 py-1 text-[12px] text-hv-muted hover:text-hv-text">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 rounded-md bg-hv-accent hover:bg-hv-accent-hover text-white text-[12px] font-medium">
                  Save Circuit
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-hv-border">
            {specs.breakers.map((b: ElectricalBreaker) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-hv-text">
                    {b.breakerNumber}. {b.circuitLabel}
                  </div>
                  <div className="text-[12px] text-hv-muted">
                    {b.zone} {b.notes ? `· ${b.notes}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[12.5px] font-semibold text-hv-text tabular-nums">
                    {b.amperage}
                  </span>
                  <button
                    type="button"
                    onClick={() => void homeVaultService.deleteElectricalBreaker(b.id).then(onRefresh)}
                    title="Delete breaker"
                    className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HOME NETWORK */}
        <section className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Router className="w-4 h-4 text-hv-info" />
              <h2 className="text-[15px] font-semibold text-hv-text">
                Home Network
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                if (primaryNet) {
                  setNetForm({
                    routerName: primaryNet.routerName,
                    model: primaryNet.model,
                    ssid: primaryNet.ssid,
                    encryptedPassword: primaryNet.encryptedPassword,
                    ipAddress: primaryNet.ipAddress,
                    notes: primaryNet.notes,
                  });
                }
                setEditingNet((v) => !v);
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-hv-accent-fg hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingNet ? 'Close' : 'Edit Network'}</span>
            </button>
          </div>

          {editingNet ? (
            <form onSubmit={(e) => void handleSaveNetwork(e)} className="grid grid-cols-2 gap-2.5">
              <input
                placeholder="Router Name"
                value={netForm.routerName}
                onChange={(e) => setNetForm({ ...netForm, routerName: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Model"
                value={netForm.model}
                onChange={(e) => setNetForm({ ...netForm, model: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Wi-Fi SSID"
                value={netForm.ssid}
                onChange={(e) => setNetForm({ ...netForm, ssid: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Wi-Fi Password"
                value={netForm.encryptedPassword}
                onChange={(e) => setNetForm({ ...netForm, encryptedPassword: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Gateway IP"
                value={netForm.ipAddress}
                onChange={(e) => setNetForm({ ...netForm, ipAddress: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Notes"
                value={netForm.notes}
                onChange={(e) => setNetForm({ ...netForm, notes: e.target.value })}
                className={inputCls}
              />
              <div className="col-span-2 flex justify-end gap-2 pt-1">
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12.5px] font-medium">
                  Save Network Settings
                </button>
              </div>
            </form>
          ) : primaryNet ? (
            <div className="space-y-3">
              <dl className="divide-y divide-hv-border text-[13px]">
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-hv-muted">Router Name</dt>
                  <dd className="font-medium text-hv-text">{primaryNet.routerName}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-hv-muted">Model</dt>
                  <dd className="font-medium text-hv-text">{primaryNet.model}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-hv-muted">Wi-Fi SSID</dt>
                  <dd className="font-mono text-[12.5px] text-hv-text">{primaryNet.ssid}</dd>
                </div>
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Password</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="font-mono text-[12.5px] text-hv-text">
                      {revealWifiPass ? primaryNet.encryptedPassword : '••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealWifiPass((v) => !v)}
                      title={revealWifiPass ? 'Hide password' : 'Reveal password'}
                      className="p-1 rounded hover:bg-hv-elevated text-hv-muted"
                    >
                      {revealWifiPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() =>
                  void handleCopy(
                    'wifi-creds',
                    `SSID: ${primaryNet.ssid}\nPassword: ${primaryNet.encryptedPassword}`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hv-elevated hover:bg-hv-hover text-[12px] font-medium text-hv-text"
              >
                {copiedKey === 'wifi-creds' ? (
                  <Check className="w-3.5 h-3.5 text-hv-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-hv-muted" />
                )}
                <span>{copiedKey === 'wifi-creds' ? 'Credentials Copied' : 'Copy Credentials'}</span>
              </button>
            </div>
          ) : null}
        </section>

        {/* UTILITIES */}
        <section className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-hv-success" />
              <h2 className="text-[15px] font-semibold text-hv-text">
                Utilities & Vendors
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAddingUtility((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-hv-accent-fg hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Utility</span>
            </button>
          </div>

          {addingUtility && (
            <form onSubmit={(e) => void handleAddUtility(e)} className="p-3.5 rounded-lg bg-hv-subtle border border-hv-border grid grid-cols-2 gap-2.5">
              <input
                required
                placeholder="Service Type (e.g., ISP Provider)"
                value={utilForm.serviceType}
                onChange={(e) => setUtilForm({ ...utilForm, serviceType: e.target.value })}
                className={inputCls}
              />
              <input
                required
                placeholder="Provider / Vendor Name"
                value={utilForm.providerName}
                onChange={(e) => setUtilForm({ ...utilForm, providerName: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Account Number"
                value={utilForm.accountNumber}
                onChange={(e) => setUtilForm({ ...utilForm, accountNumber: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Support Contact / Email"
                value={utilForm.supportContact}
                onChange={(e) => setUtilForm({ ...utilForm, supportContact: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Vendor Phone"
                value={utilForm.vendorPhone}
                onChange={(e) => setUtilForm({ ...utilForm, vendorPhone: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Notes"
                value={utilForm.notes}
                onChange={(e) => setUtilForm({ ...utilForm, notes: e.target.value })}
                className={inputCls}
              />
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAddingUtility(false)} className="px-3 py-1 text-[12px] text-hv-muted hover:text-hv-text">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 rounded-md bg-hv-accent hover:bg-hv-accent-hover text-white text-[12px] font-medium">
                  Save Utility
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-hv-border">
            {specs.utilities.map((u: UtilityRecord) => (
              <div key={u.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium text-hv-muted">
                    {u.serviceType}
                  </div>
                  <div className="text-[13.5px] font-semibold text-hv-text">
                    {u.providerName}
                  </div>
                  <div className="text-[12px] text-hv-muted mt-0.5 tabular-nums">
                    Acct: <span className="font-mono text-hv-text">{u.accountNumber || '—'}</span> · {u.vendorPhone || u.supportContact}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void homeVaultService.deleteUtilityRecord(u.id).then(onRefresh)}
                  title="Delete utility record"
                  className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent';
