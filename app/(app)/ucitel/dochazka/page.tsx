"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Toggle,
  Avatar,
} from "@/components/ui";
import {
  getAllChildren,
  getAttendanceForDate,
  saveAttendance,
} from "@/app/actions/teacher";
import { formatDateWithWeekday } from "@/lib/utils";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  childId: string;
  presence: "PRESENT" | "ABSENT";
}

export default function TeacherAttendancePage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isClosed, setIsClosed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load children and attendance data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const [childrenData, attendanceData] = await Promise.all([
          getAllChildren(),
          getAttendanceForDate(selectedDate),
        ]);

        setChildren(childrenData);
        setIsClosed(attendanceData.isClosed);

        // Initialize attendance state
        const initialAttendance: Record<string, boolean> = {};
        childrenData.forEach((child) => {
          const record = attendanceData.attendance.find(
            (a: AttendanceRecord) => a.childId === child.id
          );
          // Default to present if no record exists
          initialAttendance[child.id] = record ? record.presence === "PRESENT" : true;
        });
        setAttendance(initialAttendance);
      } catch {
        setError("Nepodařilo se načíst data.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedDate]);

  const handleToggle = (childId: string) => {
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
      setSuccess(`Docházka uložena (${result.recordCount} záznamů)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se uložit docházku.");
    } finally {
      setIsSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = children.length - presentCount;

  const today = new Date().toISOString().split("T")[0];
  const isInFuture = selectedDate > today;

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
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSuccess("");
              }}
              max={today}
              className="w-auto"
            />
          </div>
          <p className="text-charcoal-light">
            {formatDateWithWeekday(new Date(selectedDate))}
          </p>
        </CardHeader>

        {isLoading ? (
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
          </CardContent>
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
        ) : isInFuture ? (
          <CardContent>
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
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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

              {/* Summary */}
              <div className="flex items-center justify-between p-4 bg-cream rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-sage">{presentCount}</p>
                    <p className="text-xs text-charcoal-light">Přítomno</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-coral">{absentCount}</p>
                    <p className="text-xs text-charcoal-light">Nepřítomno</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetAllPresent}
                >
                  Všichni přítomni
                </Button>
              </div>

              {/* Children list */}
              <div className="space-y-2">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      attendance[child.id]
                        ? "bg-sage/5 border border-sage/20"
                        : "bg-coral/5 border border-coral/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${child.firstName} ${child.lastName}`}
                        size="sm"
                      />
                      <span className="font-medium text-charcoal">
                        {child.firstName} {child.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${
                        attendance[child.id] ? "text-sage" : "text-coral"
                      }`}>
                        {attendance[child.id] ? "Přítomen/a" : "Nepřítomen/a"}
                      </span>
                      <Toggle
                        checked={attendance[child.id] || false}
                        onChange={() => handleToggle(child.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                isLoading={isSaving}
                className="w-full"
              >
                Uložit docházku
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
