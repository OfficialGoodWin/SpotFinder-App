import React, { useState } from 'react';
import { X, Camera, MapPin, Car, Utensils, TreePine } from 'lucide-react';
import StarRating from './StarRating';

const TYPE_OPTIONS = [
  { id: 'parking', label: 'Parking', icon: Car, color: 'bg-blue-100 border-blue-400 text-blue-700' },
  { id: 'food', label: 'Eat / Picnic', icon: Utensils, color: 'bg-green-100 border-green-400 text-green-700' },
  { id: 'toilet', label: 'Hidden Toilet', icon: TreePine, color: 'bg-orange-100 border-orange-400 text-orange-700' },
];

export default function AddSpotModal({ latlng, onClose, onSave }) {
  const [spotType, setSpotType] = useState('parking');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const typeLabels = { parking: '🅿️ Rate this parking', food: '🍽️ Rate this spot', toilet: '🌿 How hidden is it?' };

  const handleSave = async () => {
    setLoading(true);
    let image_url = null;
    if (imageFile) {
      // For demo: convert image to base64 data URL
      // In production, you'd upload to Firebase Storage or another service
      image_url = imagePreview;
    }
    await onSave({
      lat: latlng.lat,
      lng: latlng.lng,
      spot_type: spotType,
      title: title || TYPE_OPTIONS.find(t => t.id === spotType)?.label,
      description,
      rating,
      rating_count: rating > 0 ? 1 : 0,
      image_url,
      is_public: true,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">Add Spot</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Type selection */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-2 block">Spot Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSpotType(t.id)}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all
                      ${spotType === t.id ? t.color + ' border-opacity-100 scale-105 shadow-md' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">Name (optional)</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this spot a name..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what's here..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-2 block">{typeLabels[spotType]}</label>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>

          {/* Image */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-2 block">Photo</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-2xl" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Camera className="w-8 h-8 text-gray-400 mb-1" />
                <span className="text-sm text-gray-500">Tap to add photo</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-2 px-8 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Spot'}
          </button>
        </div>
      </div>
    </div>
  );
}