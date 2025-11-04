# Deployment — Hostinger

## Prerequisites

1. **Hostinger hosting account** with access to:
   - File Manager or FTP/SFTP
   - hPanel (control panel)

2. **Environment variables setup**:
   - Create `.env.production` from `.env.production.example`
   - Fill in your values:
     - `VITE_SUPABASE_URL` (already set)
     - `VITE_SUPABASE_ANON_KEY` (already set)
     - `VITE_MAPBOX_TOKEN` (get from https://mapbox.com)

3. **Supabase configuration**:
   - In Supabase → Authentication → URL Configuration
   - Add your Hostinger domain to **Redirect URLs**:
     - `https://yourdomain.com/**`
     - For password reset: `https://yourdomain.com/auth/update-password`

## Build Locally

```bash
# Create production env file
cp .env.production.example .env.production

# Edit .env.production with your Mapbox token
# VITE_MAPBOX_TOKEN=your_token_here

# Build the project
npm run build
```

This creates a `dist` folder with your production build.

## Deploy to Hostinger

### Option 1: File Manager (Recommended for beginners)

1. Log in to **hPanel**
2. Go to **File Manager**
3. Navigate to `public_html` (or your domain's root folder)
4. **Delete default files** (index.html, etc.)
5. **Upload all contents** from your `dist` folder:
   - Select all files inside `dist` folder
   - Upload to `public_html`
6. **Upload `.htaccess`** from project root to `public_html`

### Option 2: FTP/SFTP (Recommended for developers)

1. Get FTP credentials from hPanel → **FTP Accounts**
2. Use FileZilla or similar FTP client
3. Connect to your Hostinger server
4. Navigate to `public_html`
5. Upload all contents from `dist` folder
6. Upload `.htaccess` file

### Option 3: Git Deployment (Advanced)

1. In hPanel, go to **Git**
2. Connect your GitHub repository
3. Set deployment path to `public_html`
4. Add build command: `npm run build && cp -r dist/* . && cp .htaccess .`
5. Enable auto-deploy on push

## Verify Deployment

1. Visit your domain: `https://yourdomain.com`
2. Landing page should load
3. Navigate to `/auth/login` → complete auth → `/dashboard`
4. **Refresh on `/dashboard`** should work (SPA routing via `.htaccess`)
5. Visit `/status` to verify Supabase + Mapbox

## Troubleshooting

### 404 errors on refresh
- Ensure `.htaccess` is in `public_html`
- Check if mod_rewrite is enabled (usually enabled on Hostinger)
- Contact Hostinger support if needed

### Map not showing
- Verify `VITE_MAPBOX_TOKEN` in `.env.production` before build
- Rebuild and redeploy

### Auth not working
- Check Redirect URLs in Supabase match your domain
- Clear browser cache
- Check browser console for CORS errors

## Updates

To deploy updates:
1. Make changes locally
2. Run `npm run build`
3. Upload new `dist` contents to `public_html`
4. Clear browser cache

## Notes

- The Supabase anon key is safe for client use (RLS policies protect data)
- `.htaccess` handles SPA routing on Apache servers
- Hostinger uses Apache by default
- Environment variables are embedded at build time
