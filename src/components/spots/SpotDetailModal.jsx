import React, { useState, useEffect } from 'react';
import { X, Navigation, Star, MapPin, Edit2, Trash2 } from 'lucide-react';
import StarRating from './StarRating';
import { rateSpot, updateSpotRating, getSpotRatings } from '@/api/firebaseClient';

export default function SpotDetailModal({ spot, user, onClose, onNavigate, onEdit, onDelete }) {
  const [userRatingEat, setUserRatingEat] = useState(0);
  const [userRatingToilet, setUserRatingToilet] = useState(0);
  const [userRatingParking, setUserRatingParking] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [existingRatings, setExistingRatings] = useState([]);

  // Check for existing ratings when modal opens
  useEffect(() => {
    if (user && spot.id) {
      checkExistingRating();
    }
  }, [user, spot.id]);

  const checkExistingRating = async () => {
    try {
      const ratings = await getSpotRatings(spot.id);
      const userRatings = ratings.filter(r => r.user_email === user.email);
      
      if (userRatings.length > 0) {
        // User has already rated
        setRatingSubmitted(true);
        const existing = userRatings[0];
        setUserRatingEat(existing.rating_eat || 0);
        setUserRatingToilet(existing.rating_toilet || 0);
        setUserRatingParking(existing.rating_parking || 0);
      }
      setExistingRatings(ratings);
    } catch (error) {
      console.error('Error checking existing ratings:', error);
    }
  };

  // Immediate rating handler - submits as soon as any star is clicked
  const handleImmediateRate = async (newEat, newToilet, newParking) => {
    // Only submit if at least one rating is provided
    if (!newEat && !newToilet && !newParking) return;
    
    const ratings = [newEat, newToilet, newParking].filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    
    // Save individual ratings
    await rateSpot(spot.id, avgRating, {
      rating_eat: newEat,
      rating_toilet: newToilet,
      rating_parking: newParking,
      user_email: user.email
    });

    // Calculate new spot average from all ratings in database
    const allRatings = await getSpotRatings(spot.id);
    if (allRatings.length > 0) {
      let totalEat = 0, totalToilet = 0, totalParking = 0;
      let eatCount = 0, toiletCount = 0, parkingCount = 0;
      
      allRatings.forEach(r => {
        if (r.rating_eat > 0) { totalEat += r.rating_eat; eatCount++; }
        if (r.rating_toilet > 0) { totalToilet += r.rating_toilet; toiletCount++; }
        if (r.rating_parking > 0) { totalParking += r.rating_parking; parkingCount++; }
      });
      
      const newAvgRating = (totalEat + totalToilet + totalParking) / (eatCount + toiletCount + parkingCount);
      const newCount = eatCount + toiletCount + parkingCount;
      
      await updateSpotRating(spot.id, Math.round(newAvgRating * 10) / 10, newCount);
    }
    
    setRatingSubmitted(true);
  };

  const isOwner = user && spot.created_by === user.email;
  const isSuperadmin = user && user.email === 'superadmin@spotfinder.cz';

  // Show delete button for owner OR superadmin
  const canDelete = isOwner || isSuperadmin;

  // Handle rating submission when submit button is clicked
  const handleSubmitRating = async () => {
    // Only submit if at least one rating is provided
    if (!userRatingEat && !userRatingToilet && !userRatingParking) return;
    
    const ratings = [userRatingEat, userRatingToilet, userRatingParking].filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    
    // Save individual ratings
    await rateSpot(spot.id, avgRating, {
      rating_eat: userRatingEat,
      rating_toilet: userRatingToilet,
      rating_parking: userRatingParking,
      user_email: user.email
    });

    // Calculate new spot average from all ratings in database
    const allRatings = await getSpotRatings(spot.id);
    if (allRatings.length > 0) {
      let totalEat = 0, totalToilet = 0, totalParking = 0;
      let eatCount = 0, toiletCount = 0, parkingCount = 0;
      
      allRatings.forEach(r => {
        if (r.rating_eat > 0) { totalEat += r.rating_eat; eatCount++; }
        if (r.rating_toilet > 0) { totalToilet += r.rating_toilet; toiletCount++; }
        if (r.rating_parking > 0) { totalParking += r.rating_parking; parkingCount++; }
      });
      
      const newAvgRating = (totalEat + totalToilet + totalParking) / (eatCount + toiletCount + parkingCount);
      const newCount = eatCount + toiletCount + parkingCount;
      
      await updateSpotRating(spot.id, Math.round(newAvgRating * 10) / 10, newCount);
    }
    
    setRatingSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{spot.title || 'Spot'}</h2>
                <span className="text-xs font-semibold text-green-600">General Spot</span>
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

          {/* Overall Rating Display */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <StarRating value={Math.round(spot.rating || 0)} readOnly size="md" />
            <span className="text-gray-700 font-semibold">{spot.rating ? spot.rating.toFixed(1) : '–'}</span>
            <span className="text-gray-400 text-sm">({spot.rating_count || 0} ratings)</span>
          </div>

          {/* Display Individual Ratings */}
          {(spot.rating_eat || spot.rating_toilet || spot.rating_parking) && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">Category Ratings</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-green-50 rounded-xl text-center">
                  <span className="text-lg">🍽️</span>
                  <p className="text-xs text-green-700 font-medium">Eat</p>
                  <StarRating value={spot.rating_eat || 0} readOnly size="sm" />
                </div>
                <div className="p-2 bg-orange-50 rounded-xl text-center">
                  <span className="text-lg">🚽</span>
                  <p className="text-xs text-orange-700 font-medium">Toilet</p>
                  <StarRating value={spot.rating_toilet || 0} readOnly size="sm" />
                </div>
                <div className="p-2 bg-blue-50 rounded-xl text-center">
                  <span className="text-lg">🅿️</span>
                  <p className="text-xs text-blue-700 font-medium">Parking</p>
                  <StarRating value={spot.rating_parking || 0} readOnly size="sm" />
                </div>
              </div>
            </div>
          )}

          {user && !ratingSubmitted && !isOwner && (
            <div className="p-4 bg-green-50 rounded-2xl space-y-3">
              <p className="text-sm font-semibold text-green-700 mb-2">Rate this spot</p>
              
              {/* Eat Rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">🍽️ Eat here</span>
                <StarRating value={userRatingEat} onChange={(val) => setUserRatingEat(val)} size="md" />
              </div>
              
              {/* Toilet Rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-700">🚽 Toilet</span>
                <StarRating value={userRatingToilet} onChange={(val) => setUserRatingToilet(val)} size="md" />
              </div>
              
              {/* Parking Rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">🅿️ Parking</span>
                <StarRating value={userRatingParking} onChange={(val) => setUserRatingParking(val)} size="md" />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleSubmitRating}
                disabled={(!userRatingEat && !userRatingToilet && !userRatingParking)}
                className="w-full py-2.5 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                Submit Rating
              </button>
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
          {canDelete && (
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
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            Navigate Here
          </button>
        </div>
      </div>
    </div>
  );
}
