import Link from "next/link";
import { Button } from "@/components/ui";

export function NewExcuseLink({ childId }: { childId: string }) {
  return (
    <Link
      href={`/rodic/omluvenka?child=${childId}`}
      className="hidden shrink-0 sm:inline-flex"
    >
      <Button className="w-full">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nová omluvenka
      </Button>
    </Link>
  );
}
