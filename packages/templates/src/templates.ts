export interface TemplateItem {
  id: string;
  category: 'Cold Outreach' | 'Objection Handling' | 'Procurement Followup' | 'Onboarding' | 'Custom';
  title: string;
  subject?: string;
  body: string;
  isCustom?: boolean;
}

export const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: 'intro_pitch',
    category: 'Cold Outreach',
    title: 'Zero-Storage Business OS Pitch',
    subject: 'Streamlining operations at {{company}} with zero third-party cloud risk',
    body: `Hi {{contact_name}},

I noticed your work at {{company}} (CRN: {{crn}}).

Most organizations struggle with escalating cloud CRM storage fees and GDPR third-party liability. Biscuit CRM lets your teams run entire pipeline workflows directly within your company's existing Google Workspace ledger with £0 third-party database hosting.

Would you be open to a 10-minute walk-through this Thursday?

Best regards,
{{sender_name}}`,
  },
  {
    id: 'objection_cloud',
    category: 'Objection Handling',
    title: 'Objection: "We Already Use Salesforce/HubSpot"',
    subject: 'Addressing CRM lock-in and sovereignty at {{company}}',
    body: `Hi {{contact_name}},

Completely understand that {{company}} is already embedded in your current stack.

The primary difference our clients point to is the CIA Triad and complete data ownership: with traditional enterprise CRMs, your contacts and customer intelligence reside in vendor-controlled silos. With Biscuit CRM, 100% of your records stay in your own audited Google Drive ledger—no monthly seats or per-contact markups.

Happy to send over our architecture comparison if helpful.

Best regards,
{{sender_name}}`,
  },
  {
    id: 'procurement_deck',
    category: 'Procurement Followup',
    title: 'Procurement & Security Handoff',
    subject: '{{company}} // Zero-Storage Security Ledger Review',
    body: `Hi {{contact_name}},

As {{company}} advances through our Procurement stage, I've prepared our direct browser-to-Drive zero-retention data flow documentation.

Because no customer records or credentials ever touch an external server, your vendor assessment and compliance checks are streamlined.

Let me know if your IT or legal team requires any specific security schedules.

Best regards,
{{sender_name}}`,
  },
];

export function replaceTokens(
  templateText: string, 
  data: { 
    contact_name?: string; 
    company?: string; 
    crn?: string; 
    stage?: string;
    sender_name?: string;
  }
): string {
  return templateText
    .replace(/\{\{contact_name\}\}/g, data.contact_name || 'Team')
    .replace(/\{\{company\}\}/g, data.company || 'your organization')
    .replace(/\{\{crn\}\}/g, data.crn || 'N/A')
    .replace(/\{\{stage\}\}/g, data.stage || 'Lead')
    .replace(/\{\{sender_name\}\}/g, data.sender_name || 'Account Executive');
}
