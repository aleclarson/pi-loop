import { load, Store } from "@tauri-apps/plugin-store";
import { SpaceRepoMapping, ActiveJulesSessions, JulesSession } from "../types";

const STORE_FILENAME = "app_settings.json";

export class StoreService {
  private storePromise: Promise<Store>;

  constructor() {
    this.storePromise = load(STORE_FILENAME, { autoSave: true, defaults: {} });
  }

  async getClickUpPat(): Promise<string | null> {
    const store = await this.storePromise;
    return (await store.get<string>("clickup_pat")) || null;
  }

  async setClickUpPat(pat: string): Promise<void> {
    const store = await this.storePromise;
    await store.set("clickup_pat", pat);
    await store.save();
  }

  async getJulesApiKey(): Promise<string | null> {
    const store = await this.storePromise;
    return (await store.get<string>("jules_api_key")) || null;
  }

  async setJulesApiKey(apiKey: string): Promise<void> {
    const store = await this.storePromise;
    await store.set("jules_api_key", apiKey);
    await store.save();
  }

  async getSpaceRepoMappings(): Promise<SpaceRepoMapping> {
    const store = await this.storePromise;
    return (await store.get<SpaceRepoMapping>("space_repo_mappings")) || {};
  }

  async setSpaceRepoMappings(mappings: SpaceRepoMapping): Promise<void> {
    const store = await this.storePromise;
    await store.set("space_repo_mappings", mappings);
    await store.save();
  }

  async getActiveJulesSessions(): Promise<ActiveJulesSessions> {
    const store = await this.storePromise;
    return (
      (await store.get<ActiveJulesSessions>("active_jules_sessions")) || {}
    );
  }

  async setActiveJulesSessions(sessions: ActiveJulesSessions): Promise<void> {
    const store = await this.storePromise;
    await store.set("active_jules_sessions", sessions);
    await store.save();
  }

  async getSession(taskId: string): Promise<JulesSession | null> {
    const sessions = await this.getActiveJulesSessions();
    return sessions[taskId] || null;
  }

  async get<T>(key: string): Promise<T | null> {
    const store = await this.storePromise;
    const val = await store.get<T>(key);
    return val ?? null;
  }

  async set(key: string, value: any): Promise<void> {
    const store = await this.storePromise;
    await store.set(key, value);
  }

  async save(): Promise<void> {
    const store = await this.storePromise;
    await store.save();
  }
}

export const storeService = new StoreService();
