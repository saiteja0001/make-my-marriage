// Shared fixture for the public landing previews and the demo workspace.
export type WeddingEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
};

export type WeddingTask = {
  id: string;
  name: string;
  dueDate: string;
  assignee: string;
  status: "To do" | "In progress" | "Completed";
};

const events: WeddingEvent[] = [
  { id: "mehendi", name: "Mehendi", date: "2027-02-12", time: "3:00 PM", venue: "Garden Courtyard" },
  { id: "haldi", name: "Haldi", date: "2027-02-13", time: "10:00 AM", venue: "Garden Courtyard" },
  { id: "sangeet", name: "Sangeet", date: "2027-02-13", time: "7:00 PM", venue: "Orchid Ballroom" },
  { id: "wedding", name: "Wedding ceremony", date: "2027-02-14", time: "6:30 PM", venue: "The Terrace" },
];

const tasks: WeddingTask[] = [
  { id: "tasting", name: "Confirm the menu tasting", dueDate: "2027-01-10", assignee: "Princi", status: "In progress" },
  { id: "guest-list", name: "Review the family guest list", dueDate: "2027-01-12", assignee: "Akshay", status: "To do" },
  { id: "photography", name: "Share the photo checklist", dueDate: "2027-01-15", assignee: "Princi", status: "To do" },
  { id: "music", name: "Confirm the Sangeet playlist", dueDate: "2027-01-20", assignee: "Akshay", status: "To do" },
  { id: "venue", name: "Book the wedding venue", dueDate: "2026-12-15", assignee: "Akshay", status: "Completed" },
  { id: "dates", name: "Confirm the ceremony dates", dueDate: "2026-12-20", assignee: "Princi", status: "Completed" },
];

export const demoWedding = {
  couple: "Princi & Akshay",
  date: "2027-02-14",
  location: "Dehradun, Uttarakhand",
  asOfDate: "2027-01-03",
  events,
  tasks,
  guests: { totalGroups: 84, responseCount: 52 },
};

export function formatDemoDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
