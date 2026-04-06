

## Plan: New Play Console Listing with `app.fleettrackmate.driver`

### What's happening
Your existing Play Console listing uses the old Lovable default package ID (`app.lovable.d78756af...`). Since package IDs can't be changed, you need to create a brand-new app listing for `app.fleettrackmate.driver`.

### Steps

**1. Create New App in Play Console**
- Go to **Google Play Console → All apps → Create app**
- Fill in: App name = "FleetTrackMate Driver", language, app/game, free/paid
- Accept declarations → **Create app**

**2. Fix versionCode (if needed)**
Since this is a brand-new listing, `versionCode 1` is fine. But verify in your local Android Studio project:
- Open `android/app/build.gradle` → confirm `versionCode` is `1` and `versionName` is `"1.0"`

**3. Sign & Build AAB**
- **Build → Generate Signed Bundle / APK → Android App Bundle**
- Keystore: `C:\Users\PC\fleettrackmate`
- Alias: `key0`
- Enter your password carefully
- Select **release** → Finish

**4. Upload AAB to New Listing**
- In the new app listing: **Production → Create new release → Upload** the AAB
- The package ID `app.fleettrackmate.driver` will now match

**5. Complete Store Listing**
Fill in required sections before submitting for review:
- **Main store listing**: Title, short/full description, screenshots, icon
- **Content rating**: Complete questionnaire
- **Pricing & distribution**: Select countries
- **App content**: Privacy policy URL, ads declaration, target audience
- **Background location declaration**: Use the justification text you prepared earlier

**6. (Optional) Unpublish Old Listing**
Once the new listing is live, you can unpublish or deactivate the old `app.lovable...` listing if it was ever published.

### Important Notes
- Your keystore file and signing key stay the same — no changes needed there
- All your compliance materials (background location video, privacy policy, etc.) can be reused
- The old listing's reviews/installs won't transfer — this is a fresh start

