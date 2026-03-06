export interface Space {
  id: string;
  name: string;
}

export interface List {
  id: string;
  name: string;
  space_id?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Priority {
  id?: string;
  priority: string;
  color?: string;
  orderindex?: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  status: {
    status: string;
    color: string;
    type: string;
  };
  priority: Priority | null;
  assignees: User[];
  list: {
    id: string;
    name: string;
  };
  url: string;
}

export type SessionStatus = "active" | "paused" | "archived";

export interface JulesSession {
  sessionId: string;
  taskId: string;
  status: SessionStatus;
  repoPath: string;
  branchName?: string;
  prLink?: string;
  lastActivity?: string;
}

export interface Activity {
  id: string;
  type: string;
  timestamp: string;
  details: any;
}

export type SpaceRepoMapping = Record<string, string>;

export type ActiveJulesSessions = Record<string, JulesSession>;
