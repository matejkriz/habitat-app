import { Suspense } from "react";
import { getAuditLogs } from "@/app/actions/director";
import {
  Card,
  CardContent,
  Badge,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Audit log",
};

const actionLabels: Record<string, string> = {
  CREATE: "Vytvořeno",
  UPDATE: "Upraveno",
  DELETE: "Smazáno",
};

const actionVariants: Record<string, "default" | "excused" | "unexcused"> = {
  CREATE: "excused",
  UPDATE: "default",
  DELETE: "unexcused",
};

const entityLabels: Record<string, string> = {
  Attendance: "Docházka",
  Excuse: "Omluvenka",
  ClosedDay: "Volný den",
  User: "Uživatel",
  Child: "Dítě",
};

async function AuditLogContent() {
  const logs = await getAuditLogs(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Audit log</h1>
        <p className="text-charcoal-light">
          Historie změn v systému
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {logs.length === 0 ? (
            <p className="text-charcoal-light text-center py-12">
              Zatím žádné záznamy
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-cream rounded-lg border border-cream-dark"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={actionVariants[log.action] || "default"}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        <span className="font-medium text-charcoal">
                          {entityLabels[log.entityType] || log.entityType}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal-light">
                        {log.user?.name || log.user?.email || "Systém"} •{" "}
                        {formatDate(log.createdAt, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Show changes */}
                  {(log.previousValue || log.newValue) && (
                    <div className="mt-3 pt-3 border-t border-cream-dark">
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        {log.previousValue && (
                          <div className="p-2 bg-coral/5 rounded">
                            <p className="text-xs font-medium text-coral mb-1">
                              Původní hodnota
                            </p>
                            <pre className="text-xs text-charcoal-light overflow-auto">
                              {JSON.stringify(log.previousValue, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div className="p-2 bg-sage/5 rounded">
                            <p className="text-xs font-medium text-sage mb-1">
                              Nová hodnota
                            </p>
                            <pre className="text-xs text-charcoal-light overflow-auto">
                              {JSON.stringify(log.newValue, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingAuditLog() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<LoadingAuditLog />}>
      <AuditLogContent />
    </Suspense>
  );
}
