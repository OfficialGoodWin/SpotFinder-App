import React, { useState } from 'react';
import { X, Camera, MapPin } from 'lucide-react';
import StarRating from './StarRating';

export default function AddSpotModal({ latlng, onClose, onSave }) {
  const [description, setDescription] = useState('');
  const [ratingEat, setRatingEat] = useState(0);
  const [ratingToilet, setRatingToilet] = useState(0);
  const [ratingParking, setRatingParking] = useState(0);
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

  const handleSave = async () => {
    setLoading(true);
    let image_url = null;
    if (imageFile) {
      image_url = imagePreview;
    }
    
    // Calculate average rating from the three categories
    const ratings = [ratingEat, ratingToilet, ratingParking].filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    
    await onSave({
      lat: latlng.lat,
      lng: latlng.lng,
      spot_type: 'general',
      title: 'Spot',
      description,
      rating: Math.round(avgRating * 10) / 10,
      rating_count: ratings.length > 0 ? 1 : 0,
      rating_eat: ratingEat,
      rating_toilet: ratingToilet,
      rating_parking: ratingParking,
      image_url,
      is_public: true,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Add Spot</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what's here..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-300 text-sm resize-none"
            />
          </div>

          {/* Three Rating Columns */}
          <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-600 mb-2 block">Rate this spot</label>
            
            {/* Eat Rating */}
            <div className="p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">🍽️ How well can you eat here</span>
              </div>
              <StarRating value={ratingEat} onChange={setRatingEat} size="lg" />
            </div>

            {/* Toilet Rating */}
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">🚽 How well is it hidden for toilet</span>
              </div>
              <StarRating value={ratingToilet} onChange={setRatingToilet} size="lg" />
            </div>

            {/* Parking Rating */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">🅿️ How well can you park here</span>
              </div>
              <StarRating value={ratingParking} onChange={setRatingParking} size="lg" />
            </div>
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
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
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
            className="flex-2 px-8 py-3 rounded-2xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Spot'}
          </button>
        </div>
      </div>
    </div>
  );
}
