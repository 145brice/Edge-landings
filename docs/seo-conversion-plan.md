# SEO & Conversion Optimization Plan

## Homepage (`public/index.html`)
- [ ] Refine hero content for keyword alignment (local business website design, 24-hour build).
- [x] Add trust indicators near primary CTA.
- [x] Ensure hero buttons have aria labels and consistent analytics attributes.
- [ ] Compress/host hero imagery locally and lazy-load secondary visuals.
- [ ] Add structured data for LocalBusiness (pending business address confirmation).

## Pricing Page (`public/pricing.html`)
- [x] Replace tiers with three monthly subscription plans.
- [x] Add FAQ / objection handling section beneath plans.
- [x] Surface testimonials closer to CTAs for social proof.
- [ ] Embed structured data for Offers.
- [x] Optimize meta title/description with subscription keywords.

## Signup Page (`public/signup.html`)
- [x] Add microcopy reinforcing security/trust near the form.
- [ ] Implement form analytics hooks.
- [x] Provide password guidance via `aria-describedby`.
- [ ] Add schema for WebApplication signup flow (optional).

## Login Page (`login.html`)
- [x] Mirror trust/security messaging from signup page.
- [x] Ensure form labels and error handling are fully accessible.
- [x] Add link back to pricing for users evaluating plans.

## Global
- [ ] Introduce shared stylesheet for reusable components (buttons, trust badges).
- [ ] Audit color contrast for WCAG AA compliance, especially hover states.
- [ ] Add `sitemap.xml` and basic robots directives.
- [ ] Consider `preconnect`/`dns-prefetch` to CDN or third-party services in use.
- [ ] Review performance metrics (Lighthouse) after visual updates.

