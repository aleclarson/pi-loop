import { signal } from "@preact/signals";
import {
  Space,
  Task,
  List,
  JulesSession,
  SpaceRepoMapping,
  ActiveJulesSessions,
} from "./types";

export type View = "settings" | "tasks" | "welcome";

export const currentView = signal<View>("welcome");

export const spaces = signal<Space[]>([]);

export const selectedSpaceId = signal<string | null>(null);

export const lists = signal<List[]>([]);

export const selectedListId = signal<string | null>(null);

export const tasks = signal<Task[]>([]);

export const settings = signal<{ clickup_pat: string; jules_api_key: string }>({
  clickup_pat: "",
  jules_api_key: "",
});

export const activeSession = signal<JulesSession | null>(null);

export const julesSessions = signal<ActiveJulesSessions>({});

// Mappings: spaceId -> repoPath
export const repoMappings = signal<SpaceRepoMapping>({});

// Mutation functions
export function navigateTo(view: View) {
  currentView.value = view;
}

export function selectSpace(id: string | null) {
  selectedSpaceId.value = id;
}

export function selectList(id: string | null) {
  selectedListId.value = id;
}

export function initializeSettings(newSettings: { clickup_pat: string; jules_api_key: string }) {
  settings.value = newSettings;
}

export function saveSettings(newSettings: { clickup_pat: string; jules_api_key: string }) {
    settings.value = newSettings;
}

export function clearActiveSession() {
  activeSession.value = null;
}

export function startActiveSession(session: JulesSession) {
  activeSession.value = session;
}

export function loadJulesSessions(sessions: ActiveJulesSessions) {
  julesSessions.value = sessions;
}

export function registerJulesSession(session: JulesSession) {
  julesSessions.value = { ...julesSessions.value, [session.taskId]: session };
}

export function loadRepoMappings(mappings: SpaceRepoMapping) {
  repoMappings.value = mappings;
}

export function mapSpaceToRepo(spaceId: string, path: string) {
  repoMappings.value = { ...repoMappings.value, [spaceId]: path };
}

export function updateSessionPrLink(taskId: string, prUrl: string) {
  const session = julesSessions.value[taskId];
  if (session) {
    const updatedSession = { ...session, prLink: prUrl };
    julesSessions.value = { ...julesSessions.value, [taskId]: updatedSession };

    // Update activeSession if it matches
    if (activeSession.value?.sessionId === session.sessionId) {
      activeSession.value = { ...activeSession.value, prLink: prUrl };
    }
  }
}
