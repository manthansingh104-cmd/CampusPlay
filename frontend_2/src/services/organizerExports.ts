import { countUniqueParticipants } from "./domain";
import type { AppData, Match, Registration, Team, Tournament } from "../types";

export type OrganizerReport =
  | "summary"
  | "tournaments"
  | "registrations"
  | "teams"
  | "fixtures"
  | "results";

export const organizerReportOptions: Array<{
  key: OrganizerReport;
  title: string;
  description: string;
}> = [
  {
    key: "summary",
    title: "Season summary",
    description: "Key participation, tournament, and match totals.",
  },
  {
    key: "tournaments",
    title: "Tournaments",
    description: "Tournament details, capacity, registrations, teams, and fixtures.",
  },
  {
    key: "registrations",
    title: "Registrations & rosters",
    description: "Team/player submissions, captain, player names, and status.",
  },
  {
    key: "teams",
    title: "Teams & standings",
    description: "Team roster, captain, matches played, wins, losses, and points.",
  },
  {
    key: "fixtures",
    title: "Fixtures & schedule",
    description: "All fixtures with tournament, date, time, venue, and status.",
  },
  {
    key: "results",
    title: "Match results",
    description: "Completed fixtures, scores, and winners.",
  },
];

interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
}

const text = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "" : String(value);

function organizerName(tournament: Tournament): string {
  return tournament.organizer || "CampusPlay organiser";
}

function teamCaptain(data: AppData, team?: Team): string {
  return team
    ? data.users.find((user) => user.id === team.captainId)?.name ?? team.captainId
    : "—";
}

function rosterNames(data: AppData, registration: Registration): string {
  if (registration.playerNames.length) return registration.playerNames.join("; ");
  const team = data.teams.find((item) => item.id === registration.teamId);
  if (team) {
    return team.playerIds
      .map((id) => data.users.find((user) => user.id === id)?.name ?? id)
      .join("; ");
  }
  return data.users.find((user) => user.id === registration.studentId)?.name ?? "";
}

function tournamentForMatch(data: AppData, match: Match): Tournament | undefined {
  return data.tournaments.find((item) => item.id === match.tournamentId);
}

function fixtureRow(data: AppData, match: Match): string[] {
  const tournament = tournamentForMatch(data, match);
  const teamA = data.teams.find((team) => team.id === match.teamAId);
  const teamB = data.teams.find((team) => team.id === match.teamBId);
  const winner = data.teams.find((team) => team.id === match.winnerId);
  return [
    tournament?.name ?? "Tournament",
    tournament?.sport ?? "",
    match.round,
    match.date,
    match.time,
    teamA?.name ?? "Team A",
    teamB?.name ?? "Team B",
    match.scoreA ?? "",
    match.scoreB ?? "",
    winner?.name ?? "",
    match.venue,
    match.status,
  ];
}

export function buildOrganizerReport(
  data: AppData,
  report: OrganizerReport,
): ReportTable {
  if (report === "summary") {
    const statusCounts = ["registration_open", "upcoming", "live", "completed"]
      .map((status) => `${status.replace(/_/g, " ")}: ${data.tournaments.filter((item) => item.status === status).length}`)
      .join(" · ");
    return {
      title: "Season summary",
      columns: ["Metric", "Value"],
      rows: [
        ["Tournaments", text(data.tournaments.length)],
        ["Open / active tournament statuses", statusCounts],
        ["Registrations", text(data.registrations.length)],
        ["Pending registrations", text(data.registrations.filter((item) => item.status === "pending").length)],
        ["Teams", text(data.teams.length)],
        ["Unique participants", text(countUniqueParticipants(data))],
        ["Total fixtures", text(data.matches.length)],
        ["Upcoming fixtures", text(data.matches.filter((item) => item.status === "upcoming").length)],
        ["Live fixtures", text(data.matches.filter((item) => item.status === "live").length)],
        ["Completed results", text(data.matches.filter((item) => item.status === "completed").length)],
      ],
    };
  }

  if (report === "tournaments") {
    return {
      title: "Tournaments",
      columns: ["Tournament", "Sport", "Status", "Format", "Start date", "End date", "Registration deadline", "Venue", "Max teams/players", "Players per team", "Registration type", "Registrations", "Teams", "Fixtures", "Organiser"],
      rows: data.tournaments.map((tournament) => [
        tournament.name,
        tournament.sport,
        tournament.status,
        tournament.format,
        tournament.startDate,
        tournament.endDate,
        tournament.registrationDeadline,
        tournament.venue,
        text(tournament.maxTeams),
        text(tournament.playersPerTeam),
        tournament.registrationType,
        text(data.registrations.filter((item) => item.tournamentId === tournament.id).length),
        text(data.teams.filter((item) => item.tournamentId === tournament.id).length),
        text(data.matches.filter((item) => item.tournamentId === tournament.id).length),
        organizerName(tournament),
      ]),
    };
  }

  if (report === "registrations") {
    return {
      title: "Registrations and rosters",
      columns: ["Tournament", "Sport", "Type", "Team / participant", "Captain / registrant", "Roster size", "Player names", "Status", "Submitted"],
      rows: data.registrations.map((registration) => {
        const tournament = data.tournaments.find((item) => item.id === registration.tournamentId);
        const team = data.teams.find((item) => item.id === registration.teamId);
        const registrant = data.users.find((item) => item.id === registration.studentId);
        return [
          tournament?.name ?? "Tournament",
          tournament?.sport ?? "",
          registration.type,
          team?.name ?? registrant?.name ?? "Individual player",
          teamCaptain(data, team),
          text(registration.playerNames.length || team?.playerIds.length || 1),
          rosterNames(data, registration),
          registration.status,
          registration.createdAt,
        ];
      }),
    };
  }

  if (report === "teams") {
    return {
      title: "Teams and standings",
      columns: ["Tournament", "Sport", "Team", "Department", "Captain", "Players", "Played", "Wins", "Losses", "Points"],
      rows: data.teams.map((team) => {
        const tournament = data.tournaments.find((item) => item.id === team.tournamentId);
        return [
          tournament?.name ?? "Tournament",
          tournament?.sport ?? "",
          team.name,
          team.department,
          teamCaptain(data, team),
          team.playerIds.map((id) => data.users.find((user) => user.id === id)?.name ?? id).join("; "),
          text(team.played),
          text(team.wins),
          text(team.losses),
          text(team.points),
        ];
      }),
    };
  }

  if (report === "fixtures") {
    return {
      title: "Fixtures and schedule",
      columns: ["Tournament", "Sport", "Round", "Date", "Time", "Team A", "Team B", "Score A", "Score B", "Winner", "Venue", "Status"],
      rows: [...data.matches]
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .map((match) => fixtureRow(data, match)),
    };
  }

  return {
    title: "Match results",
    columns: ["Tournament", "Sport", "Round", "Date", "Time", "Team A", "Team B", "Score A", "Score B", "Winner", "Venue", "Status"],
    rows: data.matches
      .filter((match) => match.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map((match) => fixtureRow(data, match)),
  };
}

function safeFilePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function csvValue(value: string): string {
  let normalized = value.replace(/\r?\n/g, " ");
  // Prefix formula-like values so opening an export in a spreadsheet cannot execute them.
  if (/^[\t ]*[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return /[",\r\n]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

export function downloadOrganizerCsv(
  data: AppData,
  report: OrganizerReport,
  sport?: string,
): void {
  const table = buildOrganizerReport(data, report);
  const csv = [table.columns, ...table.rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `campusplay-${safeFilePart(report)}-${safeFilePart(sport || "all-sports")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfSafe(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, " | ")
    .replace(/🏆/g, "[Winner]")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

export async function downloadOrganizerPdf(
  data: AppData,
  report: OrganizerReport,
  sport?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const table = buildOrganizerReport(data, report);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 11;
  let y = 44;

  const header = () => {
    pdf.setFillColor(28, 52, 43);
    pdf.rect(0, 0, pageWidth, 78, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(`CampusPlay | ${pdfSafe(table.title)}`, margin, 34);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const scope = sport ? `${sport} organiser report` : "All-sports organiser report";
    pdf.text(`${scope} | Generated ${new Date().toLocaleString()}`, margin, 54);
    pdf.setTextColor(28, 52, 43);
    y = 100;
  };

  header();
  if (!table.rows.length) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("No records are available for this report.", margin, y);
  }

  table.rows.forEach((row, index) => {
    const heading = pdfSafe(row[0] || `Record ${index + 1}`);
    const details = table.columns.slice(1).map((column, columnIndex) => {
      const value = pdfSafe(row[columnIndex + 1] || "—");
      return `${pdfSafe(column)}: ${value}`;
    });
    const detailLines = details.flatMap((line) =>
      pdf.splitTextToSize(line, contentWidth - 12) as string[],
    );
    const requiredHeight = 17 + Math.max(1, detailLines.length) * lineHeight + 10;
    if (y + requiredHeight > pageHeight - 48) {
      pdf.addPage();
      header();
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(28, 52, 43);
    pdf.text(`${index + 1}. ${pdf.splitTextToSize(heading, contentWidth - 10)[0]}`, margin, y);
    y += 15;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(70, 78, 73);
    detailLines.forEach((line) => {
      if (y > pageHeight - 42) {
        pdf.addPage();
        header();
      }
      pdf.text(line, margin + 10, y);
      y += lineHeight;
    });
    y += 8;
    pdf.setDrawColor(225, 230, 226);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 11;
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 128, 122);
    pdf.text(`CampusPlay | Page ${page} of ${pageCount}`, margin, pageHeight - 22);
  }
  pdf.save(`campusplay-${safeFilePart(report)}-${safeFilePart(sport || "all-sports")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
