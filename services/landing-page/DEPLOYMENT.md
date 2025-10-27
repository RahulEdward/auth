# Deploying Landing Page to Vercel

## Quick Deploy

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Deploy from landing-page directory:**
```bash
cd services/landing-page
vercel
```

4. **Follow the prompts:**
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? **enterprise-auth-landing** (or your choice)
   - Directory? **./services/landing-page**
   - Override settings? **N**

5. **Deploy to production:**
```bash
vercel --prod
```

### Option 2: Vercel Dashboard (Git Integration)

1. **Push to GitHub:**
```bash
git add .
git commit -m "Add landing page"
git push origin main
```

2. **Import on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your Git repository
   - **Root Directory:** `services/landing-page`
   - **Framework Preset:** Next.js
   - Click "Deploy"

## Configuration

### Environment Variables (Optional)

If you need to configure API URLs:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

Add in Vercel Dashboard:
- Go to Project Settings
- Navigate to Environment Variables
- Add your variables

## Custom Domain

1. Go to your project on Vercel
2. Navigate to Settings → Domains
3. Add your custom domain
4. Follow DNS configuration instructions

## Build Settings

Vercel automatically detects Next.js and uses:
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Development Command:** `npm run dev`

## Deployment URL

After deployment, you'll get:
- **Preview URL:** `https://your-project-xxx.vercel.app`
- **Production URL:** `https://your-project.vercel.app`

## Automatic Deployments

Once connected to Git:
- **Every push to main** → Production deployment
- **Every pull request** → Preview deployment

## Troubleshooting

### Build Fails

Check build logs in Vercel dashboard. Common issues:
- Missing dependencies: Run `npm install` locally first
- TypeScript errors: Run `npm run build` locally to test
- Environment variables: Ensure all required vars are set

### Tailwind Not Working

Ensure these files exist:
- `tailwind.config.ts`
- `postcss.config.mjs`
- `app/globals.css` with Tailwind imports

### Performance

Vercel automatically optimizes:
- Image optimization
- Edge caching
- Automatic HTTPS
- Global CDN

## Monitoring

View deployment analytics:
- Go to your project dashboard
- Check Analytics tab
- Monitor performance and traffic

## Rollback

If needed, rollback to previous deployment:
1. Go to Deployments tab
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Support](https://vercel.com/support)
