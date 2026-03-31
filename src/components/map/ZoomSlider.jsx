import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const MIN_ZOOM = 3;
const MAX_ZOOM = 20;
// Height of the pill itself in px — used to centre it on its position
const PILL_H = 80;

/**
 * Half-circle zoom control that slides up/down the right edge.
 * Drag the pill up → zoom in, drag down → zoom out.
 * The pill's vertical position reflects the current zoom level.
 */
export default function ZoomSlider({ mapRef }) {
  const [zoom, setZoom] = useState(13);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartZoom = useRef(13);
  // How many px of drag = 1 zoom level
  const PX_PER_ZOOM = 18;

  // Sync zoom from map events
  useEffect(() => {
    const interval = setInterval(() => {
      const map = mapRef?.current;
      if (!map) return;
      const z = map.getZoom();
      setZoom(z);
      clearInterval(interval);
      map.on('zoom', () => setZoom(map.getZoom()));
    }, 100);
    return () => clearInterval(interval);
  }, [mapRef]);

  // Convert zoom level to top% position (high zoom = top, low zoom = bottom)
  const zoomFrac = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
  // 5% at max zoom, 85% at min zoom — leaves room at top & bottom
  const topPct = 5 + (1 - zoomFrac) * 80;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartZoom.current = mapRef?.current?.getZoom() ?? zoom;

    const onMove = (ev) => {
      if (!dragging.current) return;
      const dy = ev.clientY - dragStartY.current;
      // drag up (negative dy) = zoom in
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
        dragStartZoom.current - dy / PX_PER_ZOOM
      ));
      mapRef?.current?.setZoom(newZoom);
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [mapRef, zoom]);

  return (
    <div
      className="absolute z-[900]"
      style={{
        right: 0,
        top: `${topPct}%`,
        transform: 'translateY(-50%)',
        transition: dragging.current ? 'none' : 'top 0.1s ease-out',
      }}
    >
      {/* Half-circle pill — clipped to right edge */}
      <div
        onPointerDown={onPointerDown}
        className="flex flex-col items-center justify-between bg-background/90 backdrop-blur-md shadow-lg border border-r-0 cursor-ns-resize select-none"
        style={{
          width: 38,
          height: PILL_H,
          borderRadius: '9999px 0 0 9999px',
          paddingTop: 6,
          paddingBottom: 6,
          touchAction: 'none',
        }}
      >
        <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
        {/* Zoom level indicator dot */}
        <div className="w-2 h-2 rounded-full bg-primary opacity-80" />
        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}
