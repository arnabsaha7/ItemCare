import { ImagePlus, X } from 'lucide-react';
import { useState } from 'react';
import { APP_BRAND, WARRANTY_TYPES } from '@/src/constants';
import type {
  AssetRecord,
  AssetStatus,
  Category,
  Location,
  UpsertAssetInput,
  WarrantyType,
} from '@/src/types/homevault';
import { addDaysIso, todayIsoDate } from '@/src/utils/format';

interface AssetFormModalProps {
  isOpen: boolean;
  editingAsset: AssetRecord | null;
  categories: Category[];
  locations: Location[];
  onClose: () => void;
  onSave: (input: UpsertAssetInput) => Promise<void>;
}

export function AssetFormModal({
  isOpen,
  editingAsset,
  categories,
  locations,
  onClose,
  onSave,
}: AssetFormModalProps) {
  const [name, setName] = useState(editingAsset?.name ?? '');
  const [categoryName, setCategoryName] = useState(
    editingAsset?.categoryName ?? categories[0]?.name ?? 'Major Appliances'
  );
  const [locationName, setLocationName] = useState(
    editingAsset?.locationName ?? locations[0]?.name ?? 'Living Room'
  );
  const [brand, setBrand] = useState(editingAsset?.brand ?? '');
  const [model, setModel] = useState(editingAsset?.model ?? '');
  const [description, setDescription] = useState(editingAsset?.description ?? '');
  const [status, setStatus] = useState<AssetStatus>(editingAsset?.status ?? 'active');
  const [photoPath, setPhotoPath] = useState<string | null>(editingAsset?.photoPath ?? null);

  // Purchase Info
  const [purchaseDate, setPurchaseDate] = useState(editingAsset?.purchaseDate ?? todayIsoDate());
  const [purchasePrice, setPurchasePrice] = useState(
    editingAsset ? String(editingAsset.purchasePrice) : ''
  );
  const [currency, setCurrency] = useState(editingAsset?.currency ?? 'INR');
  const [retailer, setRetailer] = useState(editingAsset?.retailer ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(editingAsset?.invoiceNumber ?? '');
  const [paymentMethod, setPaymentMethod] = useState(editingAsset?.paymentMethod ?? '');
  const [purchaseNotes, setPurchaseNotes] = useState(editingAsset?.purchaseNotes ?? '');

  // Warranty (creation helper)
  const [warrantyProvider, setWarrantyProvider] = useState('');
  const [warrantyStartDate, setWarrantyStartDate] = useState(todayIsoDate());
  const [warrantyDurationMonths, setWarrantyDurationMonths] = useState('12');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState(addDaysIso(todayIsoDate(), 365));
  const [warrantyType, setWarrantyType] = useState<WarrantyType>('Manufacturer');
  const [warrantyExtendedDetails, setWarrantyExtendedDetails] = useState('');

  // Identification
  const [serialNumber, setSerialNumber] = useState(editingAsset?.serialNumber ?? '');
  const [productId, setProductId] = useState(editingAsset?.productId ?? '');
  const [imei, setImei] = useState(editingAsset?.imei ?? '');
  const [qrBarcode, setQrBarcode] = useState(editingAsset?.qrBarcode ?? '');
  const [serialPhotoPath, setSerialPhotoPath] = useState<string | null>(
    editingAsset?.serialPhotoPath ?? null
  );

  // Maintenance
  const [maintenanceRequired, setMaintenanceRequired] = useState(false);
  const [maintenanceTaskName, setMaintenanceTaskName] = useState('');
  const [maintenanceFrequencyDays, setMaintenanceFrequencyDays] = useState('90');
  const [maintenanceLastServiceDate, setMaintenanceLastServiceDate] = useState('');
  const [maintenanceNextServiceDate, setMaintenanceNextServiceDate] = useState(
    addDaysIso(todayIsoDate(), 90)
  );
  const [maintenanceServiceProvider, setMaintenanceServiceProvider] = useState('');
  const [maintenanceSparePartNumber, setMaintenanceSparePartNumber] = useState('');
  const [maintenanceInstructions, setMaintenanceInstructions] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImagePick = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'photo' | 'serial'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (target === 'photo') setPhotoPath(result);
      else setSerialPhotoPath(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Asset Name is required.');
      return;
    }
    const priceNum = Number(purchasePrice || 0);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setFormError('Enter a valid non-negative Purchase Price.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onSave({
        id: editingAsset?.id,
        name: name.trim(),
        categoryName,
        locationName,
        brand: brand.trim(),
        model: model.trim(),
        description: description.trim(),
        serialNumber: serialNumber.trim(),
        productId: productId.trim(),
        imei: imei.trim(),
        qrBarcode: qrBarcode.trim(),
        status,
        photoPath,
        serialPhotoPath,
        purchaseDate,
        purchasePrice: priceNum,
        currency,
        retailer: retailer.trim(),
        invoiceNumber: invoiceNumber.trim(),
        paymentMethod: paymentMethod.trim(),
        purchaseNotes: purchaseNotes.trim(),
        warrantyProvider: warrantyProvider.trim() || undefined,
        warrantyStartDate,
        warrantyExpiryDate,
        warrantyDurationMonths: Number(warrantyDurationMonths) || 12,
        warrantyType,
        warrantyExtendedDetails: warrantyExtendedDetails.trim() || undefined,
        maintenanceRequired,
        maintenanceTaskName: maintenanceTaskName.trim() || undefined,
        maintenanceFrequencyDays: Number(maintenanceFrequencyDays) || 90,
        maintenanceLastServiceDate: maintenanceLastServiceDate || undefined,
        maintenanceNextServiceDate,
        maintenanceServiceProvider: maintenanceServiceProvider.trim() || undefined,
        maintenanceSparePartNumber: maintenanceSparePartNumber.trim() || undefined,
        maintenanceInstructions: maintenanceInstructions.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save asset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-form-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-hv-card border border-hv-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hv-border flex items-center justify-between">
          <div>
            <h2 id="asset-form-title" className="text-[17px] font-semibold text-hv-text">
              {editingAsset ? `Edit ${editingAsset.name}` : 'Add Household Asset'}
            </h2>
            <p className="text-[12px] text-hv-muted">
              All records are stored locally in your {APP_BRAND.name} database.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-hv-muted hover:bg-hv-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-hv-danger/10 border border-hv-danger/20 text-[12.5px] text-hv-danger">
              {formError}
            </div>
          )}

          {/* BASIC INFORMATION */}
          <section className="space-y-3">
            <h3 className="text-[12px] font-semibold tracking-wide text-hv-accent-fg">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Asset Name *">
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Dyson V15 Detect Cordless"
                  className={inputCls}
                />
              </Field>
              <Field label="Space / Location">
                <select
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className={inputCls}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className={inputCls}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Operational Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="in_repair">In Repair</option>
                  <option value="retired">Retired</option>
                </select>
              </Field>
              <Field label="Brand">
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., Daikin"
                  className={inputCls}
                />
              </Field>
              <Field label="Model">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., FTKM50U"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specifications, finish, or room placement notes..."
                className={inputCls}
              />
            </Field>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hv-border-strong text-[12px] font-medium text-hv-text cursor-pointer hover:bg-hv-elevated">
                <ImagePlus className="w-3.5 h-3.5 text-hv-accent-fg" />
                <span>{photoPath ? 'Change Asset Photo' : 'Attach Asset Photo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleImagePick(e, 'photo')}
                  className="hidden"
                />
              </label>
              {photoPath && (
                <span className="text-[12px] text-hv-success">Photo attached</span>
              )}
            </div>
          </section>

          {/* PURCHASE INFORMATION */}
          <section className="space-y-3 pt-4 border-t border-hv-border">
            <h3 className="text-[12px] font-semibold tracking-wide text-hv-accent-fg">
              Purchase Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Purchase Date">
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Purchase Price">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="44200"
                  className={inputCls}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputCls}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </Field>
              <Field label="Retailer">
                <input
                  type="text"
                  value={retailer}
                  onChange={(e) => setRetailer(e.target.value)}
                  placeholder="Croma Electronics"
                  className={inputCls}
                />
              </Field>
              <Field label="Invoice Number">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="CRM-MUM-81204"
                  className={inputCls}
                />
              </Field>
              <Field label="Payment Method">
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="Credit Card / UPI"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Purchase Notes">
              <input
                type="text"
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="Delivery or installation notes"
                className={inputCls}
              />
            </Field>
          </section>

          {/* IDENTIFICATION */}
          <section className="space-y-3 pt-4 border-t border-hv-border">
            <h3 className="text-[12px] font-semibold tracking-wide text-hv-accent-fg">
              Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Serial Number">
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="DK992841004X"
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="Product ID">
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="DKN-FTKM50U"
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="IMEI (if applicable)">
                <input
                  type="text"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="QR / Barcode">
                <input
                  type="text"
                  value={qrBarcode}
                  onChange={(e) => setQrBarcode(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hv-border-strong text-[12px] font-medium text-hv-text cursor-pointer hover:bg-hv-elevated">
                <ImagePlus className="w-3.5 h-3.5 text-hv-accent-fg" />
                <span>{serialPhotoPath ? 'Change Serial Photo' : 'Attach Serial Label Photo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleImagePick(e, 'serial')}
                  className="hidden"
                />
              </label>
              {serialPhotoPath && (
                <span className="text-[12px] text-hv-success">Serial photo attached</span>
              )}
            </div>
          </section>

          {/* WARRANTY (on creation) */}
          {!editingAsset && (
            <section className="space-y-3 pt-4 border-t border-hv-border">
              <h3 className="text-[12px] font-semibold tracking-wide text-hv-accent-fg">
                Warranty (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Warranty Provider">
                  <input
                    type="text"
                    value={warrantyProvider}
                    onChange={(e) => setWarrantyProvider(e.target.value)}
                    placeholder="e.g., Daikin India"
                    className={inputCls}
                  />
                </Field>
                <Field label="Warranty Start">
                  <input
                    type="date"
                    value={warrantyStartDate}
                    onChange={(e) => setWarrantyStartDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Warranty Expiry">
                  <input
                    type="date"
                    value={warrantyExpiryDate}
                    onChange={(e) => setWarrantyExpiryDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Duration (Months)">
                  <input
                    type="number"
                    value={warrantyDurationMonths}
                    onChange={(e) => setWarrantyDurationMonths(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Warranty Type">
                  <select
                    value={warrantyType}
                    onChange={(e) => setWarrantyType(e.target.value as WarrantyType)}
                    className={inputCls}
                  >
                    {WARRANTY_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {wt}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Extended Details">
                  <input
                    type="text"
                    value={warrantyExtendedDetails}
                    onChange={(e) => setWarrantyExtendedDetails(e.target.value)}
                    placeholder="Compressor / panel terms"
                    className={inputCls}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* MAINTENANCE (on creation) */}
          {!editingAsset && (
            <section className="space-y-3 pt-4 border-t border-hv-border">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold tracking-wide text-hv-accent-fg">
                  Maintenance Schedule
                </h3>
                <label className="inline-flex items-center gap-2 text-[12.5px] font-medium text-hv-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceRequired}
                    onChange={(e) => setMaintenanceRequired(e.target.checked)}
                    className="rounded border-hv-border-strong accent-hv-accent"
                  />
                  <span>Maintenance Required</span>
                </label>
              </div>

              {maintenanceRequired && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Task Name">
                    <input
                      type="text"
                      value={maintenanceTaskName}
                      onChange={(e) => setMaintenanceTaskName(e.target.value)}
                      placeholder="e.g., Clean Mesh & Anti-Dust Filter"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Frequency (Days)">
                    <input
                      type="number"
                      value={maintenanceFrequencyDays}
                      onChange={(e) => setMaintenanceFrequencyDays(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Last Service Date">
                    <input
                      type="date"
                      value={maintenanceLastServiceDate}
                      onChange={(e) => setMaintenanceLastServiceDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Next Service Date">
                    <input
                      type="date"
                      value={maintenanceNextServiceDate}
                      onChange={(e) => setMaintenanceNextServiceDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Service Provider">
                    <input
                      type="text"
                      value={maintenanceServiceProvider}
                      onChange={(e) => setMaintenanceServiceProvider(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Spare Part Number">
                    <input
                      type="text"
                      value={maintenanceSparePartNumber}
                      onChange={(e) => setMaintenanceSparePartNumber(e.target.value)}
                      placeholder="DKN-FLT-50"
                      className={inputCls}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Instructions">
                      <textarea
                        rows={2}
                        value={maintenanceInstructions}
                        onChange={(e) => setMaintenanceInstructions(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-hv-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-hv-muted hover:text-hv-text hover:bg-hv-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover disabled:opacity-60 text-white text-[13px] font-medium transition-colors"
            >
              {submitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Save Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-1.5 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11.5px] font-medium text-hv-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
