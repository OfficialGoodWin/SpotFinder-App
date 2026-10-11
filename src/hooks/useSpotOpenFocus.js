import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpotFocusRequest } from '@/lib/mapSpotFocus';

export function useSpotOpenFocus({ selectedSpot, setSelectedSpot }) {
  const [spotFocus, setSpotFocus] = useState(null);
  const activeSpotId = useRef(selectedSpot?.id ? String(selectedSpot.id) : null);

  useEffect(() => {
    activeSpotId.current = selectedSpot?.id ? String(selectedSpot.id) : null;
  }, [selectedSpot?.id]);

  const openSpot = useCallback((spot, { focus = true, source = 'unknown' } = {}) => {
    const request = createSpotFocusRequest(spot, source);
    if (!request) return false;
    const alreadyOpen = request.spotId && activeSpotId.current === request.spotId;
    activeSpotId.current = request.spotId;
    setSelectedSpot(spot);
    if (focus && !alreadyOpen) setSpotFocus(request);
    return true;
  }, [setSelectedSpot]);

  const closeSpot = useCallback(() => {
    activeSpotId.current = null;
    setSelectedSpot(null);
  }, [setSelectedSpot]);

  return { closeSpot, openSpot, spotFocus };
}
