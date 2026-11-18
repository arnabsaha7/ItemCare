import {
  Building2,
  Car,
  ChevronRight,
  Clock,
  FolderLock,
  Laptop,
  Layers,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sofa,
  Sparkles,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { NavSection, SidebarGroupsConfig, SmartViewType } from '@/src/types/homevault';

interface SidebarProps {
  activeSection: NavSection;
  activeSmartView: SmartViewType;
  activeRoomFilter: string | null;
  onSelectSmartView: (view: SmartViewType) => void;
  onSelectSection: (section: NavSection) => void;
  onSelectRoom: (roomName: string) => void;
  counts: {
    all: number;
    expiring: number;
    maintenanceDue: number;
    inRepair: number;
    roomCounts: Map<string, number>;
  };
  ownerName: string;
  residenceName: string;
  ownerEmail: string;
  sidebarGroups: SidebarGroupsConfig;
}

export function Sidebar({
  activeSection,
  activeSmartView,
  activeRoomFilter,
  onSelectSmartView,
  onSelectSection,
  onSelectRoom,
  counts,
  ownerName,
  residenceName,
  ownerEmail,
  sidebarGroups,
}: SidebarProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const popoverWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (popoverWrapRef.current && !popoverWrapRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const mainSpaces = [
    { name: 'Living Room', icon: Sofa },
    { name: 'Kitchen', icon: UtensilsCrossed },
    { name: 'Master Bedroom', icon: Layers },
    { name: 'Utility & Garage', icon: Wrench },
  ];

  const otherSpaces = [
    { name: 'Vehicles', icon: Car },
    { name: 'Everyday Carry', icon: Laptop },
  ];

  const isSmartActive = (view: SmartViewType) =>
    activeSection === 'assets' && !activeRoomFilter && activeSmartView === view;

  const isSettingsGroupActive =
    activeSection === 'settings' || activeSection === 'backups' || activeSection === 'about';

  const displayOwnerName = ownerName?.trim() || 'Arnab';
  const displayResidenceName = residenceName?.trim() || 'Main Residence';

  const initials = displayOwnerName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navigateAndClose = (section: NavSection) => {
    onSelectSection(section);
    setProfileMenuOpen(false);
  };

  return (
    <aside className="w-[240px] shrink-0 h-full flex flex-col bg-hv-sidebar border-r border-hv-border select-none">
      {/* Scrollable Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-2.5 pt-3 space-y-5 pb-3"
        aria-label="Primary navigation"
      >
        {/* SMART VIEWS */}
        {sidebarGroups.smartViews && (
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-hv-muted">
              Smart Views
            </div>
            <div className="space-y-0.5">
              <NavItem
                active={isSmartActive('all')}
                onClick={() => onSelectSmartView('all')}
                icon={Layers}
                label="All Assets"
                count={counts.all}
              />
              <NavItem
                active={isSmartActive('expiring')}
                onClick={() => onSelectSmartView('expiring')}
                icon={ShieldAlert}
                label="Expiring Soon"
                count={counts.expiring}
                accentCount={counts.expiring > 0 ? 'warning' : undefined}
              />
              <NavItem
                active={isSmartActive('maintenance_due')}
                onClick={() => onSelectSmartView('maintenance_due')}
                icon={Wrench}
                label="Maintenance Due"
                count={counts.maintenanceDue}
                accentCount={counts.maintenanceDue > 0 ? 'warning' : undefined}
              />
              <NavItem
                active={isSmartActive('in_repair')}
                onClick={() => onSelectSmartView('in_repair')}
                icon={Clock}
                label="In Repair"
                count={counts.inRepair}
              />
              <NavItem
                active={isSmartActive('recent')}
                onClick={() => onSelectSmartView('recent')}
                icon={Sparkles}
                label="Recently Added"
              />
            </div>
          </div>
        )}

        {/* PROPERTY & CENTERS */}
        {sidebarGroups.propertyOperations && (
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-hv-muted">
              Property & Operations
            </div>
            <div className="space-y-0.5">
              <NavItem
                active={activeSection === 'property'}
                onClick={() => onSelectSection('property')}
                icon={Building2}
                label="Property Specs"
              />
              <NavItem
                active={activeSection === 'vault'}
                onClick={() => onSelectSection('vault')}
                icon={FolderLock}
                label="Documents & Vault"
              />
              <NavItem
                active={activeSection === 'warranties'}
                onClick={() => onSelectSection('warranties')}
                icon={ShieldCheck}
                label="Insurance & Valuation"
              />
              <NavItem
                active={activeSection === 'maintenance'}
                onClick={() => onSelectSection('maintenance')}
                icon={Wrench}
                label="Maintenance Center"
              />
            </div>
          </div>
        )}

        {/* SPACES */}
        {(sidebarGroups.mainSpaces || sidebarGroups.otherCategories) && (
          <div>
            {sidebarGroups.mainSpaces && (
              <div>
                <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-hv-muted">
                  Spaces · Main Residence
                </div>
                <div className="space-y-0.5">
                  {mainSpaces.map((space) => (
                    <NavItem
                      key={space.name}
                      active={activeSection === 'assets' && activeRoomFilter === space.name}
                      onClick={() => onSelectRoom(space.name)}
                      icon={space.icon}
                      label={space.name}
                      count={counts.roomCounts.get(space.name) ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {sidebarGroups.otherCategories && (
              <div className={sidebarGroups.mainSpaces ? 'pt-3' : ''}>
                <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-hv-muted">
                  Other Categories
                </div>
                <div className="space-y-0.5">
                  {otherSpaces.map((space) => (
                    <NavItem
                      key={space.name}
                      active={activeSection === 'assets' && activeRoomFilter === space.name}
                      onClick={() => onSelectRoom(space.name)}
                      icon={space.icon}
                      label={space.name}
                      count={counts.roomCounts.get(space.name) ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!sidebarGroups.smartViews &&
          !sidebarGroups.propertyOperations &&
          !sidebarGroups.mainSpaces &&
          !sidebarGroups.otherCategories && (
            <div className="space-y-2">
              <NavItem
                active={isSmartActive('all')}
                onClick={() => onSelectSmartView('all')}
                icon={Layers}
                label="All Assets"
                count={counts.all}
              />
              <p className="px-2.5 text-[11.5px] text-hv-muted leading-relaxed">
                Sidebar groups are hidden. Re-enable them anytime in Settings → Sidebar.
              </p>
            </div>
          )}
      </nav>

      {/* Bottom Profile Anchor + Floating Popover Menu */}
      <div
        ref={popoverWrapRef}
        className="relative px-2.5 py-2 border-t border-hv-border"
      >
        {profileMenuOpen && (
          <div
            role="menu"
            aria-label="Account and settings menu"
            className="absolute bottom-full left-2 right-2 mb-2 z-40 rounded-2xl bg-hv-card border border-hv-border-strong shadow-[0_14px_36px_rgba(15,23,42,0.14)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.48)] p-1.5"
          >
            {/* Profile Header Row -> Opens Profile Page */}
            <button
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose('profile')}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left ${
                activeSection === 'profile'
                  ? 'bg-hv-accent-fg/10'
                  : 'hover:bg-hv-hover'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-full bg-hv-accent text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-hv-text leading-tight truncate">
                    {displayOwnerName}
                  </span>
                  <span className="block text-[11px] text-hv-muted leading-tight truncate">
                    {ownerEmail || displayResidenceName}
                  </span>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-hv-muted shrink-0" />
            </button>

            <div className="my-1.5 border-t border-hv-border" />

            {/* Settings Row -> Opens Settings Page */}
            <button
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose('settings')}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] transition-colors ${
                isSettingsGroupActive
                  ? 'bg-hv-accent-fg/10 text-hv-accent-fg font-semibold'
                  : 'text-hv-text hover:bg-hv-hover font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Settings
                  className={`w-4 h-4 shrink-0 ${
                    isSettingsGroupActive
                      ? 'text-hv-accent-fg'
                      : 'text-hv-muted'
                  }`}
                />
                <span className="truncate">Settings</span>
              </span>
              <ChevronRight className="w-4 h-4 text-hv-muted shrink-0" />
            </button>
          </div>
        )}

        {/* Bottom Profile Trigger Button */}
        <button
          type="button"
          onClick={() => setProfileMenuOpen((v) => !v)}
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
            profileMenuOpen || activeSection === 'profile' || isSettingsGroupActive
              ? 'bg-hv-accent-fg/12 text-hv-text'
              : 'hover:bg-hv-hover text-hv-text'
          }`}
        >
          <span className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-7 h-7 rounded-full bg-hv-accent text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span
                className={`block text-[13px] font-semibold leading-tight truncate ${
                  profileMenuOpen
                    ? 'text-hv-accent-fg'
                    : 'text-hv-text'
                }`}
              >
                {displayOwnerName}
              </span>
              <span className="block text-[11px] text-hv-muted leading-tight truncate">
                {displayResidenceName}
              </span>
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  accentCount,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  accentCount?: 'warning';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
        active
          ? 'bg-hv-card text-hv-text font-semibold shadow-2xs border border-hv-border'
          : 'text-hv-text/85 hover:bg-hv-hover font-medium border border-transparent'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <Icon
          className={`w-4 h-4 shrink-0 ${
            active ? 'text-hv-accent-fg' : 'text-hv-muted'
          }`}
        />
        <span className="truncate">{label}</span>
      </span>
      {typeof count === 'number' && (
        <span
          className={`text-[11.5px] tabular-nums shrink-0 ${
            accentCount === 'warning'
              ? 'text-hv-warning font-semibold'
              : 'text-hv-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
