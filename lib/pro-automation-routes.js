const express = require('express');
const store = require('./pro-automation-store');
const automation = require('./pro-automation');

function publicError(res, status, message) { return res.status(status).json({ error: message }); }

function createProAutomationRouter({ requireOwner, publicBaseUrl, sendEmail }) {
  const router = express.Router();

  async function deliver(draft) {
    try {
      const settings = await store.getSettings(draft.project_id);
      if (!settings?.active) throw new Error('Pro automation is inactive for this client.');
      let providerId = '';
      if (draft.channel === 'sms') providerId = await automation.sendText({ to: draft.recipient, from: settings.twilio_phone, body: draft.body });
      else {
        await sendEmail({ to: draft.recipient, from: settings.outbound_email ? `${settings.business_name} <${settings.outbound_email}>` : undefined, reply_to: settings.outbound_email || undefined, subject: draft.subject || `A message from ${settings.business_name}`, text: draft.body }, `pro-followup-${draft.id}`);
        providerId = `email:${draft.id}`;
      }
      return store.updateOutboundDraft(draft.id, { status: 'sent', sent_at: new Date().toISOString(), provider_id: providerId, error: null });
    } catch (error) {
      await store.updateOutboundDraft(draft.id, { status: 'failed', error: automation.clean(error.message, 500) });
      throw error;
    }
  }

  router.post('/review-reply', async (req, res) => {
    if (!automation.webhookAllowed(req)) return publicError(res, 401, 'A valid automation webhook secret is required.');
    try {
      const input = {
        projectId: automation.clean(req.body?.projectId, 100), reviewerName: automation.clean(req.body?.reviewerName, 120),
        reviewText: automation.clean(req.body?.reviewText, 5000), starRating: Number(req.body?.starRating),
      };
      if (!input.projectId || !input.reviewerName || !input.reviewText || !Number.isInteger(input.starRating) || input.starRating < 1 || input.starRating > 5) return publicError(res, 400, 'Include a Pro project, reviewer name, review text, and a 1-5 star rating.');
      const [project, settings] = await Promise.all([store.growthProject(input.projectId), store.getSettings(input.projectId)]);
      if (!project || !settings?.active) return publicError(res, 404, 'Active Pro automation was not found for this project.');
      const generated = await automation.draftReviewReply(input, settings);
      const draft = await store.createReviewDraft({ project_id: project.id, reviewer_name: input.reviewerName, star_rating: input.starRating, review_text: input.reviewText, draft_text: generated.text, openai_response_id: generated.responseId || null, model: generated.model || null });
      return res.status(202).json({ success: true, draftId: draft.id, status: 'pending_approval' });
    } catch (error) { console.error('Review reply draft failed:', error.message); return publicError(res, 502, 'The review reply draft could not be created.'); }
  });

  router.post('/missed-call', async (req, res) => {
    res.type('text/xml');
    try {
      const webhookUrl = `${publicBaseUrl()}${req.originalUrl.split('?')[0]}`;
      if (!automation.validTwilioRequest(req, webhookUrl)) return res.status(403).send('<Response/>');
      const status = automation.clean(req.body?.CallStatus, 40).toLowerCase();
      if (!['no-answer', 'busy', 'failed', 'canceled'].includes(status)) return res.send('<Response/>');
      const caller = automation.clean(req.body?.From, 30), called = automation.clean(req.body?.To, 30), sid = automation.clean(req.body?.CallSid, 100);
      if (!automation.validPhone(caller) || !automation.validPhone(called) || !sid) return res.status(400).send('<Response/>');
      const settings = await store.findSettingsByTwilioPhone(called);
      if (!settings) return res.send('<Response/>');
      const call = await store.createMissedCall({ project_id: settings.project_id, caller_phone: caller, called_phone: called, twilio_call_sid: sid, call_status: status });
      if (call) {
        const body = `Hey, this is ${settings.business_name} - sorry we missed you! Call us back at ${settings.public_phone} or book online at ${settings.booking_url}.`;
        await store.createOutboundDraft({ project_id: settings.project_id, missed_call_id: call.id, kind: 'missed_call', channel: 'sms', recipient: caller, body, scheduled_for: new Date().toISOString() });
      }
      return res.send('<Response/>');
    } catch (error) { console.error('Missed call webhook failed:', error.message); return res.status(500).send('<Response/>'); }
  });

  router.post('/lead-followup', async (req, res) => {
    if (!automation.webhookAllowed(req)) return publicError(res, 401, 'A valid automation webhook secret is required.');
    try {
      const projectId = automation.clean(req.body?.projectId, 100), name = automation.clean(req.body?.name, 120);
      const phone = automation.clean(req.body?.phone, 30), email = automation.clean(req.body?.email, 320).toLowerCase(), source = automation.clean(req.body?.source, 120) || 'website form';
      if (!projectId || (!automation.validPhone(phone) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return publicError(res, 400, 'Include a Pro project and a valid phone or email.');
      const [project, settings] = await Promise.all([store.growthProject(projectId), store.getSettings(projectId)]);
      if (!project || !settings?.active) return publicError(res, 404, 'Active Pro automation was not found for this project.');
      const lead = await store.createLead({ project_id: project.id, name: name || null, phone: automation.validPhone(phone) ? phone : null, email: email || null, source });
      const preferEmail = settings.preferred_channel === 'email_first' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const channel = preferEmail || !automation.validPhone(phone) ? 'email' : 'sms', recipient = channel === 'sms' ? phone : email;
      const greeting = name ? `Hi ${name},` : 'Hi,';
      const first = `${greeting} thanks for contacting ${settings.business_name}. You can choose a time here: ${settings.booking_url}. Reply if you have any questions.`;
      const followup = `${greeting} just following up from ${settings.business_name}. If you still need help, you can book here: ${settings.booking_url}.`;
      const subject = channel === 'email' ? `Thanks for contacting ${settings.business_name}` : null;
      await Promise.all([
        store.createOutboundDraft({ project_id: project.id, lead_id: lead.id, kind: 'lead_initial', channel, recipient, subject, body: first, scheduled_for: new Date().toISOString() }),
        store.createOutboundDraft({ project_id: project.id, lead_id: lead.id, kind: 'lead_followup', channel, recipient, subject: `Following up from ${settings.business_name}`, body: followup, scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }),
      ]);
      return res.status(202).json({ success: true, leadId: lead.id, status: 'pending_approval' });
    } catch (error) { console.error('Lead follow-up draft failed:', error.message); return publicError(res, 500, 'The lead follow-up drafts could not be created.'); }
  });

  router.post('/lead-booked', async (req, res) => {
    if (!automation.webhookAllowed(req)) return publicError(res, 401, 'A valid automation webhook secret is required.');
    const leadId = automation.clean(req.body?.leadId, 100);
    if (!leadId) return publicError(res, 400, 'Include the booked lead ID.');
    try {
      const lead = await store.updateLead(leadId, { status: 'booked' });
      await store.cancelLeadDrafts(leadId);
      return res.json({ success: true, lead });
    } catch { return publicError(res, 500, 'The booking could not be recorded.'); }
  });

  router.get('/admin/automation', requireOwner, async (req, res) => {
    try { res.set('Cache-Control', 'private, no-store'); return res.json(await store.automationOverview()); }
    catch (error) { console.error('Automation overview failed:', error.message); return publicError(res, 503, 'The Pro automation dashboard is unavailable.'); }
  });

  router.patch('/admin/automation/settings/:projectId', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1') return publicError(res, 403, 'Invalid owner request.');
    try {
      const project = await store.growthProject(req.params.projectId);
      if (!project) return publicError(res, 404, 'Choose a Growth/Pro project.');
      const bookingUrl = automation.clean(req.body?.bookingUrl, 2048), publicPhone = automation.clean(req.body?.publicPhone, 30), twilioPhone = automation.clean(req.body?.twilioPhone, 30);
      const outboundEmail = automation.clean(req.body?.outboundEmail, 320).toLowerCase();
      if (!/^https:\/\//i.test(bookingUrl) || !publicPhone || (twilioPhone && !automation.validPhone(twilioPhone))) return publicError(res, 400, 'Add an HTTPS booking link, public phone, and an E.164 Twilio number such as +16155551212.');
      if (outboundEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(outboundEmail)) return publicError(res, 400, 'Enter a valid verified sender email.');
      const settings = await store.saveSettings(project.id, {
        business_name: automation.clean(req.body?.businessName, 160) || project.business_name,
        business_type: automation.clean(req.body?.businessType, 160) || automation.clean(project.intake?.businessType, 160) || 'local business',
        city: automation.clean(req.body?.city, 160), public_phone: publicPhone, booking_url: bookingUrl,
        twilio_phone: twilioPhone || null,
        outbound_email: outboundEmail || null,
        preferred_channel: req.body?.preferredChannel === 'email_first' ? 'email_first' : 'sms_first',
        review_voice_notes: automation.clean(req.body?.reviewVoiceNotes, 1000) || null,
        active: req.body?.active === true,
      });
      return res.json({ success: true, settings });
    } catch (error) { console.error('Automation settings failed:', error.message); return publicError(res, 500, 'The automation settings could not be saved.'); }
  });

  router.post('/admin/automation/reviews/:id/:action', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1' || !['approve', 'reject', 'posted'].includes(req.params.action)) return publicError(res, 403, 'Invalid owner request.');
    try {
      const status = req.params.action === 'approve' ? 'approved' : req.params.action === 'posted' ? 'posted' : 'rejected';
      const draftText = automation.clean(req.body?.draftText, 1500);
      const draft = await store.updateReviewDraft(req.params.id, { status, ...(draftText ? { draft_text: draftText } : {}), ...(status === 'approved' ? { approved_at: new Date().toISOString() } : {}) });
      return res.json({ success: true, draft });
    } catch { return publicError(res, 500, 'The review draft could not be updated.'); }
  });

  router.post('/admin/automation/drafts/:id/:action', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1' || !['approve', 'reject'].includes(req.params.action)) return publicError(res, 403, 'Invalid owner request.');
    try {
      const draft = await store.getOutboundDraft(req.params.id);
      if (!draft || !['pending', 'approved', 'failed'].includes(draft.status)) return publicError(res, 409, 'That message is no longer awaiting a decision.');
      if (req.params.action === 'reject') return res.json({ success: true, draft: await store.updateOutboundDraft(draft.id, { status: 'rejected' }) });
      const editedBody = automation.clean(req.body?.body, 1500);
      const approved = await store.updateOutboundDraft(draft.id, { status: 'approved', approved_at: new Date().toISOString(), error: null, ...(editedBody ? { body: editedBody } : {}) });
      if (new Date(approved.scheduled_for).getTime() <= Date.now()) return res.json({ success: true, draft: await deliver(approved) });
      return res.json({ success: true, draft: approved });
    } catch (error) { console.error('Automation approval failed:', error.message); return publicError(res, 502, 'The approved message could not be sent.'); }
  });

  router.patch('/admin/automation/leads/:id', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1') return publicError(res, 403, 'Invalid owner request.');
    const status = automation.clean(req.body?.status, 30);
    if (!['new', 'contacted', 'booked', 'closed', 'do_not_contact'].includes(status)) return publicError(res, 400, 'Choose a valid lead status.');
    try {
      const lead = await store.updateLead(req.params.id, { status });
      if (['booked', 'closed', 'do_not_contact'].includes(status)) await store.cancelLeadDrafts(req.params.id);
      return res.json({ success: true, lead });
    }
    catch { return publicError(res, 500, 'The lead status could not be updated.'); }
  });

  router.get('/pro-followups', async (req, res) => {
    const supplied = automation.clean(req.headers.authorization, 500).replace(/^Bearer\s+/i, '');
    if (!process.env.CRON_SECRET || !automation.safeEqual(supplied, process.env.CRON_SECRET)) return publicError(res, 401, 'Unauthorized.');
    try {
      const drafts = await store.approvedDueDrafts();
      const results = await Promise.allSettled(drafts.map(deliver));
      return res.json({ processed: results.length, sent: results.filter((item) => item.status === 'fulfilled').length });
    } catch (error) { console.error('Scheduled follow-up delivery failed:', error.message); return publicError(res, 500, 'Scheduled follow-ups failed.'); }
  });

  return router;
}

module.exports = { createProAutomationRouter };
