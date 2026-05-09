import { useState } from "react";
import type { Person } from "../types";
import { ROLE_CATEGORY_LABEL, NETWORK_LABEL, AVAILABILITY_LABEL } from "../labels";
import { Avatar, DetailGroup, Pill, selectClass } from "../components/ui";
import { API_BASE_URL, setApiBase } from "../config";

interface SettingsPageProps {
  currentUser: Person;
  people: Person[];
  onSwitchUser: (id: string) => void;
  apiLive: boolean;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-24 mb-20">
      <div className="tiny-caps">{subtitle ?? title}</div>
      <h2 className="font-display text-[22px] text-nucleus-blue mt-4 mb-18">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-14 border-t border-pearl-200 gap-24">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-graphite">
          {label}
        </div>
        {description && (
          <div className="text-[12px] text-graphite-muted mt-2">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-40 h-22 rounded-[11px] border-none relative cursor-pointer transition-colors duration-200 ${
        checked ? "bg-nucleus-blue" : "bg-pearl-300"
      }`}
    >
      <div
        className="w-16 h-16 rounded-full bg-white absolute top-3 transition-[left] duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
        style={{ left: checked ? 21 : 3 }}
      />
    </button>
  );
}

export function SettingsPage({
  currentUser,
  people,
  onSwitchUser,
  apiLive,
}: SettingsPageProps) {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [matchNotifs, setMatchNotifs] = useState(true);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [apiDirty, setApiDirty] = useState(false);

  const handleApiSave = () => {
    setApiBase(apiUrl.trim());
    setApiDirty(false);
    window.location.reload();
  };

  return (
    <div className="max-w-[780px] mx-auto pt-32 px-32 pb-64">
      <div className="tiny-caps">Configuration</div>
      <h1 className="font-display text-[36px] font-normal text-nucleus-blue mt-4 mb-28 tracking-[-0.01em]">
        Settings
      </h1>

      {/* Account */}
      <Section title="Account" subtitle="Profile & identity">
        <div className="flex items-center gap-16 pb-16">
          <Avatar name={currentUser.name} size={56} tone="blue" />
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-medium text-graphite">
              {currentUser.name}
            </div>
            <div className="text-[13px] text-graphite-muted mt-2">
              {currentUser.headline}
            </div>
            <div className="flex gap-6 mt-8">
              <Pill tone="blue">
                {ROLE_CATEGORY_LABEL[currentUser.role_category]}
              </Pill>
              <Pill>{NETWORK_LABEL[currentUser.primary_network]}</Pill>
              <Pill>
                {AVAILABILITY_LABEL[currentUser.availability]}
              </Pill>
            </div>
          </div>
        </div>

        <SettingRow
          label="Active profile"
          description="Switch which person you're viewing the app as"
        >
          <select
            value={currentUser.id}
            onChange={(e) => onSwitchUser(e.target.value)}
            className={`${selectClass} w-220`}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Email" description="Contact email on file">
          <span className="font-mono text-[13px] text-graphite">
            {currentUser.email ?? "—"}
          </span>
        </SettingRow>

        <SettingRow label="Location">
          <span className="text-[13px] text-graphite">
            {currentUser.location_city}
            {currentUser.remote_ok && (
              <span className="text-graphite-muted ml-8">
                (remote OK)
              </span>
            )}
          </span>
        </SettingRow>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" subtitle="Alerts & digests">
        <SettingRow
          label="Email notifications"
          description="Receive match results and connection updates via email"
        >
          <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
        </SettingRow>
        <SettingRow
          label="New match alerts"
          description="Get notified when new high-fit matches appear"
        >
          <Toggle checked={matchNotifs} onChange={setMatchNotifs} />
        </SettingRow>
      </Section>

      {/* Matching */}
      <Section title="Matching" subtitle="Algorithm preferences">
        <DetailGroup label="Sectors of interest">
          <div className="flex flex-wrap gap-6">
            {currentUser.sectors_of_interest.map((s) => (
              <Pill key={s} tone="blue">
                {s.replace(/_/g, " ")}
              </Pill>
            ))}
            {currentUser.sectors_of_interest.length === 0 && (
              <span className="text-[12px] text-graphite-light">
                None selected
              </span>
            )}
          </div>
        </DetailGroup>

        <div className="mt-14">
          <DetailGroup label="Stage preferences">
            <div className="flex flex-wrap gap-6">
              {currentUser.stage_preference.map((s) => (
                <Pill key={s}>{s.replace(/_/g, " ")}</Pill>
              ))}
              {currentUser.stage_preference.length === 0 && (
                <span className="text-[12px] text-graphite-light">
                  None selected
                </span>
              )}
            </div>
          </DetailGroup>
        </div>

        <div className="mt-14">
          <DetailGroup label="Skills">
            <div className="flex flex-wrap gap-6">
              {currentUser.skills.slice(0, 8).map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
              {currentUser.skills.length > 8 && (
                <Pill>+{currentUser.skills.length - 8} more</Pill>
              )}
            </div>
          </DetailGroup>
        </div>

        <SettingRow
          label="Risk tolerance"
          description="Controls how aggressively the matcher weights early-stage, high-risk startups"
        >
          <span className="text-[13px] font-medium text-graphite capitalize">
            {currentUser.risk_tolerance ?? "medium"}
          </span>
        </SettingRow>
      </Section>

      {/* API / Connection */}
      <Section title="Connection" subtitle="Backend & API">
        <SettingRow label="Status">
          <div className="flex items-center gap-8">
            <div
              className={`w-8 h-8 rounded-full ${apiLive ? "bg-gold" : "bg-graphite-light"}`}
            />
            <span
              className={`font-mono text-[12px] ${apiLive ? "text-gold" : "text-graphite-muted"}`}
            >
              {apiLive ? "Connected" : "Offline"}
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="API endpoint"
          description="Backend URL. Changes require reload."
        >
          <div className="flex gap-8 items-center">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setApiDirty(true);
              }}
              className="font-mono w-240 py-7 px-10 rounded-[6px] border border-pearl-300 text-[12px] text-graphite bg-white"
            />
            {apiDirty && (
              <button className="btn btn-primary" onClick={handleApiSave}>
                Save
              </button>
            )}
          </div>
        </SettingRow>
      </Section>
    </div>
  );
}
