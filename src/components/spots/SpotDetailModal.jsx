import React, { useState } from 'react';
import { X, Navigation, MapPin, Car, Utensils, TreePine, Edit2, Trash2 } from 'lucide-react';
import StarRating from './StarRating';
import { rateSpot, updateSpotRating } from '@/api/firebaseClient';

const TYPE_CONFIG = {
  parking: { label: 'Parking', Icon: Car, color: 'text-blue-600', bg: 'bg-blue-100' },
  food: { label: 'Eat / Picnic', Icon: Utensils, color: 'text-green-600', bg: 'bg-green-100' },
  toilet: { label: 'Hidden Toilet', Icon: TreePine, color: 'text-orange-600', bg: 'bg-orange-100' },
};

export default function SpotDetailModal({ spot, user, onClose, onNavigate, onEdit, onDelete }) {
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const cfg = TYPE_CONFIG[spot.spot_type] || TYPE_CONFIG.parking;
  const { Icon } = cfg;
  const isOwner = user && spot.created_by === user.email;

  const handleRate = async (val) => {
    setUserRating(val);
    await rateSpot(spot.id, val);
    const newCount = (spot.rating_count || 0) + 1;
    const newRating = (((spot.rating || 0) * (spot.rating_count || 0)) + val) / newCount;
    await updateSpotRating(spot.id, Math.round(newRating * 10) / 10, newCount);
    setRatingSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{spot.title || cfg.label}</h2>
                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {spot.image_url && (
            <img src={spot.image_url} alt="spot" className="w-full h-48 object-cover rounded-2xl" />
          )}

          {spot.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{spot.description}</p>
          )}

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <StarRating value={Math.round(spot.rating || 0)} readOnly size="md" />
            <span className="text-gray-700 font-semibold">{spot.rating ? spot.rating.toFixed(1) : '–'}</span>
            <span className="text-gray-400 text-sm">({spot.rating_count || 0} ratings)</span>
          </div>

          {user && !ratingSubmitted && !isOwner && (
            <div className="p-4 bg-blue-50 rounded-2xl">
              <p className="text-sm font-semibold text-blue-700 mb-2">Rate this spot</p>
              <StarRating value={userRating} onChange={handleRate} size="lg" />
            </div>
          )}
          {!user && !ratingSubmitted && (
            <div className="p-4 bg-gray-50 rounded-xl text-center border border-gray-200">
              <p className="text-sm text-gray-500">
                Sign in to rate this spot
              </p>
            </div>
          )}
          {ratingSubmitted && (
            <div className="p-3 bg-green-50 rounded-2xl text-center text-green-700 text-sm font-semibold">
              ✓ Thanks for rating!
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <MapPin className="w-3 h-3" />
            <span>{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {isOwner && (
            <>
              <button onClick={onEdit} className="p-3 rounded-2xl border-2 border-gray-200 hover:bg-gray-50 transition-colors">
                <Edit2 className="w-5 h-5 text-gray-600" />
              </button>
              <button onClick={onDelete} className="p-3 rounded-2xl border-2 border-red-200 hover:bg-red-50 transition-colors">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </>
          )}
          <button
            onClick={() => onNavigate(spot)}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            Navigate Here
          </button>
        </div>
      </div>
    </div>
  );
}
