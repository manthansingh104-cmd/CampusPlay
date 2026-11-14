import { Navigate } from "react-router-dom";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useApp } from "../app/AppContext";
import { PageHeading } from "../components/UI";
import {
  downloadOrganizerCsv,
  downloadOrganizerPdf,
  organizerReportOptions,
  type OrganizerReport,
} from "../services/organizerExports";
import type { AppData } from "../types";

function scopeForOrganizer(data: AppData, sport?: string): AppData {
  if (!sport) return data;
  const tournaments = data.tournaments.filter((tournament) => tournament.sport === sport);
  const tournamentIds = new Set(tournaments.map((tournament) => tournament.id));
  return {
    ...data,
    tournaments,
    teams: data.teams.filter((team) => tournamentIds.has(team.tournamentId)),
    matches: data.matches.filter((match) => tournamentIds.has(match.tournamentId)),
    registrations: data.registrations.filter((registration) => tournamentIds.has(registration.tournamentId)),
  };
}

function reportCount(data: AppData, report: OrganizerReport): number {
  if (report === "summary") return 10;
  if (report === "tournaments") return data.tournaments.length;
  if (report === "registrations") return data.registrations.length;
  if (report === "teams") return data.teams.length;
  if (report === "fixtures") return data.matches.length;
  return data.matches.filter((match) => match.status === "completed").length;
}

export function OrganizerExports() {
  const { data, user, role, showToast } = useApp();
  if (role !== "organizer" || user?.role !== "organizer") {
    return <Navigate to="/app" replace />;
  }

  const reportData = scopeForOrganizer(data, user.sport);
  const scopeLabel = user.sport || "All sports";
  const download = async (report: OrganizerReport, format: "csv" | "pdf") => {
    try {
      if (format === "csv") downloadOrganizerCsv(reportData, report, user.sport);
      else await downloadOrganizerPdf(reportData, report, user.sport);
      showToast(`${format.toUpperCase()} report downloaded`);
    } catch {
      showToast(`Could not create the ${format.toUpperCase()} report`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${scopeLabel} organiser workspace`}
        title="Export reports"
        subtitle="Download sport-scoped tournament data as CSV spreadsheets or ready-to-share PDF reports."
      />

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Available reports">
        {organizerReportOptions.map((report) => (
          <article key={report.key} className="surface rounded-[20px] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{reportCount(reportData, report.key)} {report.key === "summary" ? "metrics" : "records"}</p>
                <h2 className="mt-1 text-base font-extrabold">{report.title}</h2>
                <p className="muted mt-1 max-w-md text-xs leading-relaxed">{report.description}</p>
              </div>
              <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[10px] font-bold">{scopeLabel}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={() => { void download(report.key, "csv"); }}
                className="btn-secondary !rounded-xl !py-2.5 text-xs"
              >
                <FileSpreadsheet size={15} /> Download CSV
              </button>
              <button
                type="button"
                onClick={() => { void download(report.key, "pdf"); }}
                className="btn-primary !rounded-xl !py-2.5 text-xs"
              >
                <FileText size={15} /> Download PDF
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
