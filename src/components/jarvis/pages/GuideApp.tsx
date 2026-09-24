"use client";

const BLOCKS = [
  {
    title: "Today · Jarvis",
    body: "The first Command Center card is the day snapshot: clock, greeting, and what slipped or is due. It is not a chat. Agent conversation stays in the Agents office.",
    samples: [
      "What’s on my plate this morning?",
      "What slipped on the board?",
    ],
  },
  {
    title: "Reminders",
    body: "Tell Jarvis what to bring back to your attention. It lands on the Command Center.",
    samples: [
      "Remind me tomorrow at 8am to call about the Harbourside renewal.",
      "Urgent reminder Friday at 2pm: send the session recap.",
      "Remind me next Monday to check the backup repo.",
    ],
  },
  {
    title: "Tasks",
    body: "Use these for work that should appear in the Tasks widget and the Agents office.",
    samples: [
      "Add a task for today: review the Orbit Prism dashboard.",
      "Add a high-priority task for tomorrow: draft Wednesday’s agenda.",
      "Add a task to the website redesign: test capture examples.",
    ],
  },
  {
    title: "Projects",
    body: "Use these for larger streams that collect tasks and goals.",
    samples: [
      "Start a project called Orbit polish.",
      "Add a project: Wednesday onboarding session.",
      "Create project: personal operating setup, target next Friday.",
    ],
  },
  {
    title: "Goals",
    body: "Use these for outcomes you want to track over time.",
    samples: [
      "Set a goal: make Orbit useful every morning by July 1.",
      "Add a goal for Orbit: capture tasks by text every day this week.",
      "Goal: finish the dry run, 25% progress.",
    ],
  },
];

export function GuideApp() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <p className="hud-label">Text or chat</p>
      <h1 className="serif mt-3 text-[34px] font-bold">Add things to the hub in plain English.</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Send Jarvis a normal message from Agents. If it sounds like a reminder, task, project, or saved
        link, Jarvis writes it to this private hub. It then shows up on the Command Center.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {BLOCKS.map((b) => (
          <section key={b.title} className="hud-panel p-4">
            <h2 className="text-[15px] font-semibold">{b.title}</h2>
            <p className="mt-1 text-[12px] text-ink-soft">{b.body}</p>
            <ul className="mt-3 space-y-2">
              {b.samples.map((s) => (
                <li key={s} className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px]">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
