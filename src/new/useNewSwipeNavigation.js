import { useRef } from 'react';

const MAIN_TABS = ['map', 'discover', 'collection', 'profile'];
const INTERACTIVE = 'button,a,input,textarea,select,[contenteditable="true"],[role="slider"],.sf-new-categories,.v2-chips,.sf-new-card-list,.sf-new-nearby,.sf-new-poi-scroll,.sf-new-detail-scroll,.sf-new-discover-media,.v2-discover-photo';

function hasHorizontalScroller(target, boundary) {
  for (let node = target; node && node !== boundary; node = node.parentElement) {
    if (node.scrollWidth <= node.clientWidth + 4) continue;
    const overflow = getComputedStyle(node).overflowX;
    if (overflow === 'auto' || overflow === 'scroll') return true;
  }
  return false;
}

export function useNewSwipeNavigation({ enabled, tab, backPath, blocked, onTab, onBack }) {
  const gesture = useRef(null);

  const onTouchStart = event => {
    gesture.current = null;
    if (!enabled || blocked || event.touches.length !== 1) return;
    const boundary = event.currentTarget;
    const target = event.target;
    if (target.closest?.(INTERACTIVE) || hasHorizontalScroller(target, boundary)) return;
    const rect = boundary.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    if (backPath) {
      if (x > 36) return;
    } else if (tab === 'map') {
      // The map itself keeps every ordinary pan; only the narrow right edge switches tabs.
      if (x < rect.width - 30) return;
    } else if (x < 30 || x > rect.width - 30) return;
    gesture.current = { x: touch.clientX, y: touch.clientY, time: performance.now(), axis: '', backPath, tab };
  };

  const onTouchMove = event => {
    const current = gesture.current;
    if (!current || event.touches.length !== 1) { gesture.current = null; return; }
    const dx = event.touches[0].clientX - current.x;
    const dy = event.touches[0].clientY - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) current.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
    if (current.axis === 'vertical') gesture.current = null;
  };

  const onTouchEnd = event => {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.axis !== 'horizontal' || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - current.x;
    const dy = event.changedTouches[0].clientY - current.y;
    const elapsed = Math.max(1, performance.now() - current.time);
    if (Math.abs(dx) < 65 && !(Math.abs(dx) > 42 && Math.abs(dx) / elapsed > 0.45)) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (current.backPath) { if (dx > 0) onBack(current.backPath); return; }
    if (current.tab === 'map' && dx > 0) return;
    const index = MAIN_TABS.indexOf(current.tab);
    const next = MAIN_TABS[index + (dx < 0 ? 1 : -1)];
    if (next) onTab(next);
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: () => { gesture.current = null; } };
}
