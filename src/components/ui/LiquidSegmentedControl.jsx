import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * A real segmented control with direct touch scrubbing. A normal tap/click
 * still works; while a pointer is held down, moving across another segment
 * selects it and the shared glass lens glides to its measured position.
 */
export default function LiquidSegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  equal = false,
  tone = 'green',
  className = '',
  renderOption = option => option.label,
}) {
  const rootRef = useRef(null);
  const buttonRefs = useRef(new Map());
  const draggingRef = useRef(false);
  const [lens, setLens] = useState(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const button = buttonRefs.current.get(value);
    if (!root || !button) return;
    setLens({ x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const selectAtPoint = useCallback((clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY)?.closest?.('[data-liquid-value]');
    if (!target || !rootRef.current?.contains(target)) return;
    const nextValue = target.dataset.liquidValue;
    if (nextValue !== value) onChange(nextValue);
  }, [onChange, value]);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    selectAtPoint(event.clientX, event.clientY);
  };

  const stopDragging = (event) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-equal={equal || undefined}
      data-tone={tone}
      style={equal ? { '--sf-liquid-count': options.length } : undefined}
      className={`sf-liquid-choice ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={event => { if (draggingRef.current) selectAtPoint(event.clientX, event.clientY); }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <span
        className="sf-liquid-choice__lens"
        aria-hidden="true"
        style={lens ? {
          opacity: 1,
          width: `${lens.width}px`,
          height: `${lens.height}px`,
          transform: `translate3d(${lens.x}px, ${lens.y}px, 0)`,
        } : undefined}
      />
      {options.map(option => (
        <button
          key={option.value}
          ref={element => {
            if (element) buttonRefs.current.set(option.value, element);
            else buttonRefs.current.delete(option.value);
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          data-liquid-value={option.value}
          className="sf-liquid-choice__option"
          onClick={() => onChange(option.value)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = options.findIndex(item => item.value === option.value);
            const nextIndex = event.key === 'Home' ? 0
              : event.key === 'End' ? options.length - 1
                : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + options.length) % options.length;
            const next = buttonRefs.current.get(options[nextIndex].value);
            onChange(options[nextIndex].value);
            next?.focus();
          }}
        >
          {renderOption(option)}
        </button>
      ))}
    </div>
  );
}
