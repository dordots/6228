# SendGrid Configuration for Firebase Functions

## Overview
The Armory Management System uses SendGrid for sending emails through Firebase Functions. This includes:
- Daily reports
- Form PDFs (signing forms, release forms)
- Equipment assignment notifications
- Test emails

## Prerequisites
1. SendGrid account (https://sendgrid.com)
2. Verified sender email address
3. API key with "Mail Send" permissions

## Configuration Steps

### 1. Create SendGrid API Key
1. Log in to your SendGrid account
2. Navigate to Settings > API Keys
3. Click "Create API Key"
4. Give it a name like "Armory Firebase Functions"
5. Select "Restricted Access"
6. Enable only "Mail Send" permissions
7. Click "Create & View"
8. Copy the API key immediately (you won't see it again!)

### 2. Verify Sender Email
1. Navigate to Settings > Sender Authentication
2. Click "Single Sender Verification"
3. Add your sender email address
4. Verify the email address via the confirmation email

### 3. Configure Firebase Functions

Set the following configuration variables using Firebase CLI:

```bash
# Set SendGrid API Key
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"

# Set From Email (must be verified in SendGrid)
firebase functions:config:set sendgrid.from_email="noreply@yourdomain.com"

# Set Report Email (where daily reports are sent)
firebase functions:config:set sendgrid.report_email="reports@yourdomain.com"

# View current configuration
firebase functions:config:get

# Deploy the functions with new configuration
firebase deploy --only functions
```

### 4. Test the Configuration

After deployment, you can test SendGrid configuration:

1. Log in to the Armory app as an admin
2. Navigate to Settings or Admin Panel
3. Look for "Test Email" or "SendGrid Test" option
4. Send a test email to verify configuration

## Email Templates

The system sends the following types of emails:

### Daily Report
- **Triggered**: Daily at 8:00 AM Jerusalem time or manually by admin/manager
- **Recipients**: Configured report email address
- **Content**: Summary of all equipment, weapons, and personnel status

### Signing Form
- **Triggered**: When equipment is assigned to personnel
- **Recipients**: Soldier's email address
- **Content**: PDF attachment with equipment details for signature

### Release Form
- **Triggered**: When equipment is released/returned
- **Recipients**: Soldier's email address
- **Content**: PDF attachment confirming equipment return

## Troubleshooting

### Common Issues

1. **"SendGrid API key not configured" error**
   - Ensure you've set the configuration using `firebase functions:config:set`
   - Redeploy functions after setting configuration

2. **"Failed to send email" error**
   - Verify the API key is correct
   - Check that sender email is verified in SendGrid
   - Ensure API key has "Mail Send" permissions

3. **Emails not received**
   - Check SendGrid activity feed for bounces/blocks
   - Verify recipient email addresses
   - Check spam folders

### View Function Logs

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only testSendGrid
```

## Security Notes

- Never commit API keys to source control
- Use Firebase Functions configuration for sensitive values
- Rotate API keys periodically
- Monitor SendGrid activity for unusual behavior

## Support

For SendGrid-specific issues:
- SendGrid Documentation: https://docs.sendgrid.com
- SendGrid Support: https://support.sendgrid.com

For Firebase Functions issues:
- Firebase Documentation: https://firebase.google.com/docs/functions
- Check function logs: `firebase functions:log`