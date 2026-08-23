import { ExcuseStatusBadge, PresenceBadge } from "@/components/ui";
import { formatDateWithWeekday } from "@/lib/utils";
import type { ChildGender } from "@/lib/types";

export type AttendanceHistoryItem = {
  readonly id: string;
  readonly date: Date;
  readonly presence: "PRESENT" | "ABSENT";
  readonly excuseStatus: "NONE" | "EXCUSED" | "UNEXCUSED";
  readonly excuse?: {
    readonly reason?: string | null;
  } | null;
};

export function AttendanceHistoryRow({
  record,
  childGender,
}: {
  record: AttendanceHistoryItem;
  childGender: ChildGender | null;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg bg-cream p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          record.presence === "PRESENT" ? "bg-sage/20" : "bg-coral/20"
        }`}
      >
        {record.presence === "PRESENT" ? (
          <svg className="h-4 w-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">
          {formatDateWithWeekday(record.date)}
        </p>
        {record.excuse?.reason && (
          <p className="break-words text-xs text-charcoal-light">
            {record.excuse.reason}
          </p>
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-2 pl-11 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end sm:pl-0">
        <PresenceBadge
          present={record.presence === "PRESENT"}
          gender={childGender}
        />
        {record.excuseStatus !== "NONE" && (
          <ExcuseStatusBadge status={record.excuseStatus} />
        )}
      </div>
    </div>
  );
}
