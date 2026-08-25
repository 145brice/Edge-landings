const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    ['Business type', safe.businessType], ['Goals', safe.goals], ['Required pages', safe.requiredPages],
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
  const content = `<div style="background:#07101d;border:1px solid #213a59;border-radius:12px;padding:18px"><strong style="color:#00f18c">What happens next</strong><ol style="color:#b9c8dd;margin:10px 0 0;padding-left:20px"><li>We review your business details and required pages.</li><li>We contact you if any content or access is missing.</li><li>Your first site draft is due within 3 business days after we receive the content needed for your site.</li></ol></div>`;
  return {
    subject: 'We received your Edge Landings onboarding details',
    text: `Thanks, ${safe.ownerName}. We received the onboarding details for ${safe.businessName} on the ${selectedPlan.name} plan.\n\nNext, we will review your details and contact you if anything is missing. Your first site draft is due within 3 business days after we receive the content needed for your site.`,
    html: layout({ eyebrow: selectedPlan.name, heading: `Thanks, ${safe.ownerName}.`, intro: `We received the onboarding details for ${safe.businessName}.`, content, footer: 'Edge Landings - professional websites for local businesses' }),
  };
}

module.exports = { normalizeEmail, normalizeSender, cleanSubject, ownerOnboardingEmail, customerOnboardingEmail };
