import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Person, Startup } from "./types";
import {
  SECTOR_LABEL,
  STAGE_LABEL,
  ROLE_CATEGORY_LABEL,
  AVAILABILITY_LABEL,
  COMP_EXPECTATION_LABEL,
  NETWORK_LABEL,
} from "./labels";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function personRow(p: Person): string[] {
  return [
    p.name,
    p.email ?? "",
    p.headline,
    ROLE_CATEGORY_LABEL[p.role_category] ?? p.role_category,
    AVAILABILITY_LABEL[p.availability] ?? p.availability,
    String(p.years_experience),
    p.sectors_of_interest.map((s) => SECTOR_LABEL[s] ?? s).join("; "),
    p.stage_preference.map((s) => STAGE_LABEL[s] ?? s).join("; "),
    p.skills.join("; "),
    COMP_EXPECTATION_LABEL[p.comp_expectation_type] ?? p.comp_expectation_type,
    p.comp_min_salary_usd != null ? `$${p.comp_min_salary_usd.toLocaleString()}` : "",
    p.location_city,
    p.remote_ok ? "Yes" : "No",
    NETWORK_LABEL[p.primary_network] ?? p.primary_network,
    (p.university_affiliations ?? []).join("; "),
    (p.mission_keywords ?? []).join("; "),
    p.risk_tolerance ?? "",
    p.bio ?? "",
  ];
}

function startupRow(s: Startup): string[] {
  return [
    s.name,
    s.one_liner,
    SECTOR_LABEL[s.sector] ?? s.sector,
    (s.sectors_secondary ?? []).map((x) => SECTOR_LABEL[x] ?? x).join("; "),
    STAGE_LABEL[s.stage] ?? s.stage,
    s.funding_status,
    `$${s.total_raised_usd.toLocaleString()}`,
    String(s.team_size),
    s.location_city,
    s.remote_ok ? "Yes" : "No",
    s.roles_needed.join("; "),
    s.role_categories_open_to.map((r) => ROLE_CATEGORY_LABEL[r] ?? r).join("; "),
    s.availability_open_to.map((a) => AVAILABILITY_LABEL[a] ?? a).join("; "),
    s.seeking_investment ? "Yes" : "No",
    s.target_raise_usd != null ? `$${s.target_raise_usd.toLocaleString()}` : "",
    COMP_EXPECTATION_LABEL[s.comp_offered_type] ?? s.comp_offered_type,
    s.required_skills.join("; "),
    (s.mission_keywords ?? []).join("; "),
    s.description ?? "",
  ];
}

const PERSON_HEADERS = [
  "Name", "Email", "Headline", "Role", "Availability", "Years Exp",
  "Sectors", "Stage Pref", "Skills", "Comp Type", "Min Salary",
  "City", "Remote", "Network", "University", "Mission Keywords",
  "Risk Tolerance", "Bio",
];

const STARTUP_HEADERS = [
  "Name", "One-Liner", "Sector", "Secondary Sectors", "Stage",
  "Funding Status", "Total Raised", "Team Size", "City", "Remote",
  "Roles Needed", "Role Categories", "Availability", "Seeking Investment",
  "Target Raise", "Comp Offered", "Required Skills", "Mission Keywords",
  "Description",
];

export function exportCsv(people: Person[], startups: Startup[]) {
  let csv = "--- PEOPLE ---\n";
  csv += PERSON_HEADERS.map(escapeCsv).join(",") + "\n";
  for (const p of people) {
    csv += personRow(p).map(escapeCsv).join(",") + "\n";
  }

  csv += "\n--- STARTUPS ---\n";
  csv += STARTUP_HEADERS.map(escapeCsv).join(",") + "\n";
  for (const s of startups) {
    csv += startupRow(s).map(escapeCsv).join(",") + "\n";
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `nucleus-export-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportPdf(people: Person[], startups: Startup[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.setTextColor(15, 44, 79);
  doc.text("Nucleus Institute — Data Export", 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 40, 56);

  doc.setFontSize(14);
  doc.setTextColor(15, 44, 79);
  doc.text("People", 40, 80);

  autoTable(doc, {
    startY: 90,
    head: [PERSON_HEADERS],
    body: people.map(personRow),
    styles: { fontSize: 6, cellPadding: 3 },
    headStyles: { fillColor: [15, 44, 79], textColor: 255, fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
  });

  doc.addPage("a4", "landscape");
  doc.setFontSize(14);
  doc.setTextColor(15, 44, 79);
  doc.text("Startups", 40, 40);

  autoTable(doc, {
    startY: 50,
    head: [STARTUP_HEADERS],
    body: startups.map(startupRow),
    styles: { fontSize: 6, cellPadding: 3 },
    headStyles: { fillColor: [15, 44, 79], textColor: 255, fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 20, right: 20 },
  });

  doc.save(`nucleus-export-${new Date().toISOString().slice(0, 10)}.pdf`);
}
