

# Fix Google Search Console Indexing Issues

The screenshot shows 3 problems in Google Search Console:
- **Blocked by robots.txt** (2 pages) -- Google found pages via internal links (likely `/auth/forgot` and `/auth/update-password`) but they're blocked
- **Page with redirect** (1 page) -- The `/auth` route redirects to `/auth/login`, confusing Google
- **Discovered but not indexed** (5 pages) -- Google hasn't crawled your public pages yet, partly because `Crawl-delay: 1` is slowing it down

## Changes

### 1. Clean up `robots.txt`
- Remove `Crawl-delay: 1` -- this tells crawlers to wait 1 second between requests, slowing indexing significantly. Google largely ignores it, but Bing/others respect it. Remove it to speed up crawling.
- Remove individual `Allow` lines (redundant since `Allow: /` already permits everything not explicitly disallowed)
- Keep all `Disallow` rules for protected routes

### 2. Fix the redirect issue in `src/App.tsx`
- Remove the `/auth` catch-all redirect route (`<Route path="/auth" element={<Navigate to="/auth/login" replace />} />`) since no internal links should point to `/auth` directly. This eliminates the "Page with redirect" warning.

### 3. Remove demo routes from crawlable paths
- Add `Disallow: /demo/` to `robots.txt` to prevent Google from discovering the background-paths, hero-geometric, and pulse-beams demo pages

## Files to change

| File | Change |
|---|---|
| `public/robots.txt` | Remove `Crawl-delay`, remove redundant `Allow` lines, add `Disallow: /demo/` |
| `src/App.tsx` | Remove the `/auth` redirect route |

## What to do after publishing
1. Go to Google Search Console > Sitemaps and re-submit `https://fleettrackmate.com/sitemap.xml`
2. Use URL Inspection on `https://fleettrackmate.com/` and click "Request Indexing"
3. The "Discovered but not indexed" pages will resolve on their own once Google re-crawls (usually 3-14 days)

