import {
  formatDemoDate,
  type WeddingEvent,
  type WeddingTask,
} from "@/app/_data/demo-wedding";

export function EventList({ events }: { events: WeddingEvent[] }) {
  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li key={event.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          <time
            dateTime={event.date}
            className="grid min-w-13 shrink-0 justify-items-center rounded-lg bg-blush px-2 py-1.5 text-clay"
          >
            <span className="text-xl leading-none font-semibold">
              {formatDemoDate(event.date, { day: "numeric" })}
            </span>
            <span className="mt-0.5 text-sm leading-tight">
              {formatDemoDate(event.date, { month: "short" })}
            </span>
          </time>
          <div className="min-w-0">
            <p className="font-medium">{event.name}</p>
            <p className="text-sm text-muted">{event.time} · {event.venue}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const taskStatusStyles: Record<WeddingTask["status"], string> = {
  "To do": "bg-paper text-muted",
  "In progress": "bg-blush text-clay",
  Completed: "bg-sage text-pine",
};

export function TaskList({ tasks }: { tasks: WeddingTask[] }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
        >
          <div className="min-w-0">
            <p className="font-medium">{task.name}</p>
            <p className="text-sm text-muted">
              {task.assignee} · Due{" "}
              <time dateTime={task.dueDate}>
                {formatDemoDate(task.dueDate, { day: "numeric", month: "short" })}
              </time>
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-sm font-medium ${taskStatusStyles[task.status]}`}>
            {task.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
