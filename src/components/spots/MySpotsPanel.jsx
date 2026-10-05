import React, { useEffect, useState } from 'react';
import { X, MapPin, Heart, Bookmark, PlusCircle, Trash2, Eye } from 'lucide-react';
import { getUserSpots, getSavedSpots, getLikedSpots, deleteSpot as firebaseDeleteSpot } from '@/api/firebaseClient';

const tabs = [
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'created', label: 'Created', icon: PlusCircle },
  { id: 'liked', label: 'Liked', icon: Heart },
];

export default function MySpotsPanel({ user, onClose, onFlyTo }) {
  const [tab, setTab] = useState('saved');
  const [data, setData] = useState({ saved: [], created: [], liked: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [saved, created, liked] = await Promise.all([
        getSavedSpots(user.id, 100),
        getUserSpots(user.email, 100),
        getLikedSpots(user.id, 100),
      ]);
      setData({ saved, created, liked });
    } catch (e) { console.error('My Spots load failed', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);

  const spots = data[tab] || [];
  const handleDelete = async (id) => {
    if (!confirm('Delete this spot permanently?')) return;
    await firebaseDeleteSpot(id);
    setData(v => ({ ...v, created: v.created.filter(s => s.id !== id), saved: v.saved.filter(s => s.id !== id), liked: v.liked.filter(s => s.id !== id) }));
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-xl font-bold text-gray-900 dark:text-foreground">My Spots</h2><p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Places you've kept, created, or liked.</p></div>
            <button onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-gray-100 dark:hover:bg-accent" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-3 bg-gray-100 dark:bg-accent/70 p-1 rounded-xl">
            {tabs.map(({id,label,icon:Icon}) => <button key={id} onClick={() => setTab(id)} className={`min-h-[40px] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold transition ${tab===id ? 'bg-white dark:bg-card shadow-sm text-gray-900 dark:text-foreground' : 'text-gray-500 dark:text-muted-foreground'}`}><Icon className="w-4 h-4" />{label}<span className="text-[11px] opacity-60">{data[id].length}</span></button>)}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4" style={{paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
          {loading ? <div className="grid sm:grid-cols-2 gap-3">{[1,2,3,4].map(x=><div key={x} className="h-28 rounded-2xl bg-gray-100 dark:bg-accent animate-pulse" />)}</div> : spots.length === 0 ? (
            <div className="min-h-64 grid place-items-center text-center px-8"><div><div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-accent grid place-items-center mx-auto mb-3">{tab==='saved'?<Bookmark className="w-6 h-6 text-gray-400"/>:tab==='liked'?<Heart className="w-6 h-6 text-gray-400"/>:<MapPin className="w-6 h-6 text-gray-400"/>}</div><p className="font-semibold">No {tab} spots yet</p><p className="text-sm text-gray-500 mt-1">{tab==='saved'?'Save places you want to come back to.':tab==='liked'?'Like a spot and it will appear here.':'Add a spot to start your collection.'}</p></div></div>
          ) : <div className="grid sm:grid-cols-2 gap-3">{spots.map(spot => (
            <article key={spot.id} className="group rounded-2xl border border-gray-200 dark:border-border bg-white dark:bg-card overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex min-h-[112px]">
                <div className="w-28 bg-gray-100 dark:bg-accent shrink-0">{spot.image_url?<img src={spot.image_url} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center"><MapPin className="w-6 h-6 text-gray-300"/></div>}</div>
                <div className="p-3 min-w-0 flex-1 flex flex-col"><h3 className="font-semibold truncate">{spot.title || 'Spot'}</h3><p className="text-xs text-gray-500 line-clamp-2 mt-1 flex-1">{spot.description || 'No description'}</p><div className="flex items-center gap-3 text-xs text-gray-500 mt-2"><span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5"/>{spot.likes_count||0}</span><span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5"/>{spot.saves_count||0}</span></div></div>
              </div>
              <div className="border-t border-gray-100 dark:border-border flex"><button onClick={()=>{onFlyTo([spot.lat,spot.lng]);onClose();}} className="flex-1 min-h-[42px] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-accent"><Eye className="w-4 h-4"/>View</button>{tab==='created'&&<button onClick={()=>handleDelete(spot.id)} className="w-12 min-h-[42px] grid place-items-center text-red-500 border-l border-gray-100 dark:border-border hover:bg-red-50 dark:hover:bg-red-950/20" aria-label="Delete"><Trash2 className="w-4 h-4"/></button>}</div>
            </article>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}
