/**
 * Demo accounts shared by scripts/seed-demo.ts (creates them) and
 * e2e/walkthrough.spec.ts (signs in as them). One account per role.
 */
export type DemoRole = "pm" | "ui" | "website" | "backend" | "mobile" | "ai";

export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_TEAM_SLUG = "demo-team";
export const DEMO_PROJECT_SLUG = "checkout";

export const DEMO_USERS: { role: DemoRole; name: string; email: string; label: string }[] = [
  { role: "pm", name: "Pim (PM)", email: "demo-pm@introverthubs.local", label: "PM" },
  { role: "ui", name: "Ung (UI)", email: "demo-ui@introverthubs.local", label: "UI" },
  { role: "website", name: "Wan (Website)", email: "demo-website@introverthubs.local", label: "Website" },
  { role: "backend", name: "Boat (Backend)", email: "demo-backend@introverthubs.local", label: "Backend" },
  { role: "mobile", name: "Mint (Mobile)", email: "demo-mobile@introverthubs.local", label: "Mobile" },
  { role: "ai", name: "Aum (AI Dev)", email: "demo-ai@introverthubs.local", label: "AI Dev" },
];
