import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../app/AppContext";
import type { Match } from "../types";
import { EmptyState, StatusPill } from "./UI";

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeInMinutes(value: string): number {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

function todayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TodayFixturesCard({
  matches,
  audience,
}: {
  matches: Match[];
  audience: "student" | "organizer";
}) {
  const { data } = useApp();
  const today = getLocalDateKey();
  const todayMatches = matches
    .filter((match) => match.date === today)
    .sort((a, b) => timeInMinutes(a.time) - timeInMinutes(b.time));

  return (
    <section className="surface rounded-[22px] p-4 sm:p-5" aria-label="Today's fixtures">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{todayLabel(today)}</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">Today’s fixtures</h2>
        </div>
        <span className="rounded-full bg-lime px-3 py-1.5 text-[10px] font-extrabold">
          {todayMatches.length} {todayMatches.length === 1 ? "fixture" : "fixtures"}
        </span>
      </div>

      {todayMatches.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {todayMatches.map((match) => {
            const teamA = data.teams.find((team) => team.id === match.teamAId);
            const teamB = data.teams.find((team) => team.id === match.teamBId);
            const tournament = data.tournaments.find(
              (item) => item.id === match.tournamentId,
            );
            const destination = audience === "student"
              ? `/app/matches/${match.id}`
              : `/organizer/manage/${match.tournamentId}`;

            return (
              <Link
                key={match.id}
                to={destination}
                className="surface-flat rounded-2xl p-3 transition hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="eyebrow truncate">
                      {tournament?.sport ?? "Campus sport"} · {match.round}
                    </p>
                    <p className="mt-1 truncate text-xs font-extrabold">
                      {teamA?.name ?? "Team A"} <span className="muted px-1">vs</span>{" "}
                      {teamB?.name ?? "Team B"}
                    </p>
                  </div>
                  <StatusPill status={match.status} dot={match.status === "live"} />
                </div>
                <p className="muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} /> {match.time}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {match.venue}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No fixtures scheduled today"
          body={audience === "student"
            ? "Check your matches calendar for the next campus fixture."
            : "Fixtures for your sport will appear here when scheduled."}
        />
      )}
      {audience === "student" && (
        <Link to="/app/matches" className="muted mt-3 inline-flex items-center gap-1 text-[10px] font-bold hover:text-ink">
          Open match calendar <CalendarDays size={12} />
        </Link>
      )}
    </section>
  );
}
