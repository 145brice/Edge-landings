// Look up a user row from Google Sheet via Apps Script
async function getUserFromSheet(email) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return null;

  const url = `${scriptUrl}?action=getUser&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.found ? data.user : null;
}

const DEFAULT_TASKS = [
  { id: 'upload-assets',          title: 'Upload brand assets',              description: 'Send us your logo, brand colors, and any existing imagery.',          category: 'Launch prep' },
  { id: 'complete-questionnaire', title: 'Complete business questionnaire',  description: 'Answer 6 quick questions so we can nail your messaging.',             category: 'Launch prep' },
  { id: 'book-kickoff',           title: 'Schedule your kickoff call',       description: 'Get on a 15-minute strategy call to align on goals.',                  category: 'Launch prep' },
  { id: 'connect-domain',         title: 'Connect your domain',              description: 'We\'ll walk you through pointing your domain to Edge.',                 category: 'Go live'     },
  { id: 'review-homepage',        title: 'Review homepage preview',          description: 'Leave comments or approvals on your first draft.',                     category: 'Go live'     },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await getUserFromSheet(email.trim().toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const planName = user.plan || null;
    const planTier = planName ? (planName.toLowerCase().includes('pro') ? 'Pro' : 'Basic') : null;
    const planAmount = user.amount ? Number(user.amount) : (planTier === 'Pro' ? 99 : 59);

    const onboardingTasks = DEFAULT_TASKS.map(task => ({ ...task, completed: false }));

    return res.status(200).json({
      account: {
        email: user.email,
        customerId: user.customerId,
        createdAt: user.createdAt,
        plan: {
          name: planName,
          tier: planTier,
          status: user.status || 'active',
          amount: planAmount,
          billingInterval: 'Monthly',
          hasSelectedPlan: !!planName,
        },
      },
      website: {
        status: 'In design queue',
        progress: 20,
        nextMilestone: 'Homepage preview coming up',
        estimatedLaunch: 'Within 24 hours',
        checklist: [
          { id: 'upload-assets',          label: 'Upload brand assets',             status: false, link: '#upload-assets'          },
          { id: 'complete-questionnaire', label: 'Complete business questionnaire', status: false, link: '#business-questionnaire' },
          { id: 'book-kickoff',           label: 'Schedule kickoff call',           status: false, link: '#schedule-kickoff'       },
          { id: 'connect-domain',         label: 'Connect your domain',             status: false, link: '#connect-domain'         },
          { id: 'review-homepage',        label: 'Review homepage draft',           status: false, link: '#homepage-review'        },
        ],
        assetsNeeded: ['Brand assets (logo, colors)', 'Copy for hero section', 'Primary call-to-action'],
      },
      billing: {
        amount: planAmount,
        interval: 'per month',
        status: 'Active',
        nextInvoice: null,
        autopay: true,
      },
      onboarding: {
        tasks: onboardingTasks,
        notes: 'Complete the checklist to keep your launch on schedule. Need help? Drop us a line anytime.',
      },
      activity: [
        { title: 'Payment received',    timestamp: 'Today',      detail: `${planName} plan activated.`          },
        { title: 'Build slot reserved', timestamp: 'Today',      detail: '24-hour build clock has started.'     },
        { title: 'Welcome email sent',  timestamp: 'Just now',   detail: 'Check your inbox for login details.'  },
      ],
      support: {
        email: '145brice@gmail.com',
        responseTime: 'Under 24 hours',
        status: 'Online',
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: err.message });
  }
};
