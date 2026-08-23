import Link from "next/link";
import { Card, CardContent } from "@/components/ui";

export function AuditQuickAction() {
  return (
    <Link href="/reditel/audit">
      <Card hover className="h-full">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-charcoal">Audit log</h3>
          <p className="text-sm text-charcoal-light mt-1">Historie změn v systému</p>
        </CardContent>
      </Card>
    </Link>
  );
}
