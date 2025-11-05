# Email Setup Instructions

## Setting Up Email Sending

The signup system sends two welcome emails to new customers:
1. **Login Email** - Contains their login email address
2. **Password Email** - Contains their chosen password

### Option 1: Resend (Recommended for Vercel)

1. Go to https://resend.com and create a free account
2. Verify your domain (or use their test domain)
3. Get your API key from the dashboard
4. Add to Vercel Environment Variables:
   - `EMAIL_API_KEY` = Your Resend API key (starts with `re_`)

### Option 2: SendGrid

1. Go to https://sendgrid.com and create an account
2. Get your API key
3. Update the email sending code in `api/signup.js` to use SendGrid format
4. Add to Vercel Environment Variables:
   - `EMAIL_API_KEY` = Your SendGrid API key

### Option 3: Nodemailer with SMTP

1. Get SMTP credentials from your email provider
2. Install nodemailer: `npm install nodemailer`
3. Update the email sending code in `api/signup.js`
4. Add SMTP credentials to Vercel Environment Variables

## Current Status

- Signup page is ready
- Email templates are configured
- Two emails will be sent (login + password)
- **Action Required:** Set up `EMAIL_API_KEY` in Vercel environment variables

## Testing

Without the API key set, emails will be logged to the console for testing. Set up the email service to enable actual email sending.

