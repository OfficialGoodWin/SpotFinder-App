let pendingSignOut = null;

// All sign-out entry points share one Firebase operation. A rejected sign-out
// remains a rejection so callers cannot present a logged-out state as success.
export async function signOutOnce(auth, signOut) {
  if (pendingSignOut) return pendingSignOut;
  const operation = Promise.resolve().then(() => signOut(auth));
  pendingSignOut = operation;
  try { return await operation; }
  finally { if (pendingSignOut === operation) pendingSignOut = null; }
}
