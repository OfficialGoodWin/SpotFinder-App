/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
import FAQ from './pages/FAQ';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { recoverableLazy } from './components/ChunkLoadRecovery';
import Home from './pages/Home';
const FAQ = recoverableLazy(() => import('./pages/FAQ'));
const Status = recoverableLazy(() => import('./pages/Status'));
const StatusAdmin = recoverableLazy(() => import('./pages/StatusAdmin'));
const Admin = recoverableLazy(() => import('./pages/Admin'));
const PrivacyPolicy = recoverableLazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = recoverableLazy(() => import('./pages/TermsAndConditions'));
const CookiePolicy = recoverableLazy(() => import('./pages/CookiePolicy'));
const RefundPolicy = recoverableLazy(() => import('./pages/RefundPolicy'));
const Updates = recoverableLazy(() => import('./pages/Updates'));
import __Layout from './Layout.jsx';
 
 
export const PAGES = {
    "Home": Home,
    "FAQ": FAQ,
    "Status": Status,
    "StatusAdmin": StatusAdmin,
    "Admin": Admin,
    "PrivacyPolicy": PrivacyPolicy,
    "TermsAndConditions": TermsAndConditions,
    "CookiePolicy": CookiePolicy,
    "RefundPolicy": RefundPolicy,
    "updates": Updates,
}
 
export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
