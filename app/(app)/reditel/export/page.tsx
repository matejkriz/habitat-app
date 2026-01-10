"use client";

import { useState, useEffect } from "react";
import { exportAttendanceCSV } from "@/app/actions/director";
import { getAllChildren } from "@/app/actions/teacher";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
} from "@/components/ui";

export default function ExportPage() {
  const [children, setChildren] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [childId, setChildId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadChildren() {
      try {
        const data = await getAllChildren();
        setChildren(data);
      } catch (error) {
        console.error("Failed to load children:", error);
      }
    }
    loadChildren();

    // Set default date range (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(startOfMonth.toISOString().split("T")[0]);
    setEndDate(endOfMonth.toISOString().split("T")[0]);
  }, []);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError("Vyberte prosím období pro export.");
      return;
    }

    setError("");
    setIsExporting(true);

    try {
      const csvContent = await exportAttendanceCSV(
        startDate,
        endDate,
        childId || undefined
      );

      // Create and download file
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const filename = childId
        ? `dochazka_${children.find((c) => c.id === childId)?.lastName || "dite"}_${startDate}_${endDate}.csv`
        : `dochazka_${startDate}_${endDate}.csv`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodařilo se exportovat data."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const setDateRange = (range: "month" | "quarter" | "year") => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1);
        end = new Date(now.getFullYear(), quarterStart + 3, 0);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Export dat</h1>
        <p className="text-charcoal-light">
          Stáhněte data docházky ve formátu CSV
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export docházky
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
              {error}
            </div>
          )}

          {/* Quick date ranges */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Rychlý výběr období
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDateRange("month")}
              >
                Tento měsíc
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDateRange("quarter")}
              >
                Tento kvartál
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDateRange("year")}
              >
                Tento rok
              </Button>
            </div>
          </div>

          {/* Custom date range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Od"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Do"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              required
            />
          </div>

          {/* Child filter */}
          <Select
            label="Filtr podle dítěte (volitelné)"
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            options={[
              { value: "", label: "Všechny děti" },
              ...children.map((child) => ({
                value: child.id,
                label: `${child.firstName} ${child.lastName}`,
              })),
            ]}
          />

          {/* Info */}
          <div className="p-4 bg-cream rounded-lg">
            <h4 className="font-semibold text-charcoal text-sm mb-2">
              Informace o exportu
            </h4>
            <ul className="text-sm text-charcoal-light space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-gold">•</span>
                Soubor bude ve formátu CSV s kódováním UTF-8
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">•</span>
                Sloupce: Datum, Jméno, Příjmení, Přítomnost, Stav omluvy, Důvod
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">•</span>
                Zavřené dny (pátky, víkendy, svátky) nejsou v exportu zahrnuty
              </li>
            </ul>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            onClick={handleExport}
            isLoading={isExporting}
            disabled={!startDate || !endDate}
            className="w-full"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Stáhnout CSV
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
