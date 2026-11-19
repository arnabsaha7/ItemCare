import assert from 'node:assert/strict';
import {
  buildStructuredRelativePath,
  DEFAULT_SETTINGS,
  getToggledTheme,
  isDarkTheme,
  normalizeSettings,
  normalizeTheme,
  THEME_PRESETS,
  type AppTheme,
} from '../src/types/homevault';
import { evaluateWarranty, formatINR, addDaysIso, todayIsoDate } from '../src/utils/format';

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 1. normalizeSettings handles incomplete storage safely
const incomplete = normalizeSettings({ theme: 'dark', warrantyAlertDays: 5 });
assert.equal(incomplete.theme, 'dark');
assert.equal(incomplete.ownerName, DEFAULT_SETTINGS.ownerName);
assert.equal(incomplete.residenceName, DEFAULT_SETTINGS.residenceName);
assert.equal(incomplete.onboardingCompleted, false);
assert.equal(incomplete.storagePath, '');
assert.equal(incomplete.warrantyAlertDays, 30); // out-of-range (<7) falls back to 30
assert.deepEqual(incomplete.sidebarGroups, DEFAULT_SETTINGS.sidebarGroups);

// 2. normalizeSettings trims strings and preserves onboarding/storage settings
const partial = normalizeSettings({
  ownerName: '   ',
  warrantyAlertDays: 45,
  storagePath: '  D:\\ItemCare\\VaultFiles  ',
  onboardingCompleted: true,
  sidebarGroups: { smartViews: false } as typeof DEFAULT_SETTINGS.sidebarGroups,
});
assert.equal(partial.ownerName, DEFAULT_SETTINGS.ownerName);
assert.equal(partial.warrantyAlertDays, 45);
assert.equal(partial.storagePath, 'D:\\ItemCare\\VaultFiles');
assert.equal(partial.onboardingCompleted, true);
assert.equal(partial.sidebarGroups.smartViews, false);
assert.equal(partial.sidebarGroups.propertyOperations, true);

// 3. Theme normalization & 6-theme catalog checks (3 light, 3 dark, ItemCare Signature in both)
const allThemes: AppTheme[] = [
  'light',
  'warm-linen',
  'nordic-sage',
  'dark',
  'midnight-navy',
  'warm-espresso',
];
for (const id of allThemes) {
  assert.equal(normalizeTheme(id), id);
  assert.equal(normalizeSettings({ theme: id }).theme, id);
}
assert.equal(normalizeTheme('signature-light'), 'light');
assert.equal(normalizeTheme('signature-dark'), 'dark');
assert.equal(normalizeTheme('unknown-theme'), 'light');
assert.equal(normalizeTheme(null), 'light');

const lightThemes = THEME_PRESETS.filter((p) => p.mode === 'light');
const darkThemes = THEME_PRESETS.filter((p) => p.mode === 'dark');
assert.equal(lightThemes.length, 3);
assert.equal(darkThemes.length, 3);
assert.ok(lightThemes.some((p) => p.id === 'light' && p.name === 'ItemCare Signature'));
assert.ok(darkThemes.some((p) => p.id === 'dark' && p.name === 'ItemCare Signature'));
assert.equal(isDarkTheme('light'), false);
assert.equal(isDarkTheme('dark'), true);
assert.equal(isDarkTheme('midnight-navy'), true);
assert.equal(getToggledTheme('light'), 'dark');
assert.equal(getToggledTheme('dark'), 'light');

// 4. WCAG AA (>= 4.5:1) contrast checks across all 6 theme palettes
for (const preset of THEME_PRESETS) {
  const { palette: p } = preset;
  const surfaces: Array<[string, string]> = [
    ['bg', p.bg],
    ['sidebar', p.sidebar],
    ['card', p.card],
    ['subtle', p.subtle],
    ['elevated', p.elevated],
  ];

  for (const [surfaceName, surfaceHex] of surfaces) {
    const primaryRatio = contrastRatio(p.textPrimary, surfaceHex);
    assert.ok(
      primaryRatio >= 4.5,
      `${preset.id}: textPrimary on ${surfaceName} (${primaryRatio.toFixed(2)}:1) < 4.5:1`
    );
    const mutedRatio = contrastRatio(p.textSecondary, surfaceHex);
    assert.ok(
      mutedRatio >= 4.5,
      `${preset.id}: textSecondary on ${surfaceName} (${mutedRatio.toFixed(2)}:1) < 4.5:1`
    );
  }

  for (const [surfaceName, surfaceHex] of surfaces.slice(0, 4)) {
    const accentFgRatio = contrastRatio(p.accentFg, surfaceHex);
    assert.ok(
      accentFgRatio >= 4.5,
      `${preset.id}: accentFg on ${surfaceName} (${accentFgRatio.toFixed(2)}:1) < 4.5:1`
    );
  }

  for (const [fillName, fillHex] of [
    ['accent', p.accent],
    ['accentHover', p.accentHover],
  ] as const) {
    const whiteRatio = contrastRatio('#FFFFFF', fillHex);
    assert.ok(
      whiteRatio >= 4.5,
      `${preset.id}: #FFFFFF on ${fillName} (${whiteRatio.toFixed(2)}:1) < 4.5:1`
    );
  }

  for (const [surfaceName, surfaceHex] of [
    ['bg', p.bg],
    ['card', p.card],
    ['subtle', p.subtle],
  ] as const) {
    for (const [semanticName, semanticHex] of [
      ['success', p.success],
      ['warning', p.warning],
      ['danger', p.danger],
      ['info', p.info],
    ] as const) {
      const ratio = contrastRatio(semanticHex, surfaceHex);
      assert.ok(
        ratio >= 4.5,
        `${preset.id}: ${semanticName} on ${surfaceName} (${ratio.toFixed(2)}:1) < 4.5:1`
      );
    }
  }
}

for (const btnHex of ['#166534', '#B45309', '#B91C1C']) {
  const btnRatio = contrastRatio('#FFFFFF', btnHex);
  assert.ok(btnRatio >= 4.5, `semantic button #FFFFFF on ${btnHex} (${btnRatio.toFixed(2)}:1) < 4.5:1`);
}

// 5. buildStructuredRelativePath enforces clean Category/Year hierarchy & sanitizes filenames
const rel = buildStructuredRelativePath('Warranty Certificates', 'ac/slip?.pdf', 'abcdef123456', 2026);
assert.equal(rel, 'Documents/Warranty Certificates/2026/abcdef12_ac_slip_.pdf');

// 6. evaluateWarranty respects custom threshold
const soon = evaluateWarranty(
  {
    id: 'w1',
    assetId: 'a1',
    provider: 'Daikin',
    warrantyType: 'Manufacturer',
    startDate: todayIsoDate(),
    expiryDate: addDaysIso(todayIsoDate(), 10),
    durationMonths: 12,
    extendedDetails: '',
    createdAt: '',
    updatedAt: '',
  },
  15
);
assert.equal(soon.health, 'expiring_soon');

// 7. formatINR handles NaN/Infinity safely
assert.equal(formatINR(Number.NaN).includes('0'), true);

console.log('selfcheck passed');