export interface TemplateItem {
  id: string;
  category: 'Cold Outreach' | 'Follow Up' | 'Legal & Invoicing' | 'Custom';
  title: string;
  subject?: string;
  body: string;
  isCustom?: boolean;
}

export const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: 'outreach-intro',
    category: 'Cold Outreach',
    title: 'Initial Commercial Introduction',
    subject: 'Partnership Overview: {{company}} [Acc: {{account_number}}]',
    body: `Hi {{contact_name}},

I've been tracking {{company}}'s commercial footprint and wanted to initiate direct contact regarding our operating solutions.

Your account profile has been logged under reference {{account_number}}.

Would you have 10 minutes next Tuesday to run through our SLA roadmap?

Best regards,
{{sender_name}}
Biscuit Commercial Team`,
  },
  {
    id: 'follow-up-stage',
    category: 'Follow Up',
    title: 'Pipeline Milestone Check-in',
    subject: 'Stage Update: {{company}} [Acc: {{account_number}}]',
    body: `Hi {{contact_name}},

Quick update regarding {{company}}'s onboarding milestones under account reference {{account_number}}.

We have transitioned your profile to the {{stage}} phase. If you require any documentation adjustments, reply directly to this thread.

Best regards,
{{sender_name}}`,
  },
  {
    id: 'invoice-billing',
    category: 'Legal & Invoicing',
    title: 'Master Service Agreement & Invoicing',
    subject: 'Invoice & Terms: {{company}} [Acc: {{account_number}}]',
    body: `Hi {{contact_name}},

Attached is the commercial schedule for {{company}} (Account No: {{account_number}}).

Please verify the billing schedule at your earliest convenience so logistics can lock in your dispatch window.

Best regards,
{{sender_name}}`,
  },
];

export function replaceTokens(
  template: string,
  tokens: {
    account_number?: string;
    contact_name?: string;
    company?: string;
    crn?: string;
    stage?: string;
    sender_name?: string;
  }
): string {
  return template
    .replace(/\{\{account_number\}\}/g, tokens.account_number || 'ACC-PENDING')
    .replace(/\{\{contact_name\}\}/g, tokens.contact_name || 'Client')
    .replace(/\{\{company\}\}/g, tokens.company || 'Company')
    .replace(/\{\{crn\}\}/g, tokens.crn ? `(CRN: ${tokens.crn})` : '')
    .replace(/\{\{stage\}\}/g, tokens.stage || 'Pipeline')
    .replace(/\{\{sender_name\}\}/g, tokens.sender_name || 'Account Executive');
}
