import { useState } from "preact/hooks";
import { storeService } from "../services/store";
import { settings, saveSettings, navigateTo } from "../state";
import styles from "./SettingsView.module.css";

export function SettingsView() {
  const [localSettings, setLocalSettings] = useState(settings.peek());
  const [focusedField, setFocusedField] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <h2>Settings</h2>
      <div className={styles.field}>
        <label className={styles.label}>ClickUp PAT</label>
        <input
          type={focusedField === "clickup_pat" ? "text" : "password"}
          className={styles.input}
          value={localSettings.clickup_pat}
          onInput={(e) => setLocalSettings({ ...localSettings, clickup_pat: (e.target as HTMLInputElement).value })}
          onFocus={() => setFocusedField("clickup_pat")}
          onBlur={() => setFocusedField(null)}
          placeholder="pk_..."
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Jules API Key</label>
        <input
          type={focusedField === "jules_api_key" ? "text" : "password"}
          className={styles.input}
          value={localSettings.jules_api_key}
          onInput={(e) => setLocalSettings({ ...localSettings, jules_api_key: (e.target as HTMLInputElement).value })}
          onFocus={() => setFocusedField("jules_api_key")}
          onBlur={() => setFocusedField(null)}
          placeholder="AI..."
        />
      </div>

      <button
        className={styles.saveButton}
        onClick={async () => {
          saveSettings(localSettings);
          await storeService.setClickUpPat(localSettings.clickup_pat);
          await storeService.setJulesApiKey(localSettings.jules_api_key);
          alert("Settings saved!");
          navigateTo("welcome");
        }}
      >
        Save and Continue
      </button>
    </div>
  );
}
