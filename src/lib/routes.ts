/** Single place that knows the shape of project-scoped URLs. */
export const projectHome = (slug: string) => `/app/${slug}`;
export const projectTasks = (slug: string) => `/app/${slug}/tasks`;
export const projectTaskNew = (slug: string) => `/app/${slug}/tasks/new`;
export const projectTask = (slug: string, taskId: string) => `/app/${slug}/tasks/${taskId}`;
export const projectDocs = (slug: string) => `/app/${slug}/docs`;
export const projectAnalytics = (slug: string) => `/app/${slug}/analytics`;
export const projectSettings = (slug: string) => `/app/${slug}/settings`;
export const TEAM_SETTINGS = "/app/team/settings";
export const OVERVIEW = "/app";
