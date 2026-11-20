import type { Metadata } from "next";
import { TaskList } from "../_components/wedding-lists";
import { demoWedding } from "@/app/_data/demo-wedding";

export const metadata: Metadata = { title: "Demo tasks" };

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-tight text-pine sm:text-5xl">Tasks</h1>
      <section aria-labelledby="wedding-checklist" className="panel max-w-3xl">
        <h2 id="wedding-checklist" className="border-b border-line px-4 py-4 font-display text-2xl text-pine sm:px-5">
          Wedding checklist
        </h2>
        <TaskList tasks={demoWedding.tasks} />
      </section>
    </div>
  );
}
