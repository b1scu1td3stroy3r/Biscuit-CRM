import { db, ProjectTask } from './db';

export async function syncTaskToGoogleCalendar(accessToken: string, task: ProjectTask) {
  const eventBody = {
    summary: `🍪 Biscuit CRM: ${task.title} (${task.companyName})`,
    description: `Milestone managed directly by Biscuit CRM. Progress: ${task.progress}%`,
    start: {
      date: task.startDate,
    },
    end: {
      date: task.endDate,
    },
  };

  if (task.calendarEventId) {
    // Update existing Google Calendar event
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.calendarEventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
    if (!res.ok) throw new Error('Failed to update Calendar milestone');
    return task.calendarEventId;
  } else {
    // Create new Google Calendar event
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
    if (!res.ok) throw new Error('Failed to create Calendar milestone');
    const createdEvent = await res.json();
    return createdEvent.id;
  }
}
