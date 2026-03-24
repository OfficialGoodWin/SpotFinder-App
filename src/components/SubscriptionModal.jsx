import React, { useState, useEffect } from 'react';
import { Crown, Gem, CreditCard, CheckCircle } from 'lucide-react';
import { createCheckoutSession, PLANS } from '@/api/stripe';
import { useAuth } from '@/lib/AuthContext';

export default function SubscriptionModal({ isOpen, onClose }) {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      fetchSubscription();
    }
  }, [isOpen, user]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch(`/api/subscription-status?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.warn('Subscription check failed:', e);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!user) return;
    setLoading(true);
    try {
      await createCheckoutSession(planId);
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Subscription failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !isAuthenticated || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upgrade to Elite</h2>
          <p className="text-gray-600 dark:text-gray-400">Unlock premium features like lane markings and advanced navigation.</p>
        </div>

        <div className="p-6 space-y-6">
          {subscription?.status === 'active' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{PLANS[subscription.plan]?.name} Active</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Until {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}</p>
              <button 
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Elite Plan */}
              <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-2xl text-white">
                <div className="absolute top-4 right-4 opacity-75">
                  <Crown className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">SpotFinder Elite</h3>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      <span className="text-lg">$4.99 / month</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      <span className="text-lg">or $27.99 yearly (save 53%)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                    <div>• Lane markings (CZ/SK/DE)</div>
                    <div>• One-way arrows</div>
                    <div>• Advanced POI filters</div>
                    <div>• Offline premium maps</div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(PLANS.elite.monthly)}
                    disabled={loading}
                    className="w-full bg-white/20 backdrop-blur-sm px-8 py-4 rounded-xl font-semibold hover:bg-white/30 transition-all text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Choose Monthly'}
                  </button>
                  <button
                    onClick={() => handleSubscribe(PLANS.elite.yearly)}
                    disabled={loading}
                    className="w-full mt-3 bg-white/20 backdrop-blur-sm px-8 py-4 rounded-xl font-semibold hover:bg-white/30 transition-all text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Choose Yearly (Best Value)'}
                  </button>
                </div>
              </div>

              {/* Ultra Plan */}
              <div className="relative bg-gradient-to-r from-emerald-600 to-gray-900 p-6 rounded-2xl text-white border-2 border-emerald-400/30">
                <div className="absolute top-4 right-4 opacity-75">
                  <Gem className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">SpotFinder Ultra</h3>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      <span className="text-lg">$9.99 / month</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      <span className="text-lg">or $49.99 yearly</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                    <div>• Everything in Elite</div>
                    <div>• Live traffic overlays</div>
                    <div>• Unlimited routes</div>
                    <div>• Priority support</div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(PLANS.ultra.monthly)}
                    disabled={loading}
                    className="w-full bg-emerald-400/20 backdrop-blur-sm px-8 py-4 rounded-xl font-semibold hover:bg-emerald-400/30 transition-all text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border border-emerald-400/30 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Choose Monthly'}
                  </button>
                  <button
                    onClick={() => handleSubscribe(PLANS.ultra.yearly)}
                    disabled={loading}
                    className="w-full mt-3 bg-emerald-400/20 backdrop-blur-sm px-8 py-4 rounded-xl font-semibold hover:bg-emerald-400/30 transition-all text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border border-emerald-400/30 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Choose Yearly'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 pt-0 border-t border-gray-200 dark:border-gray-800 flex gap-3">
          <button 
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-6 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

