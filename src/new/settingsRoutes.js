export function isSettingsRoute(value) {
  return typeof value === 'string' && value.startsWith('/new/settings/');
}

export function settingsBackRoute(pathname, state) {
  if (typeof pathname !== 'string') return '/new/profile';
  const [, , , subsection, detail] = pathname.split('/');
  if (!subsection) return '/new/profile';
  if (subsection === 'account') return detail ? '/new/settings/account' : '/new/settings';

  const legalReturn = state?.legalReturnTo;
  if (subsection === 'legal' && typeof legalReturn === 'string' && legalReturn.startsWith('/new/') && legalReturn !== pathname) return legalReturn;

  const settingsParent = state?.settingsParent;
  if (settingsParent === '/new/profile') return settingsParent;
  if (detail && isSettingsRoute(settingsParent) && settingsParent !== pathname) return settingsParent;
  return '/new/settings';
}
