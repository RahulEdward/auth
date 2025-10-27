# Landing Page - Enterprise Auth System

Modern, responsive landing page built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- **Hero Section**: Eye-catching gradient hero with clear CTAs
- **Features Section**: 6 key features with icons and descriptions
- **How It Works**: Step-by-step integration guide with code examples
- **Pricing Section**: 4 pricing tiers with feature comparison
- **Testimonials**: Customer reviews and success metrics
- **FAQ Section**: Interactive accordion with common questions
- **Footer**: Complete navigation and social links
- **SEO Optimized**: Meta tags, Open Graph, and semantic HTML
- **Fully Responsive**: Works perfectly on all devices

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code linting

## Getting Started

### Development

```bash
cd services/landing-page
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page.

### Build for Production

```bash
npm run build
npm start
```

### Static Export

```bash
npm run build
# The static files will be in the 'out' directory
```

## Project Structure

```
app/
├── layout.tsx          # Root layout with SEO metadata
├── page.tsx            # Home page
└── globals.css         # Global styles

components/
├── Hero.tsx            # Hero section
├── Features.tsx        # Features grid
├── HowItWorks.tsx      # Integration steps
├── Pricing.tsx         # Pricing tiers
├── Testimonials.tsx    # Customer testimonials
├── FAQ.tsx             # FAQ accordion
└── Footer.tsx          # Footer with links
```

## Sections

### Hero Section
- Gradient background
- Clear value proposition
- Two CTAs (Start Free Trial, View Features)
- Trust indicators (no credit card, 14-day trial, cancel anytime)

### Features Section
- 6 feature cards with icons
- Multi-Factor Authentication
- OAuth Social Login
- Role-Based Access Control
- Session Management
- Subscription Management
- Enterprise Security

### How It Works
- 3-step integration process
- Code examples for each step
- Alternating layout for visual interest

### Pricing Section
- 4 pricing tiers (Free, Starter, Professional, Enterprise)
- Feature comparison
- Highlighted "Most Popular" plan
- Clear CTAs for each tier

### Testimonials
- 3 customer testimonials
- 4 key metrics (users, uptime, response time, support)
- Star ratings

### FAQ Section
- 8 common questions
- Interactive accordion
- Contact support link

### Footer
- Company info
- Product links
- Resources links
- Legal links
- Social media icons

## SEO Features

- Semantic HTML structure
- Meta tags (title, description, keywords)
- Open Graph tags for social sharing
- Smooth scroll behavior
- Accessible navigation
- Fast loading times

## Customization

### Colors
The landing page uses a blue/purple gradient theme. To customize:

1. Update Tailwind colors in `tailwind.config.ts`
2. Modify gradient in Hero component
3. Update button colors throughout components

### Content
All content is in the component files. Update:

- Hero text in `components/Hero.tsx`
- Features in `components/Features.tsx`
- Pricing tiers in `components/Pricing.tsx`
- Testimonials in `components/Testimonials.tsx`
- FAQ items in `components/FAQ.tsx`

### Metadata
Update SEO metadata in `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Your Title",
  description: "Your Description",
  // ...
};
```

## Deployment

### Vercel (Recommended)
```bash
vercel
```

### Other Platforms
Build the static site:
```bash
npm run build
```

Deploy the `.next` directory to any static hosting service:
- Netlify
- AWS S3 + CloudFront
- GitHub Pages
- Cloudflare Pages

## Performance

- Server-side rendering with Next.js
- Optimized images with Next.js Image component
- Minimal JavaScript bundle
- Tailwind CSS purging for small CSS files
- Fast page loads (< 1s)

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus states
- Color contrast compliance
- Screen reader friendly

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## License

MIT
