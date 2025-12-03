# Security Setup Guide

## ⚠️ IMPORTANT: Protecting Your API Keys

Your API keys are currently exposed in your GitHub repository. Follow these steps to secure them:

## Step 1: Remove config.js from Git History

If you've already committed `config.js` to GitHub, you need to remove it from the repository history:

```bash
# Remove config.js from Git tracking (but keep the local file)
git rm --cached config.js

# Commit the removal
git commit -m "Remove config.js from repository"

# Push to GitHub
git push origin main
```

## Step 2: Revoke Exposed API Keys

**CRITICAL:** The API keys that were exposed need to be revoked and replaced:

### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Delete the exposed API key
3. Create a new API key
4. Update your local `config.js` with the new key

### TMDB API Key
1. Go to [TMDB Settings](https://www.themoviedb.org/settings/api)
2. Regenerate your API key
3. Update your local `config.js` with the new key

### Firebase Config
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Project Settings > General
3. Rotate your API keys if needed

## Step 3: Set Up Local Configuration

1. Copy the example config:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` with your actual API keys (this file is now gitignored)

## Step 4: Verify .gitignore is Working

```bash
# Check that config.js is ignored
git status

# You should NOT see config.js in the list
```

## Step 5: For Production Deployment

For production (e.g., Firebase Hosting, Vercel, Netlify):

1. Use environment variables instead of config.js
2. Set API keys in your hosting platform's environment settings
3. Never commit actual API keys to the repository

## ✅ Checklist

- [ ] Removed `config.js` from Git tracking
- [ ] Revoked exposed Gemini API key
- [ ] Revoked exposed TMDB API key  
- [ ] Created new API keys
- [ ] Updated local `config.js` with new keys
- [ ] Verified `.gitignore` is working
- [ ] Pushed changes to GitHub

## 🔒 Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for production
3. **Rotate keys regularly** as a security practice
4. **Restrict API key permissions** where possible
5. **Monitor API usage** for suspicious activity

---

**Need Help?** Check the [Firebase Security Guide](https://firebase.google.com/docs/projects/api-keys) and [TMDB API Docs](https://developers.themoviedb.org/3/getting-started/introduction)
