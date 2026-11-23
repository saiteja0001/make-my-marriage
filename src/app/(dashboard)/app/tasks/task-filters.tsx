"use client";

import Link from "next/link";
import { useState } from "react";
import type { taskOptions } from "@/modules/tasks/service";
import { taskPriorities, taskStatuses, type TaskFilters as TaskFiltersValues } from "@/modules/tasks/validation";
import styles from "./tasks.module.css";

export function TaskFilters({ view, filters, options, clearUrl }: {
  view: "all" | "mine" | "completed";
  filters: TaskFiltersValues;
  options: Awaited<ReturnType<typeof taskOptions>>;
  clearUrl: string;
}) {
  const activeCount = [filters.priority, filters.eventId, view !== "mine" && filters.assignedMembershipId,
    view !== "completed" && filters.status].filter(Boolean).length;
  const [expanded, setExpanded] = useState(activeCount > 0);
  return (
    <form method="get" action="/app/tasks" className={styles.filters} aria-label="Search and filter tasks">
      {view !== "all" && <input type="hidden" name="view" value={view} />}
      <div className={styles.filterSearch}>
        <label className={styles.search}>
          <span className="sr-only">Search tasks by title</span>
          <input name="q" type="search" maxLength={100} placeholder="Search task titles" defaultValue={filters.q} />
        </label>
        <button type="submit" className={styles.secondary}>Search</button>
        <button type="button" className={styles.filterToggle + " " + styles.secondary} aria-expanded={expanded}
          aria-controls="task-filter-controls" onClick={() => setExpanded(!expanded)}>
          Filters{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>
      <div className={styles.filterPanel} id="task-filter-controls" data-open={expanded}>
        {view !== "completed" && <label>Status
          <select name="status" defaultValue={filters.status || ""}>
            <option value="">All statuses</option>
            {Object.entries(taskStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        <label>Priority
          <select name="priority" defaultValue={filters.priority || ""}>
            <option value="">All priorities</option>
            {Object.entries(taskPriorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {view !== "mine" && <label>Assignee
          <select name="assignedMembershipId" defaultValue={filters.assignedMembershipId || ""}>
            <option value="">All members</option>
            <option value="none">Unassigned</option>
            {options.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            {filters.assignedMembershipId && filters.assignedMembershipId !== "none"
              && !options.members.some(({ id }) => id === filters.assignedMembershipId)
              && <option value={filters.assignedMembershipId}>Former member</option>}
          </select>
        </label>}
        <label>Event
          <select name="eventId" defaultValue={filters.eventId || ""}>
            <option value="">All events</option>
            <option value="none">No related event</option>
            {options.events.map(({ id, name, archivedAt }) => (
              <option key={id} value={id}>{name}{archivedAt ? " (archived)" : ""}</option>
            ))}
            {filters.eventId && filters.eventId !== "none" && !options.events.some(({ id }) => id === filters.eventId)
              && <option value={filters.eventId}>Unavailable event</option>}
          </select>
        </label>
        <button type="submit" className={styles.secondary}>Apply filters</button>
      </div>
      {(activeCount > 0 || filters.q) && <Link className={styles.textAction} href={clearUrl}>Clear all filters</Link>}
    </form>
  );
}
