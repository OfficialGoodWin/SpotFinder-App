import React, { useEffect, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import StarRating from './StarRating';
import { getUserSpots, deleteSpot as firebaseDeleteSpot } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';

export default function MySpotsPanel({ user, onClose, onFlyTo }) {
  const { t } = useLanguage();
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      getUserSpots(user.email, 50)
        .then(data => { setSpots(data); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user?.email]);

  const handleDelete = async (id) => {
    await firebaseDeleteSpot(id);
    setSpots(spots.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('mySpots.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {loading && <p className="text-center text-gray-400 dark:text-muted-foreground py-6">{t('mySpots.loading')}</p>}
          {!loading && spots.length === 0 && (
            <div className="text-center py-10">
              <MapPin className="w-12 h-12 text-gray-300 dark:text-muted-foreground mx-auto mb-3" />
              <p className="text-gray-400 dark:text-muted-foreground font-medium">{t('mySpots.noSpotsYet')}</p>
              <p className="text-gray-300 dark:text-muted-foreground text-sm">{t('mySpots.addFirst')}</p>
            </div>
          )}
          {spots.map(spot => (
            <div key={spot.id} className="bg-gray-50 dark:bg-accent rounded-2xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-foreground truncate">{spot.title || 'Spot'}</p>
                {spot.description && <p className="text-xs text-gray-500 dark:text-muted-foreground truncate mt-0.5">{spot.description}</p>}
                <div className="mt-1"><StarRating value={Math.round(spot.rating || 0)} readOnly size="sm" /></div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => { onFlyTo([spot.lat, spot.lng]); onClose(); }}
                  className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg font-semibold">
                  {t('mySpots.view')}
                </button>
                <button onClick={() => handleDelete(spot.id)}
                  className="text-xs bg-red-100 dark:bg-red-900/30 text-red-500 px-2 py-1 rounded-lg font-semibold">
                  {t('mySpots.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
