#!/usr/bin/env node

console.log('Firebase Functions Configuration Script\n');

console.log('To configure SendGrid for Firebase Functions, run these commands:\n');

console.log('1. Set SendGrid API Key:');
console.log('   firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"');
console.log('');

console.log('2. Set From Email:');
console.log('   firebase functions:config:set sendgrid.from_email="noreply@yourdomain.com"');
console.log('');

console.log('3. Set Report Email (for daily reports):');
console.log('   firebase functions:config:set sendgrid.report_email="reports@yourdomain.com"');
console.log('');

console.log('4. View current configuration:');
console.log('   firebase functions:config:get');
console.log('');

console.log('5. Deploy functions:');
console.log('   firebase deploy --only functions');
console.log('');

console.log('Note: You need a SendGrid account and API key for email functionality.');
console.log('Visit https://sendgrid.com to create an account if you don\'t have one.');