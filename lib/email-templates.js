const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const html = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function normalizeEmail(value, field = 'Email') {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error(`${field} is not a valid email address.`);
  return email;
}

function normalizeSender(value) {
  const sender = String(value || '').trim();
  const named = sender.match(/^([^<>\r\n]+)\s*<([^<>\r\n]+)>$/);
  if (named) return `${named[1].trim()} <${normalizeEmail(named[2], 'EMAIL_FROM')}>`;
  return normalizeEmail(sender, 'EMAIL_FROM');
}

function cleanSubject(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function layout({ eyebrow, heading, intro, content, footer }) {
  return `<!doctype html><html><body style="margin:0;background:#040711;color:#eef3ff;font-family:Arial,sans-serif;line-height:1.6"><div style="display:none;max-height:0;overflow:hidden">${intro}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#040711"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0b1220;border:1px solid #1b3150;border-radius:16px"><tr><td style="padding:32px"><div style="color:#00f18c;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${eyebrow}</div><h1 style="color:#eef3ff;font-size:26px;line-height:1.25;margin:8px 0 14px">${heading}</h1><p style="color:#b9c8dd;margin:0 0 24px">${intro}</p>${content}<p style="color:#7f93b2;font-size:13px;margin:28px 0 0;border-top:1px solid #1b3150;padding-top:18px">${footer}</p></td></tr></table></td></tr></table></body></html>`;
}

function ownerOnboardingEmail({ safe, selectedPlan, submittedAt }) {
  const rows = [
    ['Plan', selectedPlan.name], ['Business name', safe.businessName], ['Owner name', safe.ownerName],
    ['Email', safe.email], ['Phone', safe.phone], ['Existing URL', safe.existingUrl || 'Not provided'],
    ['Business type', safe.businessType], ['Goals', safe.goals], ['Pages or sections', safe.requiredPages],
    ['Notes', safe.notes || 'None'], ['Submitted', submittedAt],
  ];
  const content = rows.map(([label, value]) => `<div style="margin:0 0 13px"><strong style="color:#eef3ff">${label}</strong><div style="color:#b9c8dd;white-space:pre-wrap">${value}</div></div>`).join('');
  return {
    subject: cleanSubject(`New ${selectedPlan.name} onboarding - ${safe.businessName}`),
    text: rows.map(([label, value]) => `${label}: ${value}`).join('\n\n'),
    html: layout({ eyebrow: 'New paid customer', heading: 'Onboarding details received', intro: `${safe.ownerName} submitted onboarding for ${safe.businessName}.`, content, footer: 'Edge Landings internal onboarding notification' }),
  };
}

function customerOnboardingEmail({ safe, selectedPlan }) {
  const content = `<div style="background:#07101d;border:1px solid #213a59;border-radius:12px;padding:18px"><strong style="color:#00f18c">What happens next</strong><ol style="color:#b9c8dd;margin:10px 0 0;padding-left:20px"><li>We review your business details and pages or sections. Basic includes one page; Growth includes up to five.</li><li>We contact you if any content or access is missing.</li><li>Your first site draft is due within 3 business days after we receive the content needed for your site. Both plans include two pre-launch revision rounds.</li></ol></div>`;
  return {
    subject: 'We received your Edge Landings onboarding details',
    text: `Thanks, ${safe.ownerName}. We received the onboarding details for ${safe.businessName} on the ${selectedPlan.name} plan.\n\nNext, we will review your details and contact you if anything is missing. Your first site draft is due within 3 business days after we receive the content needed for your site. Basic includes one page; Growth includes up to five. Both include two pre-launch revision rounds. Reply to this email for help.`,
    html: layout({ eyebrow: selectedPlan.name, heading: `Thanks, ${safe.ownerName}.`, intro: `We received the onboarding details for ${safe.businessName}.`, content, footer: 'Edge Landings - professional websites for local businesses' }),
  };
}

function ownerProjectIntakeEmail({ project, portalUrl }) {
  const plan = project.plan_slug === 'growth' ? 'Growth' : 'Basic';
  const structure = project.site_structure.map((page) => `${page.page}: ${page.purpose}`).join('\n');
  return {
    subject: cleanSubject(`[New Build] ${project.business_name} — ${plan}`),
    text: `New free-draft request\n\nBusiness: ${project.business_name}\nClient: ${project.client_name}\nEmail: ${project.email}\nPhone: ${project.phone}\nPlan: ${plan}\n\nSite structure:\n${structure}\n\nOwner portal: ${portalUrl}`,
    html: layout({ eyebrow: 'New build request', heading: html(project.business_name), intro: `${html(project.client_name)} submitted a complete ${plan} project brief.`, content: `<p style="color:#b9c8dd;white-space:pre-wrap">${html(structure)}</p><p><a style="color:#00f18c" href="${html(portalUrl)}">Open the owner portal</a></p>`, footer: 'Edge Landings owner notification' }),
  };
}

function customerProjectIntakeEmail({ project, portalUrl }) {
  return {
    subject: cleanSubject(`Your private Edge Landings project portal — ${project.business_name}`),
    text: `We received your website brief for ${project.business_name}. No payment is due while we prepare your first draft. Save this private portal link to follow the build, review each section, and request changes:\n\n${portalUrl}`,
    html: layout({ eyebrow: 'Free first draft', heading: 'Your project portal is ready.', intro: `We received the website brief for ${html(project.business_name)}. No payment is due while we prepare your first draft.`, content: `<p><a style="display:inline-block;background:#00f18c;color:#031008;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none" href="${html(portalUrl)}">Open private project portal</a></p><p style="color:#b9c8dd">Save this link. It lets you review the actual pages and sections, request changes, approve the draft, and purchase only when you are ready.</p>`, footer: 'Edge Landings — your private project link' }),
  };
}

function ownerUpdateEmail({ project, request, ownerPortalUrl }) {
  return {
    subject: cleanSubject(`[Update] ${project.business_name} — ${request.section_label}`),
    text: `New section update request\n\nBusiness: ${project.business_name}\nSection: ${request.section_label}\nType: ${request.request_type}\n\n${request.details}\n\nOwner portal: ${ownerPortalUrl}`,
    html: layout({ eyebrow: 'Client update request', heading: html(request.section_label), intro: `${html(project.client_name)} requested a change for ${html(project.business_name)}.`, content: `<p style="color:#b9c8dd;white-space:pre-wrap">${html(request.details)}</p><p><a style="color:#00f18c" href="${html(ownerPortalUrl)}">Open the Updates queue</a></p>`, footer: 'Edge Landings owner notification' }),
  };
}

function ownerLoginEmail(loginUrl) {
  return {
    subject: 'Your Edge Landings owner sign-in link',
    text: `Use this private link to sign in to the Edge Landings owner portal. It expires in 15 minutes:\n\n${loginUrl}`,
    html: layout({ eyebrow: 'Owner access', heading: 'Sign in to Edge Landings.', intro: 'This private link expires in 15 minutes.', content: `<p><a style="display:inline-block;background:#00f18c;color:#031008;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none" href="${loginUrl}">Open owner portal</a></p>`, footer: 'If you did not request this, ignore this email.' }),
  };
}

function clientOwnerReplyEmail({ project, body }) {
  return {
    subject: cleanSubject(`Project update — ${project.business_name}`),
    text: `There is a new message from Edge Landings about ${project.business_name}:\n\n${body}\n\nOpen the private project link from your welcome email to reply.` ,
    html: layout({ eyebrow: 'Project update', heading: html(project.business_name), intro: 'There is a new message from Edge Landings in your project portal.', content: `<p style="color:#b9c8dd;white-space:pre-wrap">${html(body)}</p><p style="color:#7f93b2">Open the private project link from your welcome email to reply.</p>`, footer: 'Edge Landings project notification' }),
  };
}

module.exports = { normalizeEmail, normalizeSender, cleanSubject, ownerOnboardingEmail, customerOnboardingEmail, ownerProjectIntakeEmail, customerProjectIntakeEmail, ownerUpdateEmail, ownerLoginEmail, clientOwnerReplyEmail };
