import { fetch } from "@tauri-apps/plugin-http";
import { storeService } from "./store";
import { Activity } from "../types";

const API_BASE = "https://jules.googleapis.com/v1alpha";

export class JulesService {
  private async getHeaders(): Promise<HeadersInit> {
    const apiKey = await storeService.getJulesApiKey();
    if (!apiKey) throw new Error("Jules API Key not configured");
    return {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    };
  }

  async createSession(prompt: string, sourceContext: any): Promise<any> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({
        prompt,
        sourceContext,
      }),
    });
    if (!response.ok)
      throw new Error(`Failed to create session: ${response.statusText}`);
    return await response.json();
  }

  async getSession(sessionId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });
    if (!response.ok)
      throw new Error(`Failed to get session: ${response.statusText}`);
    return await response.json();
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/sessions/${sessionId}:sendMessage`,
      {
        method: "POST",
        headers: await this.getHeaders(),
        body: JSON.stringify({ message }),
      },
    );
    if (!response.ok)
      throw new Error(`Failed to send message: ${response.statusText}`);
  }

  async listActivities(sessionId: string): Promise<Activity[]> {
    const response = await fetch(
      `${API_BASE}/sessions/${sessionId}/activities`,
      {
        method: "GET",
        headers: await this.getHeaders(),
      },
    );
    if (!response.ok)
      throw new Error(`Failed to list activities: ${response.statusText}`);
    const data = await response.json();
    return data.activities;
  }

  async approvePlan(sessionId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/sessions/${sessionId}:approvePlan`,
      {
        method: "POST",
        headers: await this.getHeaders(),
      },
    );
    if (!response.ok)
      throw new Error(`Failed to approve plan: ${response.statusText}`);
  }
}

export const julesService = new JulesService();
