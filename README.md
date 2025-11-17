# Subscribely Website - GitHub Pages Deployment

This branch contains the static website files for **Subscribely** and is specifically configured for GitHub Pages deployment.

## 📁 Branch Structure

This `gh-pages` branch contains only the static website files at the root level:

```
(root)
├── index.html          # Landing page
├── features.html       # Features page
├── pricing.html        # Pricing page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── support.html        # Support page
├── css/
│   └── styles.css     # Main stylesheet
├── js/
│   └── script.js      # JavaScript functionality
├── .nojekyll          # Prevents Jekyll processing
└── README.md          # This file
```

## 🚀 Deployment Instructions

### 1. Push this branch to GitHub:

```bash
git push origin gh-pages
```

### 2. Activate GitHub Pages:

1. Go to your repository on GitHub
2. Click **Settings** > **Pages** (in the left sidebar)
3. Under **Source**, select:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
4. Click **Save**

### 3. Wait for deployment:

GitHub Pages typically takes 1-3 minutes to build and deploy your site. You'll see a notification at the top of the Pages settings when it's ready.

## 🌐 Your Website URL

After activation, your website will be available at:

```
https://<your-username>.github.io/<repository-name>/
```

For example:
- `https://yourusername.github.io/smart-subscription-tracker/`

## 🎨 Custom Domain (Optional)

To use a custom domain:

1. Create a `CNAME` file in the root with your domain:
   ```
   www.yoursubscribely.com
   ```

2. Configure DNS settings with your domain provider:
   - Add a CNAME record pointing to `<your-username>.github.io`
   - Or use GitHub's IP addresses for an apex domain

3. In GitHub Pages settings, enter your custom domain and enable HTTPS

## 🔄 Updating the Website

To update the website:

1. Make changes to files in the `website/` directory on the `main` branch
2. Switch to the `gh-pages` branch
3. Copy updated files from `main` branch:
   ```bash
   git checkout gh-pages
   git checkout main -- website/
   mv website/* .
   mv website/css .
   mv website/js .
   rm -rf website
   git add .
   git commit -m "Update website content"
   git push origin gh-pages
   ```

## 📝 Notes

- The `.nojekyll` file is critical - it tells GitHub Pages to serve files as-is without Jekyll processing
- This branch should contain ONLY website files, not the React Native app code
- Changes typically take 1-3 minutes to appear after pushing
- The main application code remains on the `main` branch

## 🛠 Troubleshooting

**Site not loading?**
- Verify the branch and folder settings in GitHub Pages settings
- Check that `.nojekyll` file exists
- Wait a few minutes for GitHub's CDN to update
- Check the Actions tab for any build errors

**CSS/JS not loading?**
- Ensure all paths in HTML files are relative (not absolute)
- Check browser console for 404 errors
- Verify file names match exactly (case-sensitive)

**Need help?**
- GitHub Pages Documentation: https://docs.github.com/pages
- Check repository Actions tab for deployment status

---

**Branch Purpose:** This branch is dedicated to GitHub Pages deployment and should not contain application code.

**Main Branch:** For the React Native application code, see the `main` branch.