/**
 * SuperAdminEditor.jsx
 * Full map editor for superadmin@spotfinder.cz
 * Tabs: Custom POIs · Road Closures · Nav Overrides · Road Editor · E-Routes
 */
import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, AlertTriangle, Navigation, Trash2, ChevronDown, ChevronUp, Pencil, Check, Ban } from 'lucide-react';
import {
  getAdminPOIs, addAdminPOI, updateAdminPOI, deleteAdminPOI,
  getAdminClosures, addAdminClosure, deleteAdminClosure,
  getAdminNavOverrides, addAdminNavOverride, deleteAdminNavOverride,
  getAdminRoadOverrides, addAdminRoadOverride, deleteAdminRoadOverride,
  getAdminERouteOverrides, addAdminERouteOverride, deleteAdminERouteOverride,
  getDeletedAmbientPOIs, removeDeletedAmbientPOI,
} from '@/api/firebaseClient';
// Category options for the POI dropdown — keys match AMBIENT_CATEGORIES keys in ambientCategories.js
const CATEGORY_OPTIONS = [
  { key: 'restaurant',  label: 'Restaurant',     icon: '🍽️', color: '#E74C3C' },
  { key: 'cafe',        label: 'Cafe',           icon: '☕', color: '#8B4513' },
  { key: 'bar',         label: 'Bar',            icon: '🍺', color: '#D68910' },
  { key: 'supermarket', label: 'Supermarket',    icon: '🏪', color: '#27AE60' },
  { key: 'bakery',      label: 'Bakery',         icon: '🥖', color: '#D4A574' },
  { key: 'hotel',       label: 'Hotel',          icon: '🏨', color: '#2980B9' },
  { key: 'museum',      label: 'Museum',         icon: '🏛️', color: '#34495E' },
  { key: 'heritage',    label: 'Castle/Heritage',icon: '🏰', color: '#95A5A6' },
  { key: 'hospital',    label: 'Hospital',       icon: '🏥', color: '#C0392B' },
  { key: 'pharmacy',    label: 'Pharmacy',       icon: '💊', color: '#E67E22' },
  { key: 'bank',        label: 'Bank',           icon: '🏦', color: '#F39C12' },
  { key: 'atm',         label: 'ATM',            icon: '💳', color: '#16A085' },
  { key: 'parking',     label: 'Parking',        icon: '🅿️', color: '#3498DB' },
  { key: 'fuel',        label: 'Gas Station',    icon: '⛽', color: '#E74C3C' },
  { key: 'charging',    label: 'EV Charging',    icon: '🔌', color: '#27AE60' },
  { key: 'train',       label: 'Train Station',  icon: '🚆', color: '#34495E' },
  { key: 'school',      label: 'School',         icon: '🏫', color: '#4A90E2' },
  { key: 'shop',        label: 'Shop',           icon: '🛍️', color: '#9B59B6' },
  { key: 'police',      label: 'Police',         icon: '👮', color: '#2C3E50' },
  { key: 'fire',        label: 'Fire Station',   icon: '🚒', color: '#E74C3C' },
  { key: 'dentist',     label: 'Dentist',        icon: '🦷', color: '#16A085' },
  { key: 'vet',         label: 'Veterinary',     icon: '🐾', color: '#27AE60' },
  { key: 'gym',         label: 'Gym',            icon: '💪', color: '#E74C3C' },
  { key: 'cinema',      label: 'Cinema',         icon: '🎬', color: '#9B59B6' },
  { key: 'library',     label: 'Library',        icon: '📚', color: '#8E44AD' },
  { key: 'church',      label: 'Church',         icon: '⛪', color: '#7F8C8D' },
  { key: 'playground',  label: 'Playground',     icon: '🎮', color: '#F1C40F' },
  { key: 'post',        label: 'Post Office',    icon: '📮', color: '#F39C12' },
  { key: 'carservice',  label: 'Car Service',    icon: '🔧', color: '#E67E22' },
  { key: 'toilet',      label: 'Toilet',         icon: '🚻', color: '#3498DB' },
  { key: 'busstop',     label: 'Bus Stop',       icon: '🚌', color: '#F39C12' },
  { key: 'speedcamera', label: 'Speed Camera',   icon: '📷', color: '#C0392B' },
  { key: 'viewpoint',   label: 'Viewpoint',      icon: '🏔️', color: '#16A085' },
  { key: 'custom',      label: 'Other / Custom', icon: '📍', color: '#6B7280' },
];

const TABS = [
  { id: 'pois',     label: 'Custom POIs',   Icon: MapPin },
  { id: 'closures', label: 'Road Closures', Icon: AlertTriangle },
  { id: 'nav',      label: 'Nav Overrides', Icon: Navigation },
  { id: 'roads',    label: 'Road Numbers',  Icon: AlertTriangle },
  { id: 'eroutes',  label: 'E-Routes',      Icon: Navigation },
  { id: 'blocked',  label: 'Blocked POIs',  Icon: Ban },
];

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

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground outline-none focus:ring-2 focus:ring-blue-300"
    >
      {children}
    </select>
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
function ListItem({ icon, title, subtitle, onDelete, onEdit }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 dark:bg-accent/40 rounded-xl p-3 mb-2">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="w-7 h-7 flex-shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onDelete} className="w-7 h-7 flex-shrink-0 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── POI form fields (shared between add and edit) ────────────────────────────
function POIForm({ name, setName, desc, setDesc, category, setCategory, lat, setLat, lon, setLon,
  street, setStreet, houseNumber, setHouseNumber, city, setCity, postcode, setPostcode,
  customIcon, setCustomIcon, customColor, setCustomColor,
  onRequestMapClick, saving, onSave, saveLabel }) {
  const selectedCat = CATEGORY_OPTIONS.find(c => c.key === category) || CATEGORY_OPTIONS[0];
  const effectiveIcon = customIcon || selectedCat.icon;
  const effectiveColor = customColor || selectedCat.color;
  return (
    <>
      <Field label="Category">
        <Select value={category} onChange={setCategory}>
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.icon} {opt.label}</option>
          ))}
        </Select>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: effectiveColor }}>
            {effectiveIcon}
          </div>
          <span className="text-xs text-muted-foreground">{selectedCat.label} — {effectiveColor}</span>
        </div>
      </Field>
      <Field label="Custom Icon (emoji, optional — overrides category icon)">
        <div className="flex gap-2 items-center">
          <Input value={customIcon} onChange={setCustomIcon} placeholder="e.g. 🏕️ or leave blank" className="flex-1" />
          {customIcon && (
            <button onClick={() => setCustomIcon('')} className="text-xs text-red-500 underline whitespace-nowrap">Clear</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Paste any emoji to use as the marker icon.</p>
      </Field>
      <Field label="Custom Color (hex, optional — overrides category color)">
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={customColor || selectedCat.color}
            onChange={e => setCustomColor(e.target.value)}
            className="w-10 h-9 rounded-lg border border-gray-200 dark:border-border cursor-pointer p-0.5 bg-white dark:bg-background"
          />
          <Input value={customColor} onChange={setCustomColor} placeholder={selectedCat.color} className="flex-1" />
          {customColor && (
            <button onClick={() => setCustomColor('')} className="text-xs text-red-500 underline whitespace-nowrap">Reset</button>
          )}
        </div>
      </Field>
      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="e.g. Hidden viewpoint" />
      </Field>
      <Field label="Description (optional)">
        <Textarea value={desc} onChange={setDesc} placeholder="Short description…" />
      </Field>
      <Field label="Address">
        <div className="flex gap-2 mb-2">
          <Input value={street} onChange={setStreet} placeholder="Street" className="flex-1" />
          <Input value={houseNumber} onChange={setHouseNumber} placeholder="No." className="w-20" />
        </div>
        <div className="flex gap-2">
          <Input value={city} onChange={setCity} placeholder="Village / City" className="flex-1" />
          <Input value={postcode} onChange={setPostcode} placeholder="PSČ" className="w-28" />
        </div>
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
      <button onClick={onSave} disabled={saving || !name.trim() || !lat || !lon}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : saveLabel}
      </button>
    </>
  );
}

// ─── Custom POIs tab ─────────────────────────────────────────────────────────
function POIsTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null); // null = add mode, id = edit mode

  // Form fields
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminPOIs().then(setItems); }, []);

  useEffect(() => {
    if (pendingLatLon) {
      setLat(pendingLatLon.lat.toFixed(6));
      setLon(pendingLatLon.lon.toFixed(6));
    }
  }, [pendingLatLon]);

  const clearForm = () => {
    setName(''); setDesc(''); setLat(''); setLon('');
    setStreet(''); setHouseNumber(''); setCity(''); setPostcode('');
    setCategory('restaurant'); setCustomIcon(''); setCustomColor('');
    setEditingId(null);
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setName(it.name || '');
    setDesc(it.description || '');
    setCategory(it.category || 'restaurant');
    setLat(it.lat?.toString() || '');
    setLon(it.lon?.toString() || '');
    setStreet(it.street || '');
    setHouseNumber(it.houseNumber || '');
    setCity(it.city || '');
    setPostcode(it.postcode || '');
    setCustomIcon(it.customIcon || '');
    setCustomColor(it.customColor || '');
    // Scroll to top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedCat = CATEGORY_OPTIONS.find(c => c.key === category) || CATEGORY_OPTIONS[0];
  const effectiveIcon = customIcon || selectedCat.icon;
  const effectiveColor = customColor || selectedCat.color;

  const saveNew = async () => {
    if (!name.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminPOI(user, {
        name: name.trim(), description: desc.trim(), category,
        icon: effectiveIcon, color: effectiveColor,
        customIcon: customIcon || null, customColor: customColor || null,
        lat: parseFloat(lat), lon: parseFloat(lon),
        street: street.trim(), houseNumber: houseNumber.trim(),
        city: city.trim(), postcode: postcode.trim(),
      });
      setItems(prev => [item, ...prev]);
      clearForm(); onClear();
    } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!name.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      await updateAdminPOI(user, editingId, {
        name: name.trim(), description: desc.trim(), category,
        icon: effectiveIcon, color: effectiveColor,
        customIcon: customIcon || null, customColor: customColor || null,
        lat: parseFloat(lat), lon: parseFloat(lon),
        street: street.trim(), houseNumber: houseNumber.trim(),
        city: city.trim(), postcode: postcode.trim(),
      });
      setItems(prev => prev.map(x => x.id === editingId
        ? { ...x, name: name.trim(), description: desc.trim(), category,
            icon: effectiveIcon, color: effectiveColor,
            customIcon: customIcon || null, customColor: customColor || null,
            lat: parseFloat(lat), lon: parseFloat(lon),
            street: street.trim(), houseNumber: houseNumber.trim(),
            city: city.trim(), postcode: postcode.trim() }
        : x
      ));
      clearForm(); onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this POI?')) return;
    await deleteAdminPOI(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
    if (editingId === id) clearForm();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <SectionHead>{editingId ? '✏️ Edit POI' : 'Add New POI'}</SectionHead>
        {editingId && (
          <button onClick={clearForm} className="text-xs text-muted-foreground underline">Cancel edit</button>
        )}
      </div>

      <POIForm
        name={name} setName={setName} desc={desc} setDesc={setDesc}
        category={category} setCategory={setCategory}
        lat={lat} setLat={setLat} lon={lon} setLon={setLon}
        street={street} setStreet={setStreet}
        houseNumber={houseNumber} setHouseNumber={setHouseNumber}
        city={city} setCity={setCity}
        postcode={postcode} setPostcode={setPostcode}
        customIcon={customIcon} setCustomIcon={setCustomIcon}
        customColor={customColor} setCustomColor={setCustomColor}
        onRequestMapClick={onRequestMapClick}
        saving={saving}
        onSave={editingId ? saveEdit : saveNew}
        saveLabel={editingId ? '✓ Save changes' : '+ Add POI'}
      />

      {items.length > 0 && (
        <>
          <SectionHead>Existing POIs ({items.length})</SectionHead>
          {items.map(it => {
            const cat = CATEGORY_OPTIONS.find(c => c.key === it.category);
            const icon = it.customIcon || cat?.icon || it.icon || '📍';
            const addressParts = [it.street, it.houseNumber, it.city, it.postcode].filter(Boolean);
            const isEditing = editingId === it.id;
            return (
              <div key={it.id} className={`rounded-xl mb-2 ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
                <ListItem icon={icon} title={it.name}
                  subtitle={[
                    cat?.label || it.category || 'Custom',
                    addressParts.length ? addressParts.join(', ') : `${it.lat?.toFixed(4)}, ${it.lon?.toFixed(4)}`,
                  ].filter(Boolean).join(' · ')}
                  onEdit={() => isEditing ? clearForm() : startEdit(it)}
                  onDelete={() => remove(it.id)} />
              </div>
            );
          })}
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

const NAV_TRANSLATE_LANGS = ['cs','pl','de','sk','it','fr','ru','uk','hu','ro','es','bg'];

async function translateMyMemory(text, targetLang) {
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.responseData?.translatedText || null;
  } catch { return null; }
}

async function buildTranslations(instructionEn) {
  const result = { en: instructionEn };
  await Promise.all(
    NAV_TRANSLATE_LANGS.map(async (lang) => {
      const translated = await translateMyMemory(instructionEn, lang);
      if (translated && translated.toLowerCase() !== instructionEn.toLowerCase()) {
        result[lang] = translated;
      }
    })
  );
  return result;
}

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
      const translations = await buildTranslations(instruction.trim());
      const item = await addAdminNavOverride(user, {
        road: road.trim(), direction, instruction: instruction.trim(),
        translations,
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
      <Field label="Custom instruction text (type in English — auto-translated to all languages)">
        <Input value={instruction} onChange={setInstruction} placeholder="e.g. Turn right towards Stříbro" />
        <p className="text-[11px] text-muted-foreground mt-1">✅ Will be auto-translated into cs, de, pl, sk, fr, it, ru, uk, hu, ro, es, bg on save.</p>
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
        {saving ? '🌐 Translating & Saving…' : '+ Add Override'}
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

// ─── Road Shield Marker tab ────────────────────────────────────────────────────
// Places a visible road number shield marker at a specific location you pick on the map.
// Use this to add a road sign marker at any point on a road section.
// The marker shows the road number in the correct color (blue/red/brown).
function RoadsTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);
  const [roadRef, setRoadRef] = useState('');
  const [roadClass, setRoadClass] = useState('primary');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminRoadOverrides().then(setItems); }, []);
  useEffect(() => {
    if (pendingLatLon) { setLat(pendingLatLon.lat.toFixed(6)); setLon(pendingLatLon.lon.toFixed(6)); }
  }, [pendingLatLon]);

  const save = async () => {
    if (!roadRef.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminRoadOverride(user, {
        roadRef: roadRef.trim().toUpperCase(),
        roadClass,
        notes: notes.trim(),
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      });
      setItems(prev => [item, ...prev]);
      setRoadRef(''); setNotes(''); setLat(''); setLon(''); setRoadClass('primary');
      onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminRoadOverride(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>Add Road Shield Marker</SectionHead>
      <p className="text-xs text-muted-foreground mb-3">
        Place a road number shield marker at a specific location on the map. Pick the point on the
        road where you want the sign to appear, type the road number, and choose the color style.
      </p>
      <Field label="Road number (e.g. 27, D5, E53)">
        <Input value={roadRef} onChange={setRoadRef} placeholder="e.g. 27" />
      </Field>
      <Field label="Shield color style">
        <Select value={roadClass} onChange={setRoadClass}>
          <option value="motorway">Motorway — red (D-roads)</option>
          <option value="trunk">Trunk — dark blue (R-roads)</option>
          <option value="primary">Primary — blue (numbered roads)</option>
          <option value="secondary">Secondary — blue</option>
          <option value="local">Local — brown (district roads)</option>
        </Select>
      </Field>
      <Field label="Notes (optional)">
        <Textarea value={notes} onChange={setNotes} placeholder="e.g. Road 27 sign at Klatovy junction" rows={1} />
      </Field>
      <Field label="Location — click on the map where this sign should appear">
        <div className="flex gap-2 mb-2">
          <Input value={lat} onChange={setLat} placeholder="Latitude" type="number" className="flex-1" />
          <Input value={lon} onChange={setLon} placeholder="Longitude" type="number" className="flex-1" />
        </div>
        <button onClick={onRequestMapClick}
          className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
          🗺️ Click on map to place marker
        </button>
      </Field>
      <button onClick={save} disabled={saving || !roadRef.trim() || !lat || !lon}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Place Road Marker'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing Road Markers ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id} icon="🛣️"
              title={`Road ${it.roadRef}`}
              subtitle={[it.roadClass, it.notes, it.lat ? `${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}` : ''].filter(Boolean).join(' · ')}
              onDelete={() => remove(it.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── E-Routes tab ─────────────────────────────────────────────────────────────
// How it works:
//   The map draws E-route shields based on the EURO_ROUTES lookup (e.g. "27" → E53 on every road 27 sign).
//   Here you can:
//   1. Remove E53 from road 27's global shields (so it disappears from ALL road 27 signs).
//   2. Place a standalone E53 marker at specific points along the road where E53 actually applies.
//
// For road 27 + E53 only from Železná Ruda to Plzeň:
//   → Step 1: Add a "Remove E-route from shields" entry for road 27 / E53.
//   → Step 2: Add E53 marker points along the Železná Ruda→Plzeň section (one every ~10 km is enough).
function ERoutesTab({ user, pendingLatLon, onRequestMapClick, onClear }) {
  const [items, setItems] = useState([]);

  // "Remove from shields" form
  const [removeRef, setRemoveRef] = useState('');
  const [removeERoute, setRemoveERoute] = useState('');

  // "Place E-route marker" form
  const [markerERoute, setMarkerERoute] = useState('');
  const [markerRoadRef, setMarkerRoadRef] = useState('');
  const [markerLat, setMarkerLat] = useState('');
  const [markerLon, setMarkerLon] = useState('');
  const [markerNote, setMarkerNote] = useState('');

  const [activeForm, setActiveForm] = useState('remove'); // 'remove' | 'marker'
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminERouteOverrides().then(setItems); }, []);

  useEffect(() => {
    if (pendingLatLon && activeForm === 'marker') {
      setMarkerLat(pendingLatLon.lat.toFixed(6));
      setMarkerLon(pendingLatLon.lon.toFixed(6));
    }
  }, [pendingLatLon, activeForm]);

  const saveRemove = async () => {
    if (!removeRef.trim()) return;
    setSaving(true);
    try {
      const item = await addAdminERouteOverride(user, {
        type: 'shield_remove',
        roadRef: removeRef.trim().toUpperCase(),
        eRoute: removeERoute.trim().toUpperCase() || null, // null = remove all E-routes from this road
      });
      setItems(prev => [item, ...prev]);
      setRemoveRef(''); setRemoveERoute('');
    } finally { setSaving(false); }
  };

  const saveMarker = async () => {
    if (!markerERoute.trim() || !markerLat || !markerLon) return;
    setSaving(true);
    try {
      const item = await addAdminERouteOverride(user, {
        type: 'marker',
        eRoute: markerERoute.trim().toUpperCase(),
        roadRef: markerRoadRef.trim().toUpperCase(),
        lat: parseFloat(markerLat),
        lon: parseFloat(markerLon),
        note: markerNote.trim(),
      });
      setItems(prev => [item, ...prev]);
      setMarkerERoute(''); setMarkerRoadRef(''); setMarkerLat(''); setMarkerLon(''); setMarkerNote('');
      onClear();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminERouteOverride(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  const shieldItems = items.filter(i => i.type === 'shield_remove');
  const markerItems = items.filter(i => i.type === 'marker');

  return (
    <div>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">How to set E53 only from Železná Ruda to Plzeň on road 27:</p>
        <ol className="text-xs text-blue-600 dark:text-blue-400 list-decimal list-inside space-y-0.5">
          <li>Use "Remove from shields" → type road ref <b>27</b>, E-route <b>E53</b> → removes E53 from all road 27 signs.</li>
          <li>Use "Place E-route marker" → type E53, click points along road 27 between Železná Ruda and Plzeň.</li>
        </ol>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setActiveForm('remove')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeForm === 'remove' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-accent text-muted-foreground hover:bg-gray-200'}`}>
          ❌ Remove from shields
        </button>
        <button onClick={() => setActiveForm('marker')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeForm === 'marker' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-accent text-muted-foreground hover:bg-gray-200'}`}>
          📍 Place E-route marker
        </button>
      </div>

      {activeForm === 'remove' && (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            Removes an E-route from the road number shields. After doing this, the E-route no longer appears
            on the road's sign — you then place individual markers where it should still be visible.
          </p>
          <Field label="Road ref to modify (e.g. 27)">
            <Input value={removeRef} onChange={setRemoveRef} placeholder="e.g. 27" />
          </Field>
          <Field label="E-route to remove (leave blank = remove ALL E-routes from this road)">
            <Input value={removeERoute} onChange={setRemoveERoute} placeholder="e.g. E53 — or leave blank to remove all" />
          </Field>
          <button onClick={saveRemove} disabled={saving || !removeRef.trim()}
            className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-red-600 active:scale-95 transition-all">
            {saving ? 'Saving…' : '❌ Remove E-route from shields'}
          </button>

          {shieldItems.length > 0 && (
            <>
              <SectionHead>Shield removals ({shieldItems.length})</SectionHead>
              {shieldItems.map(it => (
                <ListItem key={it.id} icon="❌"
                  title={`Road ${it.roadRef}: remove ${it.eRoute || 'all E-routes'} from shields`}
                  subtitle=""
                  onDelete={() => remove(it.id)} />
              ))}
            </>
          )}
        </>
      )}

      {activeForm === 'marker' && (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            Places a green E-route marker at a specific point on the map. Add one every ~10 km along
            the road section where this E-route applies.
          </p>
          <Field label="E-route to show (e.g. E53)">
            <Input value={markerERoute} onChange={setMarkerERoute} placeholder="e.g. E53" />
          </Field>
          <Field label="Road ref this belongs to (optional, for your reference)">
            <Input value={markerRoadRef} onChange={setMarkerRoadRef} placeholder="e.g. 27" />
          </Field>
          <Field label="Note (optional)">
            <Input value={markerNote} onChange={setMarkerNote} placeholder="e.g. Road 27 near Klatovy" />
          </Field>
          <Field label="Location — click the map where this marker should appear">
            <div className="flex gap-2 mb-2">
              <Input value={markerLat} onChange={setMarkerLat} placeholder="Latitude" type="number" className="flex-1" />
              <Input value={markerLon} onChange={setMarkerLon} placeholder="Longitude" type="number" className="flex-1" />
            </div>
            <button onClick={onRequestMapClick}
              className="w-full py-2 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              🗺️ Click on map to place marker
            </button>
          </Field>
          <button onClick={saveMarker} disabled={saving || !markerERoute.trim() || !markerLat || !markerLon}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-700 active:scale-95 transition-all">
            {saving ? 'Saving…' : '+ Place E-route marker'}
          </button>

          {markerItems.length > 0 && (
            <>
              <SectionHead>E-route markers ({markerItems.length})</SectionHead>
              {markerItems.map(it => (
                <ListItem key={it.id} icon="🟢"
                  title={`${it.eRoute}${it.roadRef ? ` on road ${it.roadRef}` : ''}`}
                  subtitle={[it.note, it.lat ? `${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}` : ''].filter(Boolean).join(' · ')}
                  onDelete={() => remove(it.id)} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Blocked Ambient POIs tab ─────────────────────────────────────────────────
function BlockedPOIsTab({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeletedAmbientPOIs().then(docs => { setItems(docs); setLoading(false); });
  }, []);

  const unblock = async (id) => {
    if (!confirm('Unblock this POI? It will appear on the map again.')) return;
    await removeDeletedAmbientPOI(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>Blocked Ambient POIs ({items.length})</SectionHead>
      <p className="text-xs text-muted-foreground mb-3">
        These POIs have been blocked and will never appear on the map again.
        Click the trash icon to unblock a POI and allow it to appear again.
      </p>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-8">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-muted-foreground mt-2">No blocked POIs</p>
          <p className="text-xs text-muted-foreground mt-1">Block POIs by tapping them on the map and pressing "Block POI"</p>
        </div>
      )}
      {items.map(it => (
        <ListItem
          key={it.id}
          icon="🚫"
          title={it.name || it.poiId || 'Unknown POI'}
          subtitle={[
            it.lat && it.lon ? `${Number(it.lat).toFixed(4)}, ${Number(it.lon).toFixed(4)}` : '',
            it.created_by ? `Blocked by ${it.created_by.split('@')[0]}` : '',
          ].filter(Boolean).join(' · ')}
          onDelete={() => unblock(it.id)}
        />
      ))}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export default function SuperAdminEditor({ user, onClose, onAdminDataChange }) {
  const [tab, setTab] = useState('pois');
  const [collapsed, setCollapsed] = useState(false);
  const [pendingLatLon, setPendingLatLon] = useState(null);
  const [adminNavMode, setAdminNavMode] = useState(false);

  const handleMapClick = useCallback((coords) => {
    setPendingLatLon(coords);
    setAdminNavMode(false);
  }, []);

  const requestMapClick = () => {
    setAdminNavMode(true);
    setCollapsed(true);
  };

  const clearPending = () => setPendingLatLon(null);

  useEffect(() => {
    onAdminDataChange?.({ handleMapClick, adminNavMode });
  }, [adminNavMode, handleMapClick]);

  return (
    <div className="fixed left-0 right-0 z-[2000] flex flex-col"
      style={{ bottom: 56, maxHeight: collapsed ? 60 : '80vh' }}>

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
            <div className="flex gap-2 px-4 py-2 border-b border-gray-100 dark:border-border flex-shrink-0 overflow-x-auto">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${tab === id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-accent text-muted-foreground hover:bg-gray-200 dark:hover:bg-accent/80'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

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
              {tab === 'roads' && (
                <RoadsTab user={user} pendingLatLon={pendingLatLon}
                  onRequestMapClick={requestMapClick} onClear={clearPending} />
              )}
              {tab === 'eroutes' && (
                <ERoutesTab user={user} pendingLatLon={pendingLatLon}
                  onRequestMapClick={requestMapClick} onClear={clearPending} />
              )}
              {tab === 'blocked' && (
                <BlockedPOIsTab user={user} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
