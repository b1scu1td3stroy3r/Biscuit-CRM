export interface CalendarSyncPayload {
  title: string;
  companyName: string;
  startDate: string;
  endDate: string;
  progress: number;
  calendarEventId?: string;
  synced?: boolean;
  updatedAt?: string;
}

export interface LeaveCalendarPayload {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export async function syncTaskToGoogleCalendar(accessToken: string, task: CalendarSyncPayload): Promise<string> {
  const event = {
    summary: `[Biscuit Milestone] ${task.title} - ${task.companyName}`,
    description: `Project phase for ${task.companyName}.\nProgress: ${task.progress}%\nLast modified: ${task.updatedAt || new Date().toISOString()}`,
    start: {
      date: task.startDate,
    },
    end: {
      date: task.endDate,
    },
  };

  const url = task.calendarEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.calendarEventId}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const method = task.calendarEventId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to sync milestone to Google Calendar (${res.status})`);
  }

  const data = await res.json();
  return data.id;
}

export async function syncLeaveToGoogleCalendar(accessToken: string, leave: LeaveCalendarPayload): Promise<string> {
  const event = {
    summary: `OOO: ${leave.employeeName} (${leave.leaveType})`,
    description: `Out of Office - ${leave.leaveType}\nNotes: ${leave.notes || 'None provided'}\nManaged via Biscuit CRM Employee Hub.`,
    start: {
      date: leave.startDate,
    },
    end: {
      date: leave.endDate,
    },
    transparency: 'opaque',
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create OOO event on Google Calendar (${res.status})`);
  }

  const data = await res.json();
  return data.id;
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok || res.status === 404 || res.status === 410;
  } catch (err) {
    console.warn('Could not delete calendar event:', err);
    return false;
  }
}

// ==========================================
// Microsoft 365 / Microsoft Graph Calendar Sync
// ==========================================

export async function syncLeaveToMicrosoftCalendar(accessToken: string, leave: LeaveCalendarPayload): Promise<string> {
  const event = {
    subject: `OOO: ${leave.employeeName} (${leave.leaveType})`,
    body: {
      contentType: 'text',
      content: `Out of Office - ${leave.leaveType}\nNotes: ${leave.notes || 'None provided'}\nManaged via Biscuit CRM Employee Hub.`,
    },
    start: {
      dateTime: `${leave.startDate}T09:00:00`,
      timeZone: 'Europe/London',
    },
    end: {
      dateTime: `${leave.endDate}T17:30:00`,
      timeZone: 'Europe/London',
    },
    showAs: 'oof',
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create OOO event on Microsoft 365 (${res.status})`);
  }

  const data = await res.json();
  return data.id;
}

export async function deleteMicrosoftCalendarEvent(accessToken: string, eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok || res.status === 404 || res.status === 410;
  } catch (err) {
    console.warn('Could not delete Microsoft Calendar event:', err);
    return false;
  }
}
