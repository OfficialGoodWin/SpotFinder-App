export const AMBIENT_CATEGORIES = [
  // zoom 13+ — big landmarks
  { key:'train',       minZoom:13, icon:'🚆', color:'#34495E', geo:'public_transport.train' },
  { key:'fuel',        minZoom:13, icon:'⛽', color:'#E74C3C', geo:'service.vehicle.fuel' },
  { key:'charging',    minZoom:13, icon:'🔌', color:'#27AE60', geo:'service.vehicle.charging_station' },
  { key:'hotel',       minZoom:13, icon:'🏨', color:'#2980B9', geo:'accommodation.hotel' },
  { key:'museum',      minZoom:13, icon:'🏛️', color:'#34495E', geo:'entertainment.museum' },
  { key:'heritage',    minZoom:13, icon:'🏰', color:'#95A5A6', geo:'heritage' },
  { key:'hospital',    minZoom:13, icon:'🏥', color:'#C0392B', geo:'healthcare.hospital' },
  // zoom 15+ — neighbourhood-level
  { key:'restaurant',  minZoom:15, icon:'🍽️', color:'#E74C3C', geo:'catering.restaurant' },
  { key:'cafe',        minZoom:15, icon:'☕', color:'#8B4513', geo:'catering.cafe' },
  { key:'bar',         minZoom:15, icon:'🍺', color:'#D68910', geo:'catering.bar' },
  { key:'pharmacy',    minZoom:15, icon:'💊', color:'#E67E22', geo:'healthcare.pharmacy' },
  { key:'bank',        minZoom:15, icon:'🏦', color:'#F39C12', geo:'service.financial.bank' },
  { key:'supermarket', minZoom:15, icon:'🏪', color:'#27AE60', geo:'commercial.supermarket' },
  // zoom 16+ — street-level detail
  { key:'atm',         minZoom:16, icon:'💳', color:'#16A085', geo:'service.financial.atm' },
  { key:'bakery',      minZoom:16, icon:'🥖', color:'#D4A574', geo:'commercial.food_and_drink' },
  { key:'parking',     minZoom:16, icon:'🅿️', color:'#3498DB', geo:'parking' },
];

