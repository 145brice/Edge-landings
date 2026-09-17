queueMicrotask(() => {
  const bar = document.querySelector('.demo-bar');
  if (bar?.firstChild) bar.firstChild.textContent = 'Edge Landings Basic preview · Beta $49/month ';
});

const SITES = {
  auto: {
    name: "Precision Auto Care",
    icon: "🚗",
    kicker: "Honest service. Skilled technicians.",
    headline: "Keep your car running at its best.",
    intro:
      "Straightforward maintenance and repairs from a local team that treats your vehicle like their own.",
    services: [
      [
        "Routine Maintenance",
        "Oil changes, inspections, filters, and scheduled maintenance.",
      ],
      [
        "Diagnostics",
        "Clear answers and practical recommendations when warning lights appear.",
      ],
      [
        "Brake & Tire Care",
        "Reliable stopping power, rotations, repairs, and replacements.",
      ],
    ],
    cta: "Request Service",
    phone: "(555) 014-2200",
    email: "service@example.com",
    colors: ["#b3261e", "#70130e", "#fff4f2"],
  },
  barber: {
    name: "Gentleman’s Cut",
    icon: "✂️",
    kicker: "Classic craft. Modern style.",
    headline: "Walk out looking your sharpest.",
    intro:
      "Precision cuts, beard care, and a relaxed neighborhood experience tailored to you.",
    services: [
      [
        "Signature Cut",
        "Consultation, precision cut, styling, and finishing touches.",
      ],
      ["Beard Detail", "Shape, line, trim, and condition your beard."],
      [
        "Cut & Beard",
        "The complete grooming appointment in one convenient visit.",
      ],
    ],
    cta: "Request an Appointment",
    phone: "(555) 014-3300",
    email: "hello@example.com",
    colors: ["#a66b2e", "#603713", "#fff8ee"],
  },
  coffee: {
    name: "Brew & Grind",
    icon: "☕",
    kicker: "Roasted well. Served warmly.",
    headline: "Your neighborhood cup, made with care.",
    intro:
      "Small-batch coffee, fresh pastries, and a welcoming place to meet, work, or slow down.",
    services: [
      [
        "Espresso Bar",
        "Classic espresso drinks made to order by skilled baristas.",
      ],
      [
        "Fresh Pastries",
        "A rotating daily selection from trusted local bakers.",
      ],
      [
        "Coffee to Go",
        "Beans, cold brew, and convenient pickup for busy mornings.",
      ],
    ],
    cta: "Ask About Catering",
    phone: "(555) 014-4400",
    email: "coffee@example.com",
    colors: ["#7a4b2a", "#3f2415", "#fff8ef"],
  },
  doctor: {
    name: "Nashville Family Medicine",
    icon: "✚",
    kicker: "Compassionate care for every stage.",
    headline: "Healthcare centered on your family.",
    intro:
      "Thoughtful primary care, preventive visits, and clear guidance from a team that listens.",
    services: [
      [
        "Primary Care",
        "Routine visits and ongoing care for adults and families.",
      ],
      [
        "Preventive Health",
        "Wellness exams, screenings, vaccines, and health planning.",
      ],
      [
        "Same-Week Visits",
        "Timely evaluation for common illnesses and new concerns.",
      ],
    ],
    cta: "Request an Appointment",
    phone: "(555) 014-5500",
    email: "appointments@example.com",
    colors: ["#176b87", "#0c465c", "#effaff"],
  },
  fitness: {
    name: "Iron Peak Fitness",
    icon: "⚡",
    kicker: "Train stronger. Live better.",
    headline: "Build momentum that lasts.",
    intro:
      "Expert coaching, practical programming, and an encouraging community for every fitness level.",
    services: [
      [
        "Open Gym",
        "Quality strength and conditioning equipment with room to move.",
      ],
      [
        "Group Training",
        "Coach-led sessions that bring energy, structure, and accountability.",
      ],
      [
        "Personal Coaching",
        "A focused plan built around your experience and goals.",
      ],
    ],
    cta: "Claim a Trial Session",
    phone: "(555) 014-6600",
    email: "train@example.com",
    colors: ["#d14b16", "#822b0b", "#fff5ef"],
  },
  realtor: {
    name: "BrightKey Realty",
    icon: "⌂",
    kicker: "Local insight. Confident decisions.",
    headline: "Move forward with the right guide.",
    intro:
      "Personal real estate guidance for buyers and sellers across the greater Nashville area.",
    services: [
      [
        "Buy a Home",
        "A clear search strategy, thoughtful tours, and strong offer guidance.",
      ],
      [
        "Sell Your Home",
        "Pricing, presentation, marketing, and negotiation from list to close.",
      ],
      [
        "Market Consultation",
        "Local answers and practical next steps without the pressure.",
      ],
    ],
    cta: "Request a Consultation",
    phone: "(555) 014-7700",
    email: "homes@example.com",
    colors: ["#1a365d", "#0e223d", "#f2f6fb"],
  },
  tattoo: {
    name: "Ink & Iron Tattoo",
    icon: "✦",
    kicker: "Original work. Safe studio.",
    headline: "Wear art made for you.",
    intro:
      "Custom tattoos created through thoughtful collaboration with experienced professional artists.",
    services: [
      [
        "Custom Tattoos",
        "Original concepts shaped around your vision, placement, and style.",
      ],
      [
        "Cover-Ups",
        "Strategic new artwork designed to transform an existing tattoo.",
      ],
      [
        "Consultations",
        "Meet an artist, discuss the idea, and understand the next steps.",
      ],
    ],
    cta: "Request a Consultation",
    phone: "(555) 014-8800",
    email: "studio@example.com",
    colors: ["#c24822", "#722610", "#fff5f0"],
  },
  lawyer: {
    name: "Harbor Legal Group",
    icon: "⚖",
    kicker: "Clear counsel when it matters.",
    headline: "Practical legal guidance. Personal attention.",
    intro:
      "Straightforward advice and committed representation for individuals, families, and local businesses.",
    services: [
      [
        "Business Law",
        "Contracts, formation, disputes, and day-to-day counsel.",
      ],
      [
        "Estate Planning",
        "Wills, trusts, powers of attorney, and thoughtful planning.",
      ],
      [
        "Civil Matters",
        "Strategic guidance and advocacy through complex disputes.",
      ],
    ],
    cta: "Request a Consultation",
    phone: "(555) 014-9900",
    email: "intake@example.com",
    colors: ["#23466b", "#112d49", "#f1f6fb"],
  },
};
const key = document.body.dataset.industry;
const s = SITES[key];
document.documentElement.style.setProperty("--brand", s.colors[0]);
document.documentElement.style.setProperty("--brand2", s.colors[1]);
document.documentElement.style.setProperty("--wash", s.colors[2]);
document.title = `${s.name} | Basic Website Preview`;
document.body.innerHTML = `<div class="demo-bar">Edge Landings Basic preview · $99/month <a href="/templates.html">Back to all templates</a></div><header class="wrap site-nav"><div class="brand">${s.name}</div><nav><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav><a class="button" href="#contact">${s.cta}</a></header><main><section class="hero"><div class="wrap hero-grid"><div><div class="kicker">${s.kicker}</div><h1>${s.headline}</h1><p>${s.intro}</p><div class="actions"><a class="button" href="#contact">${s.cta}</a><a class="button alt" href="tel:${s.phone.replace(/\D/g, "")}">Call ${s.phone}</a></div></div><div class="visual" aria-hidden="true"><span>${s.icon}</span></div></div></section><section class="section" id="services"><div class="wrap"><h2>How we can help</h2><p class="intro">Focused services, clear information, and an easy next step.</p><div class="cards">${s.services.map(([h, p]) => `<article class="card"><h3>${h}</h3><p>${p}</p></article>`).join("")}</div></div></section><section class="section alt" id="about"><div class="wrap"><h2>Local service built on trust</h2><p class="intro">We believe a great experience starts with listening, communicating clearly, and following through. Contact our team to talk about what you need.</p></div></section><section class="section" id="contact"><div class="wrap contact"><div><div class="kicker">Get in touch</div><h2>${s.cta}</h2><p class="details">Call ${s.phone}<br>Email ${s.email}<br>Monday–Friday · 8:00 AM–5:00 PM</p></div><form onsubmit="event.preventDefault();this.innerHTML='<h3>Thanks — this demo form is working.</h3><p>On a live site, this message goes directly to the business.</p>'"><div><label for="name">Name</label><input id="name" name="name" required></div><div><label for="email">Email</label><input id="email" name="email" type="email" required></div><div><label for="message">How can we help?</label><textarea id="message" name="message" required></textarea></div><button class="button" type="submit">Send Request</button></form></div></section></main><footer>© ${new Date().getFullYear()} ${s.name} · Basic website preview by Edge Landings</footer>`;
