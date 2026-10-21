# SpotFinder Journal authoring and publication

The public Journal lives at `/news`. Direct visits use prerendered HTML. The five records in `content/news/` are **draft outlines**, not finished articles. They contain planning notes and are absent from the published bundle, generated pages, and sitemap.

## Write and review an article

1. Copy a JSON record in `content/news/` or edit one of the five drafts. This is the static content format; `body` is an ordered array of `paragraph`, `heading`, `list`, and `image` blocks. Text is rendered as text by React. Raw HTML is unsupported.
2. Write useful, checked content. Replace every outline and checklist with the final article. Confirm place access, travel details, and the actual release or collaboration facts. Record source notes in the editorial review outside the public article file.
3. Obtain a written license or permission for an authentic cover photograph. Place an optimized image under `public/news-images/` and set `cover.src`, `width`, `height`, `alt`, and optional `caption`. Responsive alternatives may be listed in `srcSet` and `sizes`. All image URLs must point to local, licensed files.
4. Confirm the real author name and whether it is a `Person` or `Organization`. Set `publishedAt` to the actual publication date in `YYYY-MM-DD` format. Set `updatedAt` only when a real update is made.
5. Set `canonicalUrl` to `https://spot-finder-app.vercel.app/news/<slug>` for English or `https://spot-finder-app.vercel.app/news/cs/<slug>` for Czech. A Czech variant must be separately written and reviewed. Use the same slug across languages only if the two records are true translations. Article hreflang is emitted only when both variants are published. A Czech Journal landing is generated only when Czech articles exist.
6. Add `spotIds` only for confirmed public SpotFinder places. Each entry is `{ "id": "real-public-id", "name": "Verified place name" }`. Open every generated `/spot/<id>` link before publishing. A draft may leave the array empty.
7. After owner approval, change `status` to `published`, run `npm run build`, review the generated article and sitemap, then deploy through the normal release process. Revert to `draft` and redeploy to remove an article from the public site.

The build rejects published records with missing required fields, invalid dates, missing cover files, an unexpected canonical, draft outline markers, or malformed spot IDs. Human review is still needed for factual accuracy, permissions, authorship, and spot availability.

## SEO and routing

`scripts/news/prepare.mjs` creates `src/news/published.generated.json` from approved published records. Draft text is not included in public JavaScript. Vite builds a small Journal entry alongside the existing SPA. `scripts/news/prerender.mjs` writes `dist/news.html` and one `dist/news/<slug>.html` (or `dist/news/cs/<slug>.html`) per published article. Each file contains rendered article text, title, description, canonical, share tags, dates, and JSON-LD. It also writes `dist/sitemap.xml` from published records.

Vercel `cleanUrls` serves those files at extensionless URLs. The SPA rewrite excludes `/news` and its children, so a missing or draft slug returns the host's real 404. It also excludes `/assets` and paths with file extensions, preserving missing-asset 404s. The existing map and `/spot/:id` route still use the SPA. The service worker only caches `/` as the map shell after a successful map navigation.

The canonical production host is the production URL supplied for this project: `https://spot-finder-app.vercel.app`. Review this setting if the deployment's primary domain changes; update `src/lib/spotLinks.js`, `scripts/news/prepare.mjs`, `scripts/news/prerender.mjs`, `index.html`, `public/robots.txt`, and the source sitemap together.

## Search Console after deployment

1. Verify the `https://spot-finder-app.vercel.app/` property in Google Search Console.
2. Open `https://spot-finder-app.vercel.app/sitemap.xml` and confirm it is reachable and includes only intended URLs.
3. In Search Console, open **Sitemaps**, enter `sitemap.xml`, and submit. Check the report for fetch or parsing errors.
4. Inspect a published article URL using URL Inspection and test its live page. Use Google's Rich Results Test to inspect article markup.

Submitting a sitemap requests discovery; it does not guarantee indexing or traffic. No Google News sitemap is generated. See the [Search Console Sitemaps report](https://support.google.com/webmasters/answer/7451001) and [Google's Article structured data guide](https://developers.google.com/search/docs/appearance/structured-data/article).

## Production checks before a release

- Open `/news` and a published `/news/<slug>` directly and refresh each.
- View page source with JavaScript disabled: headline, article body, canonical, share tags, and JSON-LD must be present.
- Open a draft or unknown slug: expect HTTP 404. Open an intentionally missing `/assets/*.js`: expect HTTP 404 and no HTML body.
- Check mobile widths around 320, 375, and 390 pixels in light and dark themes.
- Follow every article spot link and verify it opens the intended public place; return to the map and confirm map controls and existing shared links still work.
- Compare the sitemap with the approved publication list and check `robots.txt`.
