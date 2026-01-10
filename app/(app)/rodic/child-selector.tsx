"use client";

import { useRouter, usePathname } from "next/navigation";
import { Select } from "@/components/ui";

interface ChildSelectorProps {
  items: Array<{ id: string; name: string }>;
  selectedId: string;
}

export function ChildSelector({ items, selectedId }: ChildSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChildId = e.target.value;
    router.push(`${pathname}?child=${newChildId}`);
  };

  return (
    <Select
      value={selectedId}
      onChange={handleChange}
      options={items.map((item) => ({
        value: item.id,
        label: item.name,
      }))}
      className="w-[200px]"
    />
  );
}
