/**
 * SuperAdminEditor.jsx
 * Full map editor for superadmin@spotfinder.cz
 * Tabs: Custom POIs · Road Closures · Nav Overrides
 */
import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, AlertTriangle, Navigation, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getAdminPOIs, addAdminPOI, deleteAdminPOI,
  getAdminClosures, addAdminClosure, deleteAdminClosure,
  getAdminNavOverrides, addAdminNavOverride, deleteAdminNavOverride,
} from '@/api/firebaseClient';

const TABS = [
  { id: 'pois',     label: 'Custom POIs',    Icon: MapPin },
  { id: 'closures', label: 'Road Closures',  Icon: AlertTriangle },
  { id: 'nav',      label: 'Nav Overrides',  Icon: Navigation },
];

const POI_ICONS = ['📍','🏠','🏪','🏥','⛽','🅿️','🎭','🍽️','☕','🏔','🌊','🎪','🏛','🚏','🛒','⚠️','ℹ️','🔧'];
const CLOSURE_ICONS = ['⛔','🚧','⚠️','🚦','🔒','🛑','🚨','🏗️','🔴'];

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-accent text-muted-foreground hover:bg-gray-200 dark:hover:bg-accent/80'}`}>
      {children}
    </button>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-4">{children}</p>;
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground outline-none focus:ring-2 focus:ring-blue-300 resize-none"
    />
  );
}

// ─── Icon picker ──────────────────────────────────────────────────────────────
function IconPicker({ icons, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {icons.map(ic => (
        <button key={ic} onClick={() => onChange(ic)}
          className={`w-9 h-9 text-xl rounded-xl transition-all ${value === ic ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : 'bg-gray-100 dark:bg-accent hover:bg-gray-200 dark:hover:bg-accent/80'}`}>
          {ic}
        </button>
      ))}
    </div>
  );
}

// ─── List item ────────────────────────────────────────────────────────────────
function ListItem({ icon, title, subtitle, onDelete }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 dark:bg-accent/40 rounded-xl p-3 mb-2">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <button onClick={onDelete} className="w-7 h-7 flex-shrink-0 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Custom POIs tab ─────────────────────────────────────────────────────────
function POIsTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('📍');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminPOIs().then(setItems); }, []);

  useEffect(() => {
    if (pendingLatLon) {
      setLat(pendingLatLon.lat.toFixed(6));
      setLon(pendingLatLon.lon.toFixed(6));
    }
  }, [pendingLatLon]);

  const save = async () => {
    if (!name.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminPOI(user, { name: name.trim(), description: desc.trim(), icon, lat: parseFloat(lat), lon: parseFloat(lon) });
      setItems(prev => [item, ...prev]);
      setName(''); setDesc(''); setLat(''); setLon(''); setIcon('📍');
      onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminPOI(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>Add New POI</SectionHead>
      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="e.g. Hidden viewpoint" />
      </Field>
      <Field label="Description (optional)">
        <Textarea value={desc} onChange={setDesc} placeholder="Short description…" />
      </Field>
      <Field label="Icon">
        <IconPicker icons={POI_ICONS} value={icon} onChange={setIcon} />
      </Field>
      <Field label="Location">
        <div className="flex gap-2 mb-2">
          <Input value={lat} onChange={setLat} placeholder="Latitude" type="number" className="flex-1" />
          <Input value={lon} onChange={setLon} placeholder="Longitude" type="number" className="flex-1" />
        </div>
        <button onClick={onRequestMapClick}
          className="w-full py-2 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
          📌 Click on map to pick location
        </button>
      </Field>
      <button onClick={save} disabled={saving || !name.trim() || !lat || !lon}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Add POI'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing POIs ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id} icon={it.icon || '📍'} title={it.name}
              subtitle={`${it.lat?.toFixed(4)}, ${it.lon?.toFixed(4)}`}
              onDelete={() => remove(it.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Road Closures tab ────────────────────────────────────────────────────────
function ClosuresTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('⛔');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminClosures().then(setItems); }, []);

  useEffect(() => {
    if (pendingLatLon) {
      setLat(pendingLatLon.lat.toFixed(6));
      setLon(pendingLatLon.lon.toFixed(6));
    }
  }, [pendingLatLon]);

  const save = async () => {
    if (!label.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminClosure(user, { label: label.trim(), description: desc.trim(), icon, lat: parseFloat(lat), lon: parseFloat(lon), until: until || null });
      setItems(prev => [item, ...prev]);
      setLabel(''); setDesc(''); setLat(''); setLon(''); setUntil(''); setIcon('⛔');
      onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminClosure(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  const isExpired = (cl) => cl.until && new Date(cl.until) < new Date();

  return (
    <div>
      <SectionHead>Add Road Closure</SectionHead>
      <Field label="Label">
        <Input value={label} onChange={setLabel} placeholder="e.g. Road closed for repairs" />
      </Field>
      <Field label="Details (optional)">
        <Textarea value={desc} onChange={setDesc} placeholder="More info…" />
      </Field>
      <Field label="Icon">
        <IconPicker icons={CLOSURE_ICONS} value={icon} onChange={setIcon} />
      </Field>
      <Field label="Active until (optional)">
        <Input value={until} onChange={setUntil} type="date" />
        <p className="text-xs text-muted-foreground mt-1">Leave blank = permanent. Past date = hidden automatically.</p>
      </Field>
      <Field label="Location">
        <div className="flex gap-2 mb-2">
          <Input value={lat} onChange={setLat} placeholder="Latitude" type="number" className="flex-1" />
          <Input value={lon} onChange={setLon} placeholder="Longitude" type="number" className="flex-1" />
        </div>
        <button onClick={onRequestMapClick}
          className="w-full py-2 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
          📌 Click on map to pick location
        </button>
      </Field>
      <button onClick={save} disabled={saving || !label.trim() || !lat || !lon}
        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-orange-600 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Add Closure'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing Closures ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id} icon={it.icon || '⛔'} title={it.label}
              subtitle={[
                isExpired(it) ? '✅ Expired' : it.until ? `Until ${new Date(it.until).toLocaleDateString()}` : 'Permanent',
                it.lat ? `${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}` : '',
              ].filter(Boolean).join(' · ')}
              onDelete={() => remove(it.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Nav Overrides tab ────────────────────────────────────────────────────────
const DIRECTIONS = ['straight','slight_left','left','sharp_left','slight_right','right','sharp_right','u_turn'];
const DIR_LABELS = { straight:'⬆ Straight', slight_left:'↖ Slight Left', left:'← Left', sharp_left:'⤾ Sharp Left', slight_right:'↗ Slight Right', right:'→ Right', sharp_right:'⤿ Sharp Right', u_turn:'↩ U-Turn' };

function NavTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);
  const [road, setRoad] = useState('');
  const [direction, setDirection] = useState('straight');
  const [instruction, setInstruction] = useState('');
  const [towards, setTowards] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('100');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminNavOverrides().then(setItems); }, []);

  useEffect(() => {
    if (pendingLatLon) {
      setLat(pendingLatLon.lat.toFixed(6));
      setLon(pendingLatLon.lon.toFixed(6));
    }
  }, [pendingLatLon]);

  const save = async () => {
    if (!instruction.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminNavOverride(user, {
        road: road.trim(), direction, instruction: instruction.trim(),
        towards: towards.trim(), lat: parseFloat(lat), lon: parseFloat(lon),
        radius: parseFloat(radius) || 100,
      });
      setItems(prev => [item, ...prev]);
      setRoad(''); setInstruction(''); setTowards(''); setLat(''); setLon(''); setRadius('100');
      onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminNavOverride(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>Add Nav Instruction Override</SectionHead>
      <p className="text-xs text-muted-foreground mb-3">Override what the voice says at a specific junction. When the user is within the radius of this point and the direction matches, your instruction is spoken instead.</p>
      <Field label="Road / Junction name (optional)">
        <Input value={road} onChange={setRoad} placeholder="e.g. Plzeň - Stříbro junction" />
      </Field>
      <Field label="Direction">
        <div className="flex flex-wrap gap-1.5">
          {DIRECTIONS.map(d => (
            <button key={d} onClick={() => setDirection(d)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${direction === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-accent text-foreground hover:bg-gray-200 dark:hover:bg-accent/80'}`}>
              {DIR_LABELS[d]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Towards (place name shown on sign)">
        <Input value={towards} onChange={setTowards} placeholder="e.g. Stříbro, Tachov" />
      </Field>
      <Field label="Custom instruction text (spoken)">
        <Input value={instruction} onChange={setInstruction} placeholder="e.g. Turn right towards Stříbro" />
      </Field>
      <Field label="Trigger radius (metres)">
        <Input value={radius} onChange={setRadius} placeholder="100" type="number" />
      </Field>
      <Field label="Location">
        <div className="flex gap-2 mb-2">
          <Input value={lat} onChange={setLat} placeholder="Latitude" type="number" className="flex-1" />
          <Input value={lon} onChange={setLon} placeholder="Longitude" type="number" className="flex-1" />
        </div>
        <button onClick={onRequestMapClick}
          className="w-full py-2 rounded-xl border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
          📌 Click on map to pick location
        </button>
      </Field>
      <button onClick={save} disabled={saving || !instruction.trim() || !lat || !lon}
        className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-green-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Add Override'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing Overrides ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id}
              icon={DIR_LABELS[it.direction]?.split(' ')[0] || '⬆'}
              title={it.instruction}
              subtitle={[it.road, it.towards ? `→ ${it.towards}` : '', it.lat ? `${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}` : ''].filter(Boolean).join(' · ')}
              onDelete={() => remove(it.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export default function SuperAdminEditor({ user, onClose, onAdminDataChange }) {
  const [tab, setTab] = useState('pois');
  const [collapsed, setCollapsed] = useState(false);
  const [pendingLatLon, setPendingLatLon] = useState(null);
  const [adminNavMode, setAdminNavMode] = useState(false);

  // Called by MapLibreMap when in adminNavMode and user clicks map
  const handleMapClick = useCallback((coords) => {
    setPendingLatLon(coords);
    setAdminNavMode(false);
  }, []);

  const requestMapClick = () => {
    setAdminNavMode(true);
    setCollapsed(true); // collapse panel so user can see map
  };

  const clearPending = () => setPendingLatLon(null);

  // Expose handleMapClick and adminNavMode to parent via callback
  useEffect(() => {
    onAdminDataChange?.({ handleMapClick, adminNavMode });
  }, [adminNavMode, handleMapClick]);

  return (
    <div className="fixed left-0 right-0 z-[2000] flex flex-col"
      style={{ bottom: 56, maxHeight: collapsed ? 60 : '80vh' }}>

      {/* Drag handle / header */}
      <div className="mx-auto w-full max-w-md bg-white dark:bg-card rounded-t-3xl shadow-2xl border-t border-gray-100 dark:border-border overflow-hidden flex flex-col"
        style={{ maxHeight: collapsed ? 60 : '80vh' }}>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-border flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-base">🛠️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground leading-tight">Map Editor</p>
            <p className="text-[11px] text-muted-foreground">superadmin@spotfinder.cz</p>
          </div>
          {adminNavMode && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-semibold animate-pulse">
              Click map…
            </span>
          )}
          <button onClick={() => setCollapsed(v => !v)}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center">
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 px-4 py-2 border-b border-gray-100 dark:border-border flex-shrink-0 overflow-x-auto">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${tab === id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-accent text-muted-foreground hover:bg-gray-200 dark:hover:bg-accent/80'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto overscroll-contain flex-1 px-4 py-3">
              {tab === 'pois' && (
                <POIsTab user={user} pendingLatLon={pendingLatLon}
                  onRequestMapClick={requestMapClick} onClear={clearPending} />
              )}
              {tab === 'closures' && (
                <ClosuresTab user={user} pendingLatLon={pendingLatLon}
                  onRequestMapClick={requestMapClick} onClear={clearPending} />
              )}
              {tab === 'nav' && (
                <NavTab user={user} pendingLatLon={pendingLatLon}
                  onRequestMapClick={requestMapClick} onClear={clearPending} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
