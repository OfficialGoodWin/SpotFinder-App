/**
 * SuperAdminEditor.jsx
 * Full map editor for superadmin@spotfinder.cz
 * Tabs: Custom POIs · Road Closures · Nav Overrides · Road Editor · E-Routes
 */
import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, AlertTriangle, Navigation, Trash2, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import {
  getAdminPOIs, addAdminPOI, updateAdminPOI, deleteAdminPOI,
  getAdminClosures, addAdminClosure, deleteAdminClosure,
  getAdminNavOverrides, addAdminNavOverride, deleteAdminNavOverride,
  getAdminRoadOverrides, addAdminRoadOverride, deleteAdminRoadOverride,
  getAdminERouteOverrides, addAdminERouteOverride, deleteAdminERouteOverride,
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
  onRequestMapClick, saving, onSave, saveLabel }) {
  const selectedCat = CATEGORY_OPTIONS.find(c => c.key === category) || CATEGORY_OPTIONS[0];
  return (
    <>
      <Field label="Category">
        <Select value={category} onChange={setCategory}>
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.icon} {opt.label}</option>
          ))}
        </Select>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: selectedCat.color }}>
            {selectedCat.icon}
          </div>
          <span className="text-xs text-muted-foreground">{selectedCat.label} — {selectedCat.color}</span>
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
    setCategory('restaurant'); setEditingId(null);
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
    // Scroll to top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedCat = CATEGORY_OPTIONS.find(c => c.key === category) || CATEGORY_OPTIONS[0];

  const saveNew = async () => {
    if (!name.trim() || !lat || !lon) return;
    setSaving(true);
    try {
      const item = await addAdminPOI(user, {
        name: name.trim(), description: desc.trim(), category,
        icon: selectedCat.icon, color: selectedCat.color,
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
        icon: selectedCat.icon, color: selectedCat.color,
        lat: parseFloat(lat), lon: parseFloat(lon),
        street: street.trim(), houseNumber: houseNumber.trim(),
        city: city.trim(), postcode: postcode.trim(),
      });
      setItems(prev => prev.map(x => x.id === editingId
        ? { ...x, name: name.trim(), description: desc.trim(), category,
            icon: selectedCat.icon, color: selectedCat.color,
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
            const icon = cat?.icon || it.icon || '📍';
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

// ─── Road Editor tab ──────────────────────────────────────────────────────────
// Allows editing road number markings (the road ref number displayed on shields).
// Each override stores: ref (original road number), newRef (replacement), roadClass, notes.
// The MapLibreMap reads these overrides and applies them when drawing road shields.
function RoadsTab({ user }) {
  const [items, setItems] = useState([]);
  const [origRef, setOrigRef] = useState('');
  const [newRef, setNewRef] = useState('');
  const [roadClass, setRoadClass] = useState('primary');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminRoadOverrides().then(setItems); }, []);

  const save = async () => {
    if (!origRef.trim() || !newRef.trim()) return;
    setSaving(true);
    try {
      const item = await addAdminRoadOverride(user, {
        origRef: origRef.trim().toUpperCase(),
        newRef: newRef.trim().toUpperCase(),
        roadClass: roadClass,
        notes: notes.trim(),
      });
      setItems(prev => [item, ...prev]);
      setOrigRef(''); setNewRef(''); setNotes(''); setRoadClass('primary');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminRoadOverride(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>Road Number Override</SectionHead>
      <p className="text-xs text-muted-foreground mb-3">
        Override how a road's number/ref is displayed on the map shield. The original ref from OSM data is replaced by the new ref you specify.
      </p>
      <Field label="Original Road Ref (from OSM, e.g. '27')">
        <Input value={origRef} onChange={setOrigRef} placeholder="e.g. 27" />
      </Field>
      <Field label="New Road Ref to display (e.g. '27a')">
        <Input value={newRef} onChange={setNewRef} placeholder="e.g. 27a" />
      </Field>
      <Field label="Road Class">
        <Select value={roadClass} onChange={setRoadClass}>
          <option value="motorway">Motorway (red)</option>
          <option value="trunk">Trunk (blue)</option>
          <option value="primary">Primary (blue)</option>
          <option value="secondary">Secondary (blue)</option>
          <option value="local">Local (brown)</option>
        </Select>
      </Field>
      <Field label="Notes (optional)">
        <Textarea value={notes} onChange={setNotes} placeholder="Why this override? E.g. OSM has wrong number" />
      </Field>
      <button onClick={save} disabled={saving || !origRef.trim() || !newRef.trim()}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Add Road Override'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing Road Overrides ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id} icon="🛣️" title={`${it.origRef} → ${it.newRef}`}
              subtitle={[it.roadClass, it.notes].filter(Boolean).join(' · ')}
              onDelete={() => remove(it.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── E-Routes tab ─────────────────────────────────────────────────────────────
// Allows editing the E-route (European route) assignments for road refs.
// E.g. road 27 should NOT have E53 for the full road, only on the section from Železná Ruda to Plzeň.
// Each override: roadRef, action (add/remove/set), eRoutes (comma-separated), segmentDesc.
function ERoutesTab({ user }) {
  const [items, setItems] = useState([]);
  const [roadRef, setRoadRef] = useState('');
  const [action, setAction] = useState('set');
  const [eRoutes, setERoutes] = useState('');
  const [segmentDesc, setSegmentDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminERouteOverrides().then(setItems); }, []);

  const save = async () => {
    if (!roadRef.trim()) return;
    setSaving(true);
    try {
      const parsedRoutes = eRoutes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const item = await addAdminERouteOverride(user, {
        roadRef: roadRef.trim().toUpperCase(),
        action,
        eRoutes: parsedRoutes,
        segmentDesc: segmentDesc.trim(),
      });
      setItems(prev => [item, ...prev]);
      setRoadRef(''); setERoutes(''); setSegmentDesc(''); setAction('set');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await deleteAdminERouteOverride(user, id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <SectionHead>E-Route Override</SectionHead>
      <p className="text-xs text-muted-foreground mb-3">
        Control which European route designations (E53, E50, etc.) appear on road shields.
        For example: road 27 should only show E53 from Železná Ruda to Plzeň, not on the whole road.
      </p>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Current defaults (from code):</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">Road 27 → E53 (full road) · Use "remove" action to disable</p>
      </div>

      <Field label="Road Ref (e.g. '27', 'D5', 'A 6')">
        <Input value={roadRef} onChange={setRoadRef} placeholder="e.g. 27" />
      </Field>
      <Field label="Action">
        <Select value={action} onChange={setAction}>
          <option value="set">Set — replace all E-routes with these</option>
          <option value="add">Add — add these E-routes to existing</option>
          <option value="remove">Remove — remove all E-routes from this road</option>
        </Select>
      </Field>
      {action !== 'remove' && (
        <Field label="E-Routes (comma-separated, e.g. 'E53, E50')">
          <Input value={eRoutes} onChange={setERoutes} placeholder="e.g. E53" />
        </Field>
      )}
      <Field label="Segment description (optional)">
        <Textarea value={segmentDesc} onChange={setSegmentDesc}
          placeholder="e.g. Only from Železná Ruda to Plzeň, not the whole road 27" />
      </Field>
      <button onClick={save} disabled={saving || !roadRef.trim() || (action !== 'remove' && !eRoutes.trim())}
        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-700 active:scale-95 transition-all">
        {saving ? 'Saving…' : '+ Save E-Route Override'}
      </button>

      {items.length > 0 && (
        <>
          <SectionHead>Existing E-Route Overrides ({items.length})</SectionHead>
          {items.map(it => (
            <ListItem key={it.id} icon="🟢"
              title={`${it.roadRef}: ${it.action === 'remove' ? '❌ Remove all E-routes' : `${it.action} ${it.eRoutes?.join(', ')}`}`}
              subtitle={it.segmentDesc || ''}
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
                <RoadsTab user={user} />
              )}
              {tab === 'eroutes' && (
                <ERoutesTab user={user} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
