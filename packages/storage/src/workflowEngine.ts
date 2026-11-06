/**
 * Biscuit CRM Enterprise Automated Workflow Engine
 * Executes automated actions across WMS, Finance, and CS on lifecycle transitions.
 */

export interface WorkflowTriggerEvent {
  eventType: 'STAGE_CHANGED' | 'PAYMENT_RECEIVED' | 'ORDER_FULFILLED';
  contact: any;
  previousStage?: string;
  newStage?: string;
  user: string;
}

export interface WorkflowResult {
  triggeredRules: string[];
  notifications: string[];
}

export function executeWorkflowRules(event: WorkflowTriggerEvent): WorkflowResult {
  const triggeredRules: string[] = [];
  const notifications: string[] = [];

  if (event.eventType === 'STAGE_CHANGED') {
    // Rule 1: Closed Won / Active Sales -> Trigger WMS Stock Allocation & Dispatch Alert
    if (event.newStage === 'Active Sales' || event.newStage === 'Closed Deals' || event.newStage === 'Logistics') {
      triggeredRules.push('AUTO_RESERVE_WMS_STOCK');
      notifications.push(
        `WMS Alert: Automatic picking reservation queued for ${event.contact.company || event.contact.name} (£${(event.contact.dealValue || 0).toLocaleString()})`
      );

      triggeredRules.push('GENERATE_FINANCE_INVOICE_DRAFT');
      notifications.push(
        `Finance Memo: Statutory VAT invoice draft auto-staged for ${event.contact.company || event.contact.name}.`
      );
    }

    // Rule 2: Move to Retention/CS -> SLA Ticket Provisioning
    if (event.newStage === 'Retention / CS' || event.newStage === 'Customer Services') {
      triggeredRules.push('PROVISION_CS_SLA_TARGET');
      notifications.push(
        `CS SLA Activated: 48-hour onboarding triage window assigned to Customer Services desk.`
      );
    }

    // Rule 3: Win-Back Inactive Automation
    if (event.newStage === 'Win-Backs') {
      triggeredRules.push('SCHEDULE_WINBACK_NURTURE');
      notifications.push(
        `Marketing Cadence: Auto-enrolled ${event.contact.name} into inactive win-back nurture sequence.`
      );
    }
  }

  return {
    triggeredRules,
    notifications,
  };
}
