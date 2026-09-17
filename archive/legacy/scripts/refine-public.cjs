const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'site');
const edit = (file, transform) => {
  const target = path.join(root, file);
  fs.writeFileSync(target, transform(fs.readFileSync(target, 'utf8')));
};
const footer = '<footer class="site-footer">Edge Landings &middot; Websites for local businesses<br><a href="/templates.html">Concept examples</a><a href="/pricing.html#plan-details">Plan details</a><a href="/contact.html">Contact &amp; support</a></footer>';
for (const file of ['index.html', 'pricing.html', 'templates.html', 'success.html']) {
  edit(file, text => text.replace('</head>', '<link rel="stylesheet" href="/site.css"></head>')
    .replace('</nav>', '<a class="contact-link" href="/contact.html">Contact</a></nav>')
    .replace(/<footer>[\s\S]*?<\/footer>/, '')
    .replace('</body>', footer + '</body>'));
}
edit('index.html', text => text
  .replace(/\.lead-benefits\{[\s\S]*?(?=@media\(max-width:650px\))/, '')
  .replace('.lead-benefits{grid-template-columns:1fr}', '')
  .replace('Basic and Pro-style examples for 9 industries', 'One page or up to five. Clear monthly pricing.')
  .replace('Choose a starting point, then we customize it around your business.', 'First draft within 3 business days of receiving your content. You review it before launch.')
  .replace(/<section class="card lead-benefits">[\s\S]*?<\/aside><\/section>/, '')
  .replace(/<section class="card"><h2>See the possibilities<\/h2>[\s\S]*?<\/section>/, `<section class="card"><p class="section-label">See the work before you choose</p><h2>Three businesses. Three different first impressions.</h2><p>These are self-initiated concept designs, not client projects. The names, reviews, and business claims in the demos are sample content. Each shows how we organize a local business website around a useful next step.</p><div class="showcase">
  <article class="sample"><div class="mini-site mini-auto"><small>Precision Auto Care / concept</small><strong>Clear answers. A car you can count on.</strong><span>Maintenance &nbsp; Repairs &nbsp; Request service</span></div><div class="sample-copy"><h3>Auto repair</h3><p>Service categories and a prominent inquiry form help a driver find the right repair and ask for an estimate.</p><a href="/auto-basic.html">Explore the auto concept &rarr;</a></div></article>
  <article class="sample"><div class="mini-site mini-bakery"><small>Sweet Dreams Bakery / concept</small><strong>A little sweeter. Baked fresh.</strong><span>Daily menu &nbsp; Opening hours &nbsp; Custom orders</span></div><div class="sample-copy"><h3>Neighborhood bakery</h3><p>A menu, opening hours, and clear contact details answer the questions customers ask before visiting.</p><a href="/bakery-basic.html">Explore the bakery concept &rarr;</a></div></article>
  <article class="sample"><div class="mini-site mini-law"><small>Harbor Legal Group / concept</small><strong>A clear next step starts here.</strong><span>Practice areas &nbsp; About the firm &nbsp; Contact</span></div><div class="sample-copy"><h3>Local law firm</h3><p>Readable practice areas and a simple consultation request make an unfamiliar service easier to navigate.</p><a href="/lawyer-basic.html">Explore the legal concept &rarr;</a></div></article>
  </div><p><a class="button secondary" href="/templates.html">Browse all 18 concept previews</a></p></section>`)
  .replace(/<section class="card"><h2>How it works<\/h2>[\s\S]*?<\/section>/, `<section class="card"><p class="section-label">From first idea to launch</p><h2>You always know what comes next.</h2><div class="grid"><article><h3>1. Choose and introduce</h3><p>Choose Basic or Growth, pay the first month, and complete onboarding. Share your services, contact details, logo, photos, and preferred example. Ask us first if your project needs custom features.</p></article><article><h3>2. Review your draft</h3><p>Once we have your content, your first draft is due within 3 business days. Both plans include two rounds of revisions to the agreed pages before launch.</p></article><article><h3>3. Approve and go live</h3><p>We publish after your approval and domain access. Hosting and your plan's monthly content updates keep the site current. Send requests through our contact page.</p></article></div><p><a class="contact-link" href="/contact.html">Have a question before choosing a plan?</a></p></section>`)
  .replace('Get a practical health score, top issues, quick wins, sampled broken links, mobile and SEO checks, technology detection, and available PageSpeed metrics.', 'Find practical improvements for your current website, including mobile basics, search visibility, and broken links.')
  .replace('Preset scoring · No AI · No email required · Submitted URLs are not stored', 'No email required. Get a practical starting point for improving your website.'));
const faq = `<section class="faq" id="plan-details"><p class="section-label">The details, in plain language</p><h2>Know exactly what is included.</h2>
<details open><summary>How many pages do I get?</summary><p>Basic includes one scrolling page with up to six sections, such as an introduction, services, about, photos, FAQs, and contact. Growth includes up to five pages, such as Home, About, Services, FAQs, and Contact. Both include mobile-friendly styling, secure hosting, one inquiry form, and page titles and descriptions. We customize an existing design with your business content.</p></details>
<details><summary>What counts as one content update?</summary><p>One update is one small change to an existing page: replacing up to 300 words, replacing up to five supplied images in one section, or changing one set of business details such as opening hours. A request to change two separate sections counts as two updates. Basic includes 3 updates per billing month; Growth includes 10. Unused updates do not roll over. Fixes to errors we introduced do not use your allowance.</p></details>
<details><summary>What happens if I need more work?</summary><p>Additional small updates are $25 each on Basic or $20 each on Growth. We confirm the count and cost with you before doing paid extras. New pages, a redesign, original photography, extensive copywriting, online stores, customer accounts, and custom booking systems are separate projects quoted before work starts. Booking links to a service you already use can be included; that provider's fees are separate.</p></details>
<details><summary>What do I supply, and when will it be ready?</summary><p>Supply your business details, services, logo if you have one, text, photos you have permission to use, and access needed to connect your domain. We format and lightly edit your supplied copy. Your first draft is due within 3 business days after we receive the required content. Both plans include two consolidated rounds of revisions to the agreed scope before launch. The final launch date depends on your feedback, approval, and domain access.</p></details>
<details><summary>How do updates and support work?</summary><p>Use the contact page or reply to your onboarding email. Our response target is within 2 business days for Basic and 1 business day for Growth, Monday through Friday excluding holidays. Small content updates are normally completed within 3 business days after we have the materials; we confirm timing for larger requests. Priority support means a faster response target, not 24/7 coverage.</p></details>
<details><summary>What does Growth's SEO support include?</summary><p>Growth includes a monthly review of page titles, descriptions, headings, and internal links, with appropriate on-page improvements. It also includes Google Business Profile setup or cleanup where your business is eligible, Analytics and Search Console setup with your access, and a monthly summary of available traffic and search data. Search rankings, traffic, leads, and Google verification are not guaranteed. Paid advertising and ongoing article writing are separate.</p></details>
<details><summary>When am I charged, and how do I cancel?</summary><p>The first monthly payment is collected at checkout, before work starts. There is no separate setup fee for the stated scope. Plans renew monthly. To stop renewal, send a cancellation request through our contact page before your next billing date, using the email from checkout. We confirm cancellation by email. Hosting continues through the paid billing period and ends afterward; arrange replacement hosting before then if you want the site to stay online.</p></details>
<details><summary>What about my domain and business content?</summary><p>Your domain stays in your own registrar account, and you retain your supplied text, logo, and photos. Domain registration, domain renewals, business email, and third-party subscriptions are paid separately by you. Ask us about a copy of your static site files before cancellation; third-party tools and licenses may not transfer.</p></details>
<p>Need something outside this scope? <a href="/contact.html">Tell us what you have in mind before checkout.</a></p></section>`;
edit('pricing.html', text => text
  .replace('<li>Professionally designed website</li>', '<li>One scrolling page with up to 6 sections</li>')
  .replace('<li>Professionally designed website</li>', '<li>Up to 5 pages customized for your business</li>')
  .replace('<li>Everything included in Basic</li>', '<li>All Basic essentials, with a larger page allowance</li>')
  .replace('<li>Priority support</li>', '<li>Priority support: 1-business-day response target</li>')
  .replace('<li>Basic SEO</li>', '<li>Page titles, descriptions, and clear headings</li><li>2-business-day support response target</li>')
  .replace('</main>', faq + '</main>')
  .replace('After checkout, you will complete a short onboarding form so we can begin your site.', 'Your first month is charged at checkout. Complete onboarding next; your first draft is due within 3 business days after we receive the required content. Two pre-launch revision rounds are included.'));
edit('templates.html', text => text
  .replace('Compare the streamlined Basic experience with the richer Pro showcase.', 'These are concept designs, not customer projects. Names, reviews, and results are sample content; forms do not send. Visual features in a preview are not a promise of custom functionality.')
  .replace('Pro showcase', 'Growth')
  .replace('Professional mobile-friendly website, secure hosting, contact form, basic SEO, and 3 content updates each month.', 'One page with up to 6 sections, secure hosting, an inquiry form, basic SEO, and 3 small content updates each month.')
  .replace('Everything in Basic, plus 10 monthly updates', 'Up to 5 pages with all Basic essentials, plus 10 monthly updates')
  .replace('<strong>Pro</strong>', '<strong>Growth style</strong>')
  .replace('target="_blank"', 'target="_blank" rel="noopener"')
  .replace('Growth · $199/month', '$199/month'));
edit('success.html', text => text
  .replace('Required pages<textarea', 'Pages or sections you need<textarea')
  .replace('For example: Home, About, Services, Reviews, Contact', 'Basic: up to 6 sections on one page. Growth: up to 5 pages.')
  .replace('Your first draft is due', 'Have your logo, business text, and photos ready to share when we follow up. Basic covers one page; Growth covers up to five. Both include two pre-launch revision rounds. Your first draft is due'));
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
for (const file of walk(root).filter(file => file.endsWith('.html') && /(?:-basic|-pro|-demo|lawyer-template)/.test(file))) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace('</head>', '<meta name="robots" content="noindex,follow"><script src="/demo-preview.js" defer></script></head>');
  text = text.replace(/<script\b[^>]*src="https?:[^>]*><\/script>/gi, '');
  fs.writeFileSync(file, text);
}
console.log('Updated public copy, plan boundaries, and concept labels.');
