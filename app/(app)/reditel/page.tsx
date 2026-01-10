import { Suspense } from "react";
import Link from "next/link";
import { getDashboardStats } from "@/app/actions/director";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { formatShortDate } from "@/lib/utils";

export const metadata = {
  title: "Administrace",
};

async function DashboardContent() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Administrace</h1>
          <p className="text-charcoal-light">Přehled a správa systému</p>
        </div>
      </div>

      {/* Today's Summary */}
      <Card className="bg-gradient-to-br from-gold/5 to-sage/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Dnes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.today.recorded ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-sage/10 rounded-lg">
                <p className="text-3xl font-bold text-sage">{stats.today.present}</p>
                <p className="text-sm text-charcoal-light">Přítomno</p>
              </div>
              <div className="text-center p-4 bg-coral/10 rounded-lg">
                <p className="text-3xl font-bold text-coral">{stats.today.absent}</p>
                <p className="text-sm text-charcoal-light">Nepřítomno</p>
              </div>
              <div className="text-center p-4 bg-cream-dark rounded-lg">
                <p className="text-3xl font-bold text-charcoal">{stats.today.total}</p>
                <p className="text-sm text-charcoal-light">Celkem dětí</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-gold/10 rounded-lg">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-charcoal">Docházka ještě nebyla zaznamenána</p>
                <p className="text-sm text-charcoal-light">
                  Čeká se na zápis od učitele
                </p>
              </div>
              <Link href="/ucitel/dochazka" className="ml-auto">
                <Button size="sm">Zapsat docházku</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-sage/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-charcoal">{stats.month.presentCount}</p>
                <p className="text-sm text-charcoal-light">Přítomností tento měsíc</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-coral/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-charcoal">{stats.month.absentCount}</p>
                <p className="text-sm text-charcoal-light">Absencí tento měsíc</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-charcoal">{stats.month.excusedCount}</p>
                <p className="text-sm text-charcoal-light">Omluvených absencí</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-coral/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-coral-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-charcoal">{stats.month.unexcusedCount}</p>
                <p className="text-sm text-charcoal-light">Neomluvených absencí</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Excuses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Nedávné neomluvené omluvenky
          </CardTitle>
          <Link href="/reditel/omluvenky">
            <Button variant="outline" size="sm">Zobrazit vše</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentExcuses.length === 0 ? (
            <p className="text-charcoal-light text-center py-8">
              Žádné neomluvené omluvenky k vyřízení
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentExcuses.map((excuse) => (
                <Link
                  key={excuse.id}
                  href={`/reditel/omluvenky?id=${excuse.id}`}
                  className="flex items-center justify-between p-3 bg-cream rounded-lg hover:bg-cream-dark transition-colors"
                >
                  <div>
                    <p className="font-medium text-charcoal">{excuse.childName}</p>
                    <p className="text-sm text-charcoal-light">
                      {formatShortDate(excuse.fromDate)} - {formatShortDate(excuse.toDate)}
                      {excuse.reason && ` • ${excuse.reason}`}
                    </p>
                  </div>
                  <Badge variant="unexcused">Ke schválení</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/ucitel/dochazka">
          <Card hover className="h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal">Zapsat docházku</h3>
              <p className="text-sm text-charcoal-light mt-1">Denní zápis přítomnosti</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reditel/omluvenky">
          <Card hover className="h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal">Omluvenky</h3>
              <p className="text-sm text-charcoal-light mt-1">Správa omluvenek</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reditel/volne-dny">
          <Card hover className="h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal">Volné dny</h3>
              <p className="text-sm text-charcoal-light mt-1">Prázdniny a svátky</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reditel/export">
          <Card hover className="h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-info/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal">Export dat</h3>
              <p className="text-sm text-charcoal-light mt-1">Stažení CSV souborů</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
    </div>
  );
}

export default function DirectorDashboard() {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <DashboardContent />
    </Suspense>
  );
}
