import { defaultAppearance, type JarvisAppearance } from "./jarvis-appearance";

export type JarvisSection =
  | "dashboard"
  | "briefing"
  | "calendar"
  | "knowledge"
  | "notepad"
  | "scheduling"
  | "crm"
  | "meetings"
  | "guide"
  | "settings";

export interface JarvisProfile {
  displayName: string;
  shortName: string;
  ownerName: string;
  tagline: string;
  timezone: string;
  logoUrl?: string;
}

export interface JarvisTask {
  id: string;
  title: string;
  project: string | null;
  due: number;
  progress: number;
  status: "todo" | "in_progress" | "waiting" | "done";
  priority: "high" | "normal";
}

export interface JarvisEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  calendar: "Orbit" | "Personal";
  location?: string;
  with?: string;
}

export interface JarvisHabit {
  id: string;
  title: string;
  block: "morning" | "afternoon" | "evening";
}

export interface JarvisArticle {
  id: string;
  title: string;
  url: string;
  category: string;
  note: string;
  savedAt: number;
}

export interface JarvisNote {
  id: string;
  title: string;
  body: string;
  project: string;
  labels: string[];
  updatedAt: number;
  createdAt: number;
}

export interface JarvisProposal {
  id: string;
  name: string;
  email: string;
  subject: string;
  summary: string;
  kind: "client" | "normal";
  minutes: number;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  options: { start: number; label: string; channel: string }[];
}

export interface JarvisContact {
  id: string;
  name: string;
  email: string;
  label: string;
  category: string;
  status: "Active" | "Paused";
  lastEngagement: number;
}

export interface JarvisMeeting {
  id: string;
  title: string;
  when: number;
  attendees: string;
  notes: string;
}

export interface JarvisGoal {
  id: string;
  title: string;
  category: string;
  daysLeft: number | null;
  progress: number;
}

export interface JarvisReminder {
  id: string;
  title: string;
  when: number;
  done: boolean;
}

export interface JarvisReply {
  id: string;
  name: string;
  note: string;
  daysWaiting: number;
  done: boolean;
}

export interface JarvisProject {
  id: string;
  title: string;
  status: "active" | "upcoming" | "done";
  done: number;
  total: number;
  detail: string;
  progress: number;
}

export interface JarvisCrmTaxonomy {
  labels: string[];
  categories: string[];
  statuses: string[];
}

export interface JarvisHub {
  profile: JarvisProfile;
  habitsDone: string[];
  articles: JarvisArticle[];
  notes: JarvisNote[];
  proposals: JarvisProposal[];
  extraEvents: JarvisEvent[];
  goals: JarvisGoal[];
  reminders: JarvisReminder[];
  replies: JarvisReply[];
  projects: JarvisProject[];
  appearance: JarvisAppearance;
  crm: JarvisCrmTaxonomy;
  greetings: string[];
}

function day(offset: number, hour = 9, minute = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

export function defaultProfile(username: string): JarvisProfile {
  const owner = username.replace(/^guest-.*/i, "there").replace(/[_-]+/g, " ");
  const pretty = owner.charAt(0).toUpperCase() + owner.slice(1);
  return {
    displayName: "Orbit Prism Command Center",
    shortName: "Orbit Prism",
    ownerName: pretty === "There" ? "there" : pretty,
    tagline: "Your whole operation, one dashboard",
    timezone: "America/New_York",
    logoUrl: "/profile.png",
  };
}

export function seedTasks(): JarvisTask[] {
  return [
    {
      id: "t_site",
      title: "Review homepage mockups with Wei Chen",
      project: "Website redesign",
      due: day(0, 14, 0),
      progress: 35,
      status: "in_progress",
      priority: "high",
    },
    {
      id: "t_move",
      title: "Send revised proposal to Harbourside",
      project: "Office move",
      due: day(1, 11, 0),
      progress: 10,
      status: "todo",
      priority: "normal",
    },
    {
      id: "t_inv",
      title: "Chase Loop Health on the overdue Q3 invoice",
      project: null,
      due: day(-2, 9, 0),
      progress: 0,
      status: "waiting",
      priority: "high",
    },
    {
      id: "t_onboard",
      title: "Approve Elena Ruiz’s onboarding checklist",
      project: "Website redesign",
      due: day(2, 16, 0),
      progress: 0,
      status: "todo",
      priority: "normal",
    },
  ];
}

export function seedEvents(): JarvisEvent[] {
  return [
    {
      id: "e_mock",
      title: "Review homepage mockups with Wei Chen",
      start: day(0, 14, 0),
      end: day(0, 14, 30),
      calendar: "Orbit",
      with: "wei@northwind.store",
    },
    {
      id: "e_gym",
      title: "Gym",
      start: day(0, 17, 30),
      end: day(0, 18, 30),
      calendar: "Personal",
    },
    {
      id: "e_status",
      title: "Status call: Amara Okafor / Harbourside",
      start: day(1, 10, 0),
      end: day(1, 10, 45),
      calendar: "Orbit",
      location: "Zoom",
      with: "amara@harbourside.vc",
    },
    {
      id: "e_onboard",
      title: "Onboarding session: Elena Ruiz",
      start: day(1, 13, 0),
      end: day(1, 14, 0),
      calendar: "Orbit",
      location: "Queens studio",
    },
    {
      id: "e_walk",
      title: "Lease walkthrough with Meridian",
      start: day(2, 11, 0),
      end: day(2, 12, 0),
      calendar: "Orbit",
      location: "40 W 23rd",
    },
    {
      id: "e_news",
      title: "Newsletter planning block",
      start: day(3, 15, 0),
      end: day(3, 17, 0),
      calendar: "Personal",
    },
    {
      id: "e_nick",
      title: "Status call with Sam Devlin",
      start: day(4, 10, 0),
      end: day(4, 10, 30),
      calendar: "Orbit",
      location: "Zoom",
    },
  ];
}

export function seedHabits(): JarvisHabit[] {
  return [
    { id: "h_workout", title: "Morning workout", block: "morning" },
    { id: "h_pri", title: "Review today's priorities", block: "morning" },
    { id: "h_inbox", title: "Inbox zero sweep", block: "afternoon" },
    { id: "h_wins", title: "Log the day's wins", block: "evening" },
    { id: "h_read", title: "Read 20 minutes", block: "evening" },
  ];
}

export function seedArticles(): JarvisArticle[] {
  const now = Date.now();
  return [
    {
      id: "a_price",
      title: "Pricing psychology for service businesses",
      url: "https://example.com/pricing-psychology",
      category: "Business",
      note: "Anchor high, show three tiers, name the middle one.",
      savedAt: now - 3600_000,
    },
    {
      id: "a_seo",
      title: "Local SEO checklist",
      url: "https://example.com/local-seo",
      category: "Marketing",
      note: "Google Business Profile, reviews cadence, service pages.",
      savedAt: now - 7200_000,
    },
    {
      id: "a_hire",
      title: "First ops hire guide",
      url: "https://example.com/first-ops-hire",
      category: "Inbox",
      note: "When to hire, scorecard template, 90-day plan.",
      savedAt: now - 10800_000,
    },
  ];
}

export function seedNotes(): JarvisNote[] {
  const now = Date.now();
  return [
    {
      id: "n_amara",
      title: "Harbourside call prep",
      body:
        "Q3 numbers up 18%. Push back on weekly calls — offer a biweekly written update. Raise the renewal 60 days early.\n\nAsk Amara about the fatigued ad set and whether they want Brand to rebuild the creative pack this sprint.",
      project: "Harbourside",
      labels: ["Meetings"],
      updatedAt: now - 1200_000,
      createdAt: now - 86400_000,
    },
    {
      id: "n_move",
      title: "Office move checklist",
      body: "Moving quote (2 bids), IT cutover plan, update address everywhere, tell the team 30 days out.",
      project: "Office move",
      labels: ["Ideas"],
      updatedAt: now - 5400_000,
      createdAt: now - 172800_000,
    },
    {
      id: "n_news",
      title: "Newsletter angle ideas",
      body: "Behind the scenes of the redesign — 5 tools we actually pay for — Client spotlight.",
      project: "Website redesign",
      labels: ["Ideas"],
      updatedAt: now - 7200_000,
      createdAt: now - 259200_000,
    },
  ];
}

export function seedProposals(): JarvisProposal[] {
  return [
    {
      id: "p_devlin",
      name: "Sam Devlin",
      email: "sam@meridianlog.com",
      subject: "Intro call re: automation package",
      summary:
        "Warm lead via Elena. Wants the social scheduling + member follow-up package. Noted that you built their old system. Would love 30 minutes this week to walk through what a gym-scale rollout looks like.",
      kind: "client",
      minutes: 30,
      confidence: 92,
      status: "pending",
      options: [
        { start: day(2, 9, 0), label: "Thu 9:00 AM", channel: "Zoom" },
        { start: day(2, 15, 0), label: "Thu 3:00 PM", channel: "Zoom" },
        { start: day(3, 10, 0), label: "Fri 10:00 AM", channel: "Zoom" },
      ],
    },
    {
      id: "p_chen",
      name: "Wei Chen",
      email: "wei@northwind.store",
      subject: "Pricing follow-up",
      summary:
        "Warm lead, asked about pricing twice. Short qualification call. Second time asking about pricing. Can we get 15 minutes on the calendar?",
      kind: "normal",
      minutes: 15,
      confidence: 86,
      status: "pending",
      options: [
        { start: day(1, 16, 0), label: "Wed 4:00 PM", channel: "Zoom" },
        { start: day(3, 12, 0), label: "Fri 12:00 PM", channel: "Zoom" },
      ],
    },
  ];
}

export function seedContacts(): JarvisContact[] {
  return [
    {
      id: "c_amara",
      name: "Amara Okafor",
      email: "amara@harbourside.vc",
      label: "engaged",
      category: "Community",
      status: "Active",
      lastEngagement: day(-4, 12),
    },
    {
      id: "c_elena",
      name: "Elena Ruiz",
      email: "elena@lumenhealth.io",
      label: "referral-source",
      category: "Partner",
      status: "Active",
      lastEngagement: day(-2, 15),
    },
    {
      id: "c_wei",
      name: "Wei Chen",
      email: "wei@northwind.store",
      label: "new-lead",
      category: "Lead",
      status: "Active",
      lastEngagement: day(-5, 11),
    },
    {
      id: "c_sam",
      name: "Sam Devlin",
      email: "sam@meridianlog.com",
      label: "warm-lead",
      category: "Lead",
      status: "Active",
      lastEngagement: day(-3, 16),
    },
    {
      id: "c_loop",
      name: "Priya Shah",
      email: "priya@loop.health",
      label: "warm-lead",
      category: "Lead",
      status: "Active",
      lastEngagement: day(-1, 10),
    },
  ];
}

export function seedMeetings(): JarvisMeeting[] {
  return [
    {
      id: "m_q",
      title: "Quarterly review: Harbourside",
      when: day(-2, 10, 0),
      attendees: "Amara Okafor, you",
      notes:
        "Renewal conversation opened. They want a written biweekly instead of the weekly call. Creative fatigue on the paid set — Brand should rebuild.",
    },
    {
      id: "m_kick",
      title: "Onboarding kickoff: Lumen Health",
      when: day(-8, 14, 30),
      attendees: "Elena Ruiz, Account Management",
      notes: "Studio walkthrough booked. Elena is the day-to-day. Vault folder created.",
    },
    {
      id: "m_home",
      title: "Homepage design review v1",
      when: day(-12, 15, 0),
      attendees: "Wei Chen, Brand",
      notes: "Three directions. They leaned toward the quieter serif lockup. Next pass Wednesday.",
    },
  ];
}

export function seedGoals(): JarvisGoal[] {
  return [
    { id: "g_site", title: "Launch redesigned website", category: "Founder", daysLeft: 146, progress: 80 },
    { id: "g_rev", title: "Hit $40K monthly revenue", category: "Founder", daysLeft: 93, progress: 65 },
    { id: "g_news", title: "Grow newsletter to 5,000 subscribers", category: "Creator", daysLeft: 123, progress: 35 },
    { id: "g_gym", title: "Work out 4× a week", category: "Health", daysLeft: null, progress: 50 },
  ];
}

export function seedReminders(): JarvisReminder[] {
  return [
    { id: "r_wei", title: "Send Wei the written update", when: day(0, 16, 0), done: false },
    { id: "r_elena", title: "Nudge Elena on the testimonial", when: day(2, 10, 0), done: false },
    { id: "r_ins", title: "Insurance renewal deadline", when: day(10, 9, 0), done: false },
  ];
}

export function seedProjects(): JarvisProject[] {
  return [
    {
      id: "pr_onboard",
      title: "Q3 Client Onboarding",
      status: "active",
      done: 0,
      total: 2,
      detail: "3 of 5 clients onboarded",
      progress: 0,
    },
    {
      id: "pr_site",
      title: "Website Redesign",
      status: "active",
      done: 1,
      total: 2,
      detail: "Homepage approved, inner pages in review",
      progress: 50,
    },
    {
      id: "pr_move",
      title: "Office move",
      status: "upcoming",
      done: 0,
      total: 4,
      detail: "Lease walkthrough still on the calendar",
      progress: 10,
    },
  ];
}

export function seedReplies(): JarvisReply[] {
  return [
    { id: "p_priya", name: "Priya Shah", note: "Q3 invoice, 12 days overdue", daysWaiting: 12, done: false },
    { id: "p_wei", name: "Wei Chen", note: "Confirm Thursday’s status call", daysWaiting: 3, done: false },
    { id: "p_elena", name: "Elena Ruiz", note: "Testimonial ask, second nudge", daysWaiting: 6, done: false },
  ];
}

export function emptyHub(username: string): JarvisHub {
  return {
    profile: defaultProfile(username),
    habitsDone: [],
    articles: seedArticles(),
    notes: seedNotes(),
    proposals: seedProposals(),
    extraEvents: [],
    goals: seedGoals(),
    reminders: seedReminders(),
    replies: seedReplies(),
    projects: seedProjects(),
    appearance: defaultAppearance(),
    crm: defaultCrmTaxonomy(),
    greetings: defaultGreetings(),
  };
}

export function defaultCrmTaxonomy(): JarvisCrmTaxonomy {
  return {
    labels: ["vip", "warm lead", "prospect", "friend", "investor", "vendor"],
    categories: [
      "Client",
      "Friend",
      "Industry Associate",
      "Collaborator",
      "Investor",
      "Press / Media",
      "Founder",
      "Mentor",
    ],
    statuses: ["Active", "Nurturing", "Dormant", "Archived"],
  };
}

export function defaultGreetings(): string[] {
  return [
    "Hello, {name}.",
    "Welcome back, {name}.",
    "Good to see you, {name}.",
    "Ready when you are, {name}.",
    "At your service, {name}.",
    "Let's make it count, {name}.",
    "Big day ahead, {name}.",
    "Operations green, {name}.",
    "Standing by, {name}.",
    "Mission control online, {name}.",
  ];
}

export function pickGreeting(lines: string[], name: string, now = Date.now()): string {
  const list = lines.length ? lines : defaultGreetings();
  const day = Math.floor(now / 86400000);
  const line = list[day % list.length] || list[0];
  return line.replace(/\{name\}/gi, name);
}

export function greetingWord(now = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function dayProgress(now = new Date()): number {
  const start = new Date(now);
  start.setHours(6, 0, 0, 0);
  const end = new Date(now);
  end.setHours(22, 0, 0, 0);
  const p = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.min(1, Math.max(0, p));
}

export function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatClockHM(ts = Date.now()): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDayHead(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
