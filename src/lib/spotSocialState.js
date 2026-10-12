export function setSpotRelationState(state, relation, active) {
  const isLike = relation === 'like';
  const flag = isLike ? 'liked' : 'saved';
  const count = isLike ? 'likesCount' : 'savesCount';
  const wasActive = Boolean(state?.[flag]);
  if (wasActive === Boolean(active)) return { ...state };
  return {
    ...state,
    [flag]: Boolean(active),
    [count]: Math.max(0, Number(state?.[count] || 0) + (active ? 1 : -1)),
  };
}
