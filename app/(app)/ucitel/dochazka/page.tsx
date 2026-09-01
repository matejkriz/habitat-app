"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Avatar,
  Badge,
} from "@/components/ui";
import {
  getAllChildren,
  getAttendanceForDate,
  saveAttendance,
  setNoLunchForDate,
} from "@/app/actions/teacher";
import { formatDateWithWeekday } from "@/lib/utils";
import {
  ABSENT_CHILDREN_LABEL,
  ALL_CHILDREN_PRESENT_LABEL,
  getPresenceLabel,
  PRESENT_CHILDREN_LABEL,
} from "@/lib/presence-label";
import type { ChildGender } from "@/lib/types";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  gender: ChildGender | null;
}

interface AttendanceRecord {
  childId: string;
  presence: "PRESENT" | "ABSENT";
}

const nativeSwitchAttribute = { switch: "" } as const;

interface DailyExcuse {
  childId: string;
  state: "ON_TIME" | "LATE" | "LATE_APPROVED";
}

const excuseBadge = {
  ON_TIME: { variant: "excused", label: "Omluveno včas" },
  LATE: { variant: "unexcused", label: "Omluveno pozdě" },
  LATE_APPROVED: { variant: "excused", label: "Pozdě – schváleno" },
} as const;

interface CachedAttendanceDay {
  readonly children: ReadonlyArray<Child>;
  readonly attendance: Readonly<Record<string, boolean>>;
  readonly excuses: Readonly<Record<string, DailyExcuse>>;
  readonly isClosed: boolean;
  readonly noLunch: boolean;
  readonly canManageLunch: boolean;
}

function shiftCalendarDate(date: string, days: number) {
  const shiftedDate = new Date(`${date}T00:00:00Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function AttendanceSkeleton() {
  return (
    <CardContent
      role="status"
      aria-label="Načítání docházky"
      aria-busy="true"
      className="space-y-4"
    >
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-cream p-4">
          <div className="flex gap-4">
            <div className="h-12 w-14 rounded-md bg-cream-dark" />
            <div className="h-12 w-16 rounded-md bg-cream-dark" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-cream-dark" />
        </div>

        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-lg border border-cream-dark p-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-cream-dark" />
                <div className="h-4 w-36 rounded bg-cream-dark" />
              </div>
              <div className="h-6 w-24 rounded-full bg-cream-dark" />
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
}

function triggerSelectionHaptic() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
}

export default function TeacherAttendancePage() {
  const searchParams = useSearchParams();
  const requestedDate = searchParams?.get("date");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : new Date().toISOString().split("T")[0]
  );
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [excuses, setExcuses] = useState<Record<string, DailyExcuse>>({});
  const [isClosed, setIsClosed] = useState(false);
  const [noLunch, setNoLunch] = useState(false);
  const [canManageLunch, setCanManageLunch] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingNoLunch, setIsSavingNoLunch] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dayCache = useRef(new Map<string, CachedAttendanceDay>());
  const selectedDateRef = useRef(selectedDate);

  // Load children and attendance data
  useEffect(() => {
    let isCurrentDate = true;

    async function loadData() {
      setError("");
      try {
        const [childrenData, attendanceData] = (await Promise.all([
          getAllChildren(),
          getAttendanceForDate(selectedDate),
        ])) as [
          ReadonlyArray<Child>,
          {
            readonly isClosed: boolean;
            readonly attendance: ReadonlyArray<AttendanceRecord>;
            readonly excuses: ReadonlyArray<DailyExcuse>;
            readonly noLunch: boolean;
            readonly canManageLunch: boolean;
          },
        ];

        if (!isCurrentDate) return;

        const nextChildren = [...childrenData];
        const nextExcuses = Object.fromEntries(
          attendanceData.excuses.map((excuse) => [excuse.childId, excuse]),
        );

        // Initialize attendance state
        const nextAttendance: Record<string, boolean> = {};
        const excusedChildIds = new Set(
          attendanceData.excuses.map((excuse) => excuse.childId),
        );
        childrenData.forEach((child) => {
          const record = attendanceData.attendance.find(
            (a: AttendanceRecord) => a.childId === child.id
          );
          nextAttendance[child.id] = record
            ? record.presence === "PRESENT"
            : !excusedChildIds.has(child.id);
        });

        dayCache.current.set(selectedDate, {
          children: nextChildren,
          attendance: nextAttendance,
          excuses: nextExcuses,
          isClosed: attendanceData.isClosed,
          noLunch: attendanceData.noLunch,
          canManageLunch: attendanceData.canManageLunch,
        });
        setChildren(nextChildren);
        setIsClosed(attendanceData.isClosed);
        setExcuses(nextExcuses);
        setAttendance(nextAttendance);
        setNoLunch(attendanceData.noLunch);
        setCanManageLunch(attendanceData.canManageLunch);
        setLoadedDate(selectedDate);
      } catch {
        if (!isCurrentDate) return;

        setError("Nepodařilo se načíst data.");
        setLoadedDate(selectedDate);
      }
    }
    loadData();

    return () => {
      isCurrentDate = false;
    };
  }, [selectedDate]);

  const handleToggle = (childId: string) => {
    triggerSelectionHaptic();
    setAttendance((prev) => ({
      ...prev,
      [childId]: !prev[childId],
    }));
    setSuccess("");
  };

  const handleSetAllPresent = () => {
    const newAttendance: Record<string, boolean> = {};
    children.forEach((child) => {
      newAttendance[child.id] = true;
    });
    setAttendance(newAttendance);
    setSuccess("");
  };

  const handleDateChange = (date: string) => {
    selectedDateRef.current = date;
    const cachedDay = dayCache.current.get(date);
    if (cachedDay) {
      setChildren([...cachedDay.children]);
      setAttendance({ ...cachedDay.attendance });
      setExcuses({ ...cachedDay.excuses });
      setIsClosed(cachedDay.isClosed);
      setNoLunch(cachedDay.noLunch);
      setCanManageLunch(cachedDay.canManageLunch);
      setLoadedDate(date);
      setError("");
    }

    setSelectedDate(date);
    setSuccess("");
  };

  const handleDayChange = (days: number) => {
    handleDateChange(shiftCalendarDate(selectedDate, days));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.set("date", selectedDate);

      Object.entries(attendance).forEach(([childId, isPresent]) => {
        formData.set(`child-${childId}`, isPresent ? "present" : "absent");
      });

      const result = await saveAttendance(formData);
      dayCache.current.set(selectedDate, {
        children: [...children],
        attendance: { ...attendance },
        excuses: { ...excuses },
        isClosed,
        noLunch,
        canManageLunch,
      });
      setSuccess(`Docházka uložena (${result.recordCount} záznamů)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit docházku.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoLunchChange = async () => {
    const targetDate = selectedDate;
    const previousNoLunch = noLunch;
    const nextNoLunch = !previousNoLunch;
    setNoLunch(nextNoLunch);
    setIsSavingNoLunch(true);
    setError("");
    setSuccess("");

    try {
      const result = await setNoLunchForDate(targetDate, nextNoLunch);
      const cachedDay = dayCache.current.get(targetDate);
      if (cachedDay) {
        dayCache.current.set(targetDate, { ...cachedDay, noLunch: result.noLunch });
      }
      if (selectedDateRef.current === targetDate) {
        setNoLunch(result.noLunch);
        setSuccess(
          result.noLunch
            ? "Tento den byl označený jako den bez oběda."
            : "Oběd je pro tento den znovu započítaný.",
        );
      }
    } catch (err) {
      if (selectedDateRef.current === targetDate) {
        setNoLunch(previousNoLunch);
        setError(err instanceof Error ? err.message : "Nepodařilo se uložit stav oběda.");
      }
    } finally {
      setIsSavingNoLunch(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = children.length - presentCount;

  const today = new Date().toISOString().split("T")[0];
  const isInFuture = selectedDate > today;
  const isLoading = loadedDate !== selectedDate;

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Docházka
            </CardTitle>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                aria-label="Předchozí den"
                onClick={() => handleDayChange(-1)}
                className="h-11 w-11 shrink-0 p-0 sm:h-12 sm:w-12"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Button>
              <div className="min-w-0 flex-1">
                <Input
                  type="date"
                  aria-label="Datum docházky"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="h-11 min-w-0 w-full px-2 sm:h-12 sm:w-auto sm:px-3"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="Následující den"
                onClick={() => handleDayChange(1)}
                className="h-11 w-11 shrink-0 p-0 sm:h-12 sm:w-12"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          </div>
          <p className="text-charcoal-light">
            {formatDateWithWeekday(new Date(selectedDate))}
          </p>
        </CardHeader>

        {isLoading ? (
          <AttendanceSkeleton />
        ) : isClosed ? (
          <CardContent>
            <div className="flex items-center gap-3 p-6 bg-sage/10 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-charcoal">Habitat má zavřeno</p>
                <p className="text-sm text-charcoal-light">
                  V tento den neprobíhá výuka a nelze zaznamenávat docházku.
                </p>
              </div>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {isInFuture && (
                <div className="flex items-center gap-3 p-6 bg-gold/10 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-charcoal">Budoucí datum</p>
                    <p className="text-sm text-charcoal-light">
                      Docházku lze zaznamenat pouze pro dnešek nebo minulé dny.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-sage/10 border border-sage/20 rounded-lg text-sage-dark text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {success}
                </div>
              )}

              {canManageLunch && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream-dark bg-cream/50 p-4">
                  <input
                    type="checkbox"
                    aria-label="Tento den nebyl oběd"
                    checked={noLunch}
                    disabled={isSavingNoLunch}
                    onChange={handleNoLunchChange}
                    className="mt-0.5 size-5 shrink-0 accent-charcoal disabled:cursor-wait"
                  />
                  <span>
                    <span className="block font-semibold text-charcoal">
                      Tento den nebyl oběd
                    </span>
                    <span className="mt-0.5 block text-sm text-charcoal-light">
                      Den se v přehledu obědů označí šedě a žádnému dítěti se nezapočítá.
                    </span>
                  </span>
                </label>
              )}

              {/* Summary */}
              <div className="flex flex-col items-stretch gap-4 rounded-lg bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-sage">{presentCount}</p>
                    <p className="text-xs text-charcoal-light">
                      {PRESENT_CHILDREN_LABEL}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-coral">{absentCount}</p>
                    <p className="text-xs text-charcoal-light">
                      {ABSENT_CHILDREN_LABEL}
                    </p>
                  </div>
                </div>
                {!isInFuture && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllPresent}
                    className="w-full sm:w-auto"
                  >
                    {ALL_CHILDREN_PRESENT_LABEL}
                  </Button>
                )}
              </div>

              {/* Children list */}
              <div className="space-y-2">
                {children.map((child) => (
                  <label
                    key={child.id}
                    className={`flex min-h-12 select-none items-center justify-between rounded-lg border p-3 transition-[background-color,border-color,transform] ${
                      isInFuture
                        ? "cursor-default"
                        : "cursor-pointer active:scale-[0.99]"
                    } ${
                      attendance[child.id]
                        ? "border-sage/20 bg-sage/5"
                        : "border-coral/20 bg-coral/5"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={`${child.firstName} ${child.lastName}`}
                        size="sm"
                      />
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <span className="font-medium text-charcoal">
                          {child.firstName} {child.lastName}
                        </span>
                        {excuses[child.id] && (
                          <Badge
                            variant={excuseBadge[excuses[child.id].state].variant}
                          >
                            {excuseBadge[excuses[child.id].state].label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${
                        attendance[child.id] ? "text-sage" : "text-coral"
                      }`}>
                        {getPresenceLabel(attendance[child.id], child.gender)}
                      </span>
                      {!isInFuture && (
                        <span className="relative shrink-0">
                          <input
                            {...nativeSwitchAttribute}
                            type="checkbox"
                            className="peer sr-only"
                            aria-label={`Docházka: ${child.firstName} ${child.lastName}`}
                            checked={attendance[child.id] || false}
                            onChange={() => handleToggle(child.id)}
                          />
                          <span
                            aria-hidden="true"
                            className="block h-6 w-11 rounded-full bg-cream-dark transition-colors duration-200 peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5"
                          />
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>

            {!isInFuture && (
              <CardFooter>
                <Button
                  type="submit"
                  isLoading={isSaving}
                  className="w-full"
                >
                  Uložit docházku
                </Button>
              </CardFooter>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
