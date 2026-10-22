import { iconGlyphSVG } from './mapIcons.js';

const safeColor = value => /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#6B7280';

export function createTrafficPopupContent(type, properties = {}) {
  const root = document.createElement('div');
  root.style.cssText = 'font-size:13px;max-width:200px';
  const heading = document.createElement('strong');
  heading.style.color = '#CC1111';
  heading.textContent = {
    closure: '⛔ Road Closed', works: '🚧 Road Works', lane: 'Lane Closed',
    accident: '🚨 Accident', jam: '🚗 Traffic Jam',
  }[type] || 'Traffic Incident';
  root.append(heading);
  for (const [label, value] of [
    ['🛣️ ', properties.roadNumbers?.[0]], ['From: ', properties.from], ['To: ', properties.to],
  ]) {
    if (value == null || value === '') continue;
    const row = document.createElement('div');
    row.textContent = label + String(value);
    root.append(row);
  }
  return root;
}

export function createAdminPoiPopupContent(poi, category) {
  const root = document.createElement('div');
  root.style.cssText = 'min-width:220px;font-size:13px;line-height:1.4';
  const heading = document.createElement('div');
  const color = safeColor(category.color);
  heading.style.cssText = 'font-weight:600;margin-bottom:4px;font-size:14px;display:flex;align-items:center;gap:6px';
  heading.style.color = color;
  const icon = document.createElement('span');
  // Icon paths are a fixed local lookup; validate the only interpolated SVG attribute.
  icon.innerHTML = iconGlyphSVG(category.key, 14, color);
  const categoryName = document.createElement('span');
  categoryName.textContent = category.name || 'POI';
  heading.append(icon, categoryName);
  root.append(heading);

  const name = document.createElement('div');
  name.style.cssText = 'font-weight:500;margin-bottom:6px;color:#111';
  name.textContent = poi.name || category.name || 'POI';
  root.append(name);

  const addressFields = [
    ['🏠 ', poi.houseNumber], ['🛣️ ', poi.street],
    ['🏙️ ', poi.city], ['📮 ', poi.postcode],
  ].filter(([, value]) => value != null && value !== '');
  if (addressFields.length) {
    const address = document.createElement('div');
    address.style.cssText = 'font-size:12px;color:#555;border-top:1px solid #eee;padding-top:4px';
    for (const [label, value] of addressFields) {
      const row = document.createElement('div');
      row.textContent = label + String(value);
      address.append(row);
    }
    root.append(address);
  }
  return root;
}
