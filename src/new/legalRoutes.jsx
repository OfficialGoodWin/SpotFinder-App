import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const NEW_LEGAL_ROUTES = Object.freeze({
  '/TermsAndConditions': '/new/settings/legal/terms',
  '/PrivacyPolicy': '/new/settings/legal/privacy',
  '/CookiePolicy': '/new/settings/legal/cookies',
  '/RefundPolicy': '/new/settings/legal/refunds',
});

export function newLegalRoute(productionPath) {
  return NEW_LEGAL_ROUTES[productionPath] || null;
}

export function NewLegalLink({ document, children, ...props }) {
  const location = useLocation();
  return <Link to={newLegalRoute(document)} state={{ legalReturnTo: location.pathname }} {...props}>{children}</Link>;
}
