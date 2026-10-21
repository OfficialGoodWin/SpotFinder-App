// Generated before each build; drafts never enter the client bundle.
import publishedArticles from './published.generated.json';

export { publishedArticles };
export const articleBySlug = slug => publishedArticles.find(article => article.slug === slug);
export const categories = ['Discover Places', 'Guides', 'SpotFinder Updates', 'Community Stories'];
