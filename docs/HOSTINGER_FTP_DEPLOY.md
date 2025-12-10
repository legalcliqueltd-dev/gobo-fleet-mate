# Hostinger FTP Deployment via GitHub Actions

Complete guide to automatically deploy your app to Hostinger whenever you push to the `main` branch.

---

## 📋 Pre-Deployment Checklist

### Files Required (Already in Project)
- [x] `.htaccess` - SPA routing & security headers
- [x] `.github/workflows/deploy-hostinger.yml` - GitHub Actions workflow
- [x] `vite.config.ts` - Build configuration
- [x] `index.html` - Entry point with meta tags

### Files to Verify
- [ ] `public/robots.txt` - SEO crawling rules
- [ ] `public/favicon.ico` - Browser tab icon

---

## 🔧 Step 1: Get Hostinger FTP Credentials

1. Log in to [Hostinger hPanel](https://hpanel.hostinger.com)
2. Go to **Files** → **FTP Accounts**
3. Create a new FTP account or use the default one
4. Note down these details:
   - **FTP Server/Host**: Usually `ftp.yourdomain.com` or the IP address shown
   - **FTP Username**: Your FTP username (e.g., `u123456789`)
   - **FTP Password**: Your FTP password
   - **Server Directory**: Usually `/public_html/` or `/domains/yourdomain.com/public_html/`

> ⚠️ **Important**: The server directory MUST end with a trailing slash `/`

---

## 🔐 Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

| Secret Name | Example Value | Description |
|-------------|---------------|-------------|
| `FTP_SERVER` | `ftp.yourdomain.com` | Hostinger FTP server address |
| `FTP_USERNAME` | `u123456789` | Your FTP username |
| `FTP_PASSWORD` | `your_ftp_password` | Your FTP password |
| `FTP_SERVER_DIR` | `/public_html/` | Target directory (with trailing `/`) |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase anon key |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIzaSy...` | Google Maps API key |

### Finding Your Hostinger FTP Details

**FTP Server**: 
- In hPanel → Files → FTP Accounts → Look for "Hostname" or "Server"
- Format: `ftp.yourdomain.com` or an IP like `31.220.xxx.xxx`

**FTP Username**:
- In hPanel → Files → FTP Accounts → Your username
- Usually starts with `u` followed by numbers

**Server Directory**:
- For main domain: `/public_html/`
- For subdomain: `/public_html/subdomain/` or `/domains/subdomain.yourdomain.com/public_html/`
- For addon domain: `/domains/addondomain.com/public_html/`

---

## 🚀 Step 3: Deploy

### Automatic Deployment
Push to `main` branch:
```bash
git add .
git commit -m "Deploy to Hostinger"
git push origin main
```

### Manual Deployment
1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Hostinger** workflow
4. Click **Run workflow** → **Run workflow**

---

## ✅ Step 4: Verify Deployment

1. Visit your domain: `https://yourdomain.com`
2. Check these pages work:
   - [ ] Landing page (`/`)
   - [ ] Login page (`/auth/login`)
   - [ ] Dashboard (`/dashboard`) - after login
   - [ ] Refresh on any page - should NOT show 404
3. Check status page: `https://yourdomain.com/status`

---

## 🔧 Troubleshooting

### 404 Errors on Page Refresh
- Verify `.htaccess` was uploaded to `public_html`
- Check if `mod_rewrite` is enabled (usually is on Hostinger)
- In hPanel → Advanced → Apache Configuration

### FTP Connection Failed
- Double-check FTP credentials in GitHub Secrets
- Ensure no extra spaces in secret values
- Try using the IP address instead of domain for FTP_SERVER
- Check if FTP is enabled in hPanel

### Build Fails
- Check GitHub Actions logs for specific errors
- Verify all environment secrets are set correctly
- Ensure VITE_ prefix is used for all env variables

### Map Not Showing
- Verify `VITE_GOOGLE_MAPS_API_KEY` is set in GitHub Secrets
- Check Google Cloud Console for API restrictions

### Deployment Succeeded but Old Version Shows
- Clear browser cache (Ctrl+Shift+R)
- Wait 1-2 minutes for CDN propagation
- Check if correct directory is set in FTP_SERVER_DIR

---

## 📁 What Gets Deployed

The workflow deploys the contents of the `dist/` folder:

```
dist/
├── index.html          # Main entry point
├── .htaccess           # SPA routing rules
├── assets/
│   ├── index-xxx.js    # Bundled JavaScript
│   └── index-xxx.css   # Bundled CSS
├── robots.txt          # SEO rules
└── favicon.ico         # Browser icon
```

---

## 🔄 Workflow Details

The GitHub Action performs these steps:

1. **Checkout** - Gets your code from GitHub
2. **Setup Node.js** - Installs Node.js 20
3. **Install dependencies** - Runs `npm ci`
4. **Build** - Runs `npm run build` with env variables
5. **Copy .htaccess** - Copies .htaccess to dist folder
6. **FTP Deploy** - Uploads dist/ contents to Hostinger

---

## 🛡️ Security Notes

- FTP credentials are stored as encrypted GitHub Secrets
- Secrets are never logged or exposed in workflow output
- Supabase anon key is safe for client use (RLS protects data)
- Consider using SFTP if available on your Hostinger plan

---

## 📱 Supabase Configuration

Ensure your production domain is added to Supabase:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   - `https://yourdomain.com/**`
   - `https://yourdomain.com/auth/update-password`

---

## 🔗 Useful Links

- [Hostinger FTP Guide](https://support.hostinger.com/en/articles/1583579-how-to-connect-to-ftp)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [FTP Deploy Action](https://github.com/SamKirkland/FTP-Deploy-Action)
