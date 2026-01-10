import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  getParentChildren,
  getChildTodayStatus,
  getChildAttendanceHistory,
  getChildStats,
} from "@/app/actions/parent";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  PresenceBadge,
  ExcuseStatusBadge,
} from "@/components/ui";
import { formatDateWithWeekday } from "@/lib/utils";
import { ChildSelector } from "./child-selector";

export const metadata = {
  title: "Přehled dítěte",
};

async function TodayCard({ childId }: { childId: string }) {
  const status = await getChildTodayStatus(childId);

  return (
    <Card className="bg-gradient-to-br from-gold/5 to-sage/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Dnes
        </CardTitle>
        <p className="text-charcoal-light text-sm">
          {formatDateWithWeekday(status.date)}
        </p>
      </CardHeader>
      <CardContent>
        {status.isClosed ? (
          <div className="flex items-center gap-3 p-4 bg-sage/10 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-charcoal">Habitat má zavřeno</p>
              <p className="text-sm text-charcoal-light">Dnes neprobíhá výuka</p>
            </div>
          </div>
        ) : status.attendance ? (
          <div className="flex items-center justify-between p-4 bg-white rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                status.attendance.presence === "PRESENT"
                  ? "bg-sage/20"
                  : "bg-coral/20"
              }`}>
                {status.attendance.presence === "PRESENT" ? (
                  <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-semibold text-charcoal">
                  {status.attendance.presence === "PRESENT"
                    ? "Přítomen/a"
                    : "Nepřítomen/a"}
                </p>
                {status.attendance.excuseStatus !== "NONE" && (
                  <ExcuseStatusBadge status={status.attendance.excuseStatus} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-cream-dark/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-charcoal/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-charcoal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-charcoal">Docházka nezaznamenána</p>
              <p className="text-sm text-charcoal-light">Čeká se na zápis učitele</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function StatsCard({ childId }: { childId: string }) {
  const stats = await getChildStats(childId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Tento měsíc
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-sage/10 rounded-lg">
            <p className="text-2xl font-bold text-sage">{stats.present}</p>
            <p className="text-xs text-charcoal-light">Přítomnost</p>
          </div>
          <div className="text-center p-3 bg-coral/10 rounded-lg">
            <p className="text-2xl font-bold text-coral">{stats.absent}</p>
            <p className="text-xs text-charcoal-light">Absence</p>
          </div>
          <div className="text-center p-3 bg-gold/10 rounded-lg">
            <p className="text-2xl font-bold text-gold">{stats.excused}</p>
            <p className="text-xs text-charcoal-light">Omluveno</p>
          </div>
          <div className="text-center p-3 bg-coral/20 rounded-lg">
            <p className="text-2xl font-bold text-coral-dark">{stats.unexcused}</p>
            <p className="text-xs text-charcoal-light">Neomluveno</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function AttendanceHistory({ childId }: { childId: string }) {
  const history = await getChildAttendanceHistory(childId);

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historie docházky</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-charcoal-light text-center py-8">
            Zatím nemáme žádné záznamy docházky.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Poslední dny
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 bg-cream rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  record.presence === "PRESENT"
                    ? "bg-sage/20"
                    : "bg-coral/20"
                }`}>
                  {record.presence === "PRESENT" ? (
                    <svg className="w-4 h-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {formatDateWithWeekday(record.date)}
                  </p>
                  {record.excuse?.reason && (
                    <p className="text-xs text-charcoal-light">
                      {record.excuse.reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PresenceBadge present={record.presence === "PRESENT"} />
                {record.excuseStatus !== "NONE" && (
                  <ExcuseStatusBadge status={record.excuseStatus} />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.PARENT) {
    redirect("/login");
  }

  const params = await searchParams;
  const children = await getParentChildren();

  if (children.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="w-16 h-16 text-charcoal-light mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-charcoal mb-2">
              Žádné přiřazené děti
            </h2>
            <p className="text-charcoal-light">
              Kontaktujte prosím Bětku pro přiřazení dětí k vašemu účtu.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedChildId = params.child || children[0].id;
  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            {selectedChild.firstName} {selectedChild.lastName}
          </h1>
          <p className="text-charcoal-light">Přehled docházky</p>
        </div>

        <div className="flex items-center gap-3">
          {children.length > 1 && (
            <ChildSelector
              items={children.map((c) => ({
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
              }))}
              selectedId={selectedChildId}
            />
          )}
          <Link href={`/rodic/omluvenka?child=${selectedChildId}`}>
            <Button>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nová omluvenka
            </Button>
          </Link>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<LoadingCard />}>
          <TodayCard childId={selectedChildId} />
        </Suspense>

        <Suspense fallback={<LoadingCard />}>
          <StatsCard childId={selectedChildId} />
        </Suspense>
      </div>

      <Suspense fallback={<LoadingCard />}>
        <AttendanceHistory childId={selectedChildId} />
      </Suspense>
    </div>
  );
}
