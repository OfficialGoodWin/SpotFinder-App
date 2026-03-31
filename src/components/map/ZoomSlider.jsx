import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Half-circle zoom control pinned to the right edge of the screen.
 * - Up arrow (top) = zoom IN
 * - Down arrow (bottom) = zoom OUT
 * - Drag the knob vertically to change zoom continuously
 */
export default function ZoomSlider({ mapRef }) {
  const [zoom, setZoom] = useState(13);
  const dragging = useRef(false);
  const trackRef = useRef(null);
  const MIN_ZOOM = 3;
  const MAX_ZOOM = 20;
  const TRACK_H = 120; // px height of the draggable track

  // Sync zoom from map events
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoom', onZoom);
    setZoom(map.getZoom());
    return () => map.off('zoom', onZoom);
  }, [mapRef]);

  const zoomFraction = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
  // top = zoomed in (high zoom), bottom = zoomed out (low zoom)
  const knobTop = (1 - zoomFraction) * TRACK_H;

  const applyZoom = useCallback((clientY) => {
    const map = mapRef?.current;
    const track = trackRef.current;
    if (!map || !track) return;
    const rect = track.getBoundingClientRect();
    const y = Math.max(0, Math.min(TRACK_H, clientY - rect.top));
    const frac = 1 - y / TRACK_H; // top = 1 (zoomed in), bottom = 0 (zoomed out)
    const newZoom = MIN_ZOOM + frac * (MAX_ZOOM - MIN_ZOOM);
    map.setZoom(newZoom);
  }, [mapRef]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    applyZoom(e.clientY);
    const onMove = (ev) => { if (dragging.current) applyZoom(ev.clientY); };
    const onUp = () => { dragging.current = false; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [applyZoom]);

  const zoomIn = () => mapRef?.current?.zoomIn({ duration: 200 });
  const zoomOut = () => mapRef?.current?.zoomOut({ duration: 200 });

  return (
    <div
      className="absolute z-[900] flex flex-col items-center"
      style={{
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
      }}
    >
      {/* Half-circle container — right edge clipping */}
      <div
        className="relative flex flex-col items-center bg-background/90 backdrop-blur-md shadow-lg border border-r-0 rounded-l-full"
        style={{
          width: 40,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        {/* Zoom IN button (top) — up arrow means zoom in */}
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-foreground hover:text-primary active:scale-90 transition-all"
          aria-label="Zoom in"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Draggable track */}
        <div
          ref={trackRef}
          className="relative my-1 cursor-ns-resize"
          style={{ width: 20, height: TRACK_H }}
          onPointerDown={onPointerDown}
        >
          {/* Track line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[3px] rounded-full bg-gray-300 dark:bg-gray-600" />
          {/* Knob */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary shadow-md border-2 border-white dark:border-gray-800 transition-[top] duration-75"
            style={{ top: knobTop - 8 }}
          />
        </div>

        {/* Zoom OUT button (bottom) — down arrow means zoom out */}
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-foreground hover:text-primary active:scale-90 transition-all"
          aria-label="Zoom out"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
