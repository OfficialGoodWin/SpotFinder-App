import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const THUMB_RADIUS = 16;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function MobileZoomSlider({ map, onDragStart, onDragEnd }) {
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 13);
  const dragRef = useRef(null);
  const trackRef = useRef(null);
  const min = map?.getMinZoom() ?? 3;
  const max = map?.getMaxZoom() ?? 19;
  const position = (max - clamp(zoom, min, max)) / (max - min);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const actual = map.getZoom();
      setZoom(previous => Math.abs(previous - actual) < 0.001 ? previous : actual);
    };
    sync();
    map.on('zoom', sync);
    return () => {
      map.off('zoom', sync);
      if (dragRef.current) {
        if (dragRef.current.restorePan) map.dragPan.enable();
        dragRef.current = null;
        onDragEnd?.();
      }
    };
  }, [map, onDragEnd]);

  const setClampedZoom = value => {
    if (map) map.setZoom(clamp(value, min, max));
  };

  const zoomFromPointer = (clientY, grabOffset = 0) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= THUMB_RADIUS * 2) return;
    const travel = rect.height - THUMB_RADIUS * 2;
    const top = clamp(clientY - grabOffset - rect.top - THUMB_RADIUS, 0, travel);
    setClampedZoom(max - (top / travel) * (max - min));
  };

  const stopDrag = event => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.restorePan) map?.dragPan.enable();
    onDragEnd?.();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerDown = event => {
    if (!map || dragRef.current || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    onDragStart?.();
    map.stop();
    const onThumb = event.target.closest('.v2-zoom-thumb');
    const thumbCenter = onThumb?.getBoundingClientRect().top + THUMB_RADIUS;
    const grabOffset = onThumb ? event.clientY - thumbCenter : 0;
    const restorePan = map.dragPan.isEnabled();
    if (restorePan) map.dragPan.disable();
    dragRef.current = { pointerId: event.pointerId, grabOffset, restorePan };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!onThumb) zoomFromPointer(event.clientY);
  };

  const onPointerMove = event => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    zoomFromPointer(event.clientY, drag.grabOffset);
  };

  const onKeyDown = event => {
    const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 };
    if (event.key in steps) setClampedZoom(zoom + steps[event.key]);
    else if (event.key === 'Home') setClampedZoom(min);
    else if (event.key === 'End') setClampedZoom(max);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return <div className="v2-zoom-control" aria-label="Přiblížení mapy">
    <button type="button" aria-label="Přiblížit mapu" disabled={!map || zoom >= max} onClick={() => setClampedZoom(map.getZoom() + 1)}><Plus size={19} strokeWidth={2} /></button>
    <div
      ref={trackRef}
      className="v2-zoom-track"
      role="slider"
      tabIndex={map ? 0 : -1}
      aria-label="Přiblížení mapy"
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(zoom * 10) / 10}
      aria-valuetext={`Úroveň přiblížení ${zoom.toFixed(1)}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
    >
      <span className="v2-zoom-rail" aria-hidden="true" />
      <span className="v2-zoom-thumb" style={{ top: `${THUMB_RADIUS + position * (144 - THUMB_RADIUS * 2)}px` }} aria-hidden="true" />
    </div>
    <button type="button" aria-label="Oddálit mapu" disabled={!map || zoom <= min} onClick={() => setClampedZoom(map.getZoom() - 1)}><Minus size={19} strokeWidth={2} /></button>
  </div>;
}
