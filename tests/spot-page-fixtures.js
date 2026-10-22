// Two public spots observed in the live guest UI on 2026-10-22.
// These snapshots are only for local HTTP tests; production reads Firestore.
const spots = {
  AIyFTk1eTE7gD5INyomX: {
    is_public: true, status: 'published', title: 'Blejski grad',
    description: 'A Castle above a lake either a beautiful view across the Bled Lake in Slovenia.',
  },
  K20qivFHwrGzBgBoYZW2: {
    is_public: true, status: 'published', title: 'Hlavatice',
    description: 'Rozhlédna Hlavatice - skalní rozhledna. 10/10',
  },
  hiddenFixture: { is_public: true, status: 'published', discovery_state: 'hidden', title: 'Hidden fixture' },
  draftFixture: { is_public: false, status: 'draft', title: 'Draft fixture' },
  pendingFixture: { is_public: true, status: 'pending_trust', title: 'Pending fixture' },
  sensitiveFixture: { is_public: true, status: 'published', sensitive_location: true, title: 'Sensitive fixture', lat: 50, lng: 14 },
  specialFixture: { is_public: true, status: 'published', title: '<example> & "quoted text"', description: '<example> & "quoted text"' },
  photoFixture: {
    is_public: true, status: 'published', title: 'Photo fixture',
    image_urls: ['https://example.test/private.jpg', 'https://example.test/public.jpg'],
    photo_metadata: [
      { url: 'https://example.test/private.jpg', is_private: true, source: 'user_upload' },
      { url: 'https://example.test/public.jpg', source: 'user_upload' },
    ],
  },
};

export async function getSpotPageFixture(id) {
  if (id === 'failureFixture') throw new Error('Simulated backend failure');
  return spots[id] || null;
}
