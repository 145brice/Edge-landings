const users = require('./users');

const DEFAULT_TASKS = [
  {
    id: 'upload-assets',
    title: 'Upload brand assets',
    description: 'Send us your logo, brand colors, and any existing imagery.',
    category: 'Launch prep'
  },
  {
    id: 'complete-questionnaire',
    title: 'Complete business questionnaire',
    description: 'Answer 6 quick questions so we can nail your messaging.',
    category: 'Launch prep'
  },
  {
    id: 'book-kickoff',
    title: 'Schedule your kickoff call',
    description: 'Get on a 15-minute strategy call to align on goals.',
    category: 'Launch prep'
  },
  {
    id: 'connect-domain',
    title: 'Connect your domain',
    description: 'We’ll walk you through pointing your domain to Edge.',
    category: 'Go live'
  },
  {
    id: 'review-homepage',
    title: 'Review homepage preview',
    description: 'Leave comments or approvals on your first draft.',
    category: 'Go live'
  }
];

const DEFAULT_ACTIVITY = [
  {
    title: 'Website brief received',
    timestamp: 'Today',
    detail: 'You submitted your business questionnaire.'
  },
  {
    title: 'Assets reviewed',
    timestamp: 'Yesterday',
    detail: 'Brand assets packaged and sent to design team.'
  },
  {
    title: 'Strategy call booked',
    timestamp: '2 days ago',
    detail: 'Kickoff call scheduled for this week.'
  }
];

function getTrialInfo(createdAt, explicitTrialEnd) {
  const created = createdAt ? new Date(createdAt) : new Date();
  const defaultEnd = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialEnd = explicitTrialEnd ? new Date(explicitTrialEnd) : defaultEnd;
  const msRemaining = trialEnd.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  return {
    trialEndsAt: trialEnd.toISOString(),
    trialDaysRemaining: daysRemaining,
  };
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, customerId = null } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim();
    const user = await users.get(normalizedEmail);

    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please sign up first.' });
    }

    const createdAt = user.createdAt || new Date().toISOString();
    const rawPlanName = user.plan ? String(user.plan).trim() : null;
    const hasSelectedPlan = !!rawPlanName;
    const planTier = hasSelectedPlan
      ? (rawPlanName.toLowerCase().includes('pro') ? 'Pro' : 'Basic')
      : null;
    const planAmount = hasSelectedPlan
      ? (user.planAmount || (planTier === 'Pro' ? 199 : 99))
      : 0;
    const planStatus = user.planStatus || 'trial';
    const billingInterval = hasSelectedPlan ? (user.billingInterval || 'Monthly') : null;
    const { trialEndsAt, trialDaysRemaining } = getTrialInfo(createdAt, user.trialEndsAt);

    const websiteProgress = Math.min(100, Math.max(0, Number(user.websiteProgress ?? 40)));
    const websiteStatus = user.websiteStatus || (websiteProgress >= 100 ? 'Live' : 'In design queue');
    const nextMilestone = user.nextMilestone || (websiteProgress >= 100 ? 'Post-launch optimization' : 'Homepage preview coming up');
    const assetsNeeded = Array.isArray(user.assetsNeeded) && user.assetsNeeded.length
      ? user.assetsNeeded
      : ['Brand assets (logo, colors)', 'Copy for hero section', 'Primary call-to-action'];

    const completedTasks = Array.isArray(user.completedTasks) ? user.completedTasks : [];
    const onboardingTasks = DEFAULT_TASKS.map((task) => ({
      ...task,
      completed: completedTasks.includes(task.id),
    }));

    const activityLog = Array.isArray(user.activityLog) && user.activityLog.length
      ? user.activityLog
      : DEFAULT_ACTIVITY;

    const dashboardPayload = {
      account: {
        email: normalizedEmail,
        customerId: user.customerId || customerId,
        createdAt,
        plan: {
          name: rawPlanName,
          tier: planTier,
          status: planStatus,
          amount: planAmount,
          billingInterval,
          trialEndsAt,
          trialDaysRemaining,
          hasSelectedPlan,
        },
      },
      website: {
        status: websiteStatus,
        progress: websiteProgress,
        nextMilestone,
        estimatedLaunch: user.estimatedLaunch || 'Within 5 business days',
        checklist: Array.isArray(user.websiteChecklist) && user.websiteChecklist.length
          ? user.websiteChecklist
          : [
              {
                id: 'upload-assets',
                label: 'Upload brand assets',
                status: websiteProgress >= 15,
                link: '#upload-assets'
              },
              {
                id: 'homepage-review',
                label: 'Review homepage draft',
                status: websiteProgress >= 35,
                link: '#homepage-review'
              },
              {
                id: 'copy-approval',
                label: 'Approve website copy',
                status: websiteProgress >= 55,
                link: '#copy-approval'
              },
              {
                id: 'mobile-polish',
                label: 'Final mobile polish',
                status: websiteProgress >= 85,
                link: '#mobile-polish'
              }
            ],
        assetsNeeded,
      },
      billing: {
        amount: planAmount,
        interval: hasSelectedPlan ? (user.billingInterval || 'per month') : null,
        status: planStatus === 'active' ? 'Active' : planStatus === 'trial' ? 'Trial' : 'Paused',
        nextInvoice: hasSelectedPlan ? (user.nextInvoice || null) : null,
        autopay: hasSelectedPlan ? (user.autopay ?? true) : false,
      },
      onboarding: {
        tasks: onboardingTasks,
        notes: user.onboardingNotes || 'Complete the checklist to keep your launch on schedule. Need help? Drop us a line anytime.',
      },
      activity: activityLog,
      resources: user.resources || [
        {
          title: 'Upload assets',
          description: 'Secure portal for uploading logos, photos, and brand files.',
          href: 'mailto:145brice@gmail.com?subject=Upload%20Assets'
        },
        {
          title: 'Book strategy call',
          description: 'Schedule a 15-minute check-in to review your build progress.',
          href: 'mailto:145brice@gmail.com?subject=Schedule%20Strategy%20Call'
        },
        {
          title: 'Request content help',
          description: 'Need copy tweaks or photo sourcing? We can help.',
          href: 'mailto:145brice@gmail.com?subject=Content%20Help'
        },
      ],
      support: {
        email: '145brice@gmail.com',
        responseTime: 'Under 24 hours',
        status: 'Online',
        phone: user.supportPhone || null,
      },
    };

    res.json(dashboardPayload);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ error: error.message });
  }
};

