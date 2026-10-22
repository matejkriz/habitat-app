import type { ToastMessage } from "@/components/ui/toast-provider";
import type { ExcuseKind } from "@/lib/types";

type SubmissionSummary = {
  readonly count: number;
  readonly cancelLunch: boolean;
  readonly schoolDayCount: number;
  readonly lateDayCount: number;
  readonly onTimeDayCount: number;
  readonly automaticallyApprovedDayCount: number;
};

function canceledLunchMessage(count: number): string {
  if (count === 1) return "1 oběd bude odhlášen";
  return count < 5 ? `${count} obědy budou odhlášeny` : `${count} obědů bude odhlášeno`;
}

function excuseDescription(summary: SubmissionSummary): string {
  if (summary.schoolDayCount === 0) return "V zadaném období nejsou žádné školní dny.";
  if (!summary.cancelLunch) return summary.count > 1 ? "Obědy nebudou odhlášeny." : "Oběd nebude odhlášen.";
  if (summary.automaticallyApprovedDayCount === summary.schoolDayCount) {
    return summary.count > 1 ? "Vybrané děti neodebírají obědy." : "Dítě neodebírá obědy.";
  }
  if (summary.lateDayCount === 0) {
    return summary.onTimeDayCount === 1 ? "Oběd bude odhlášen." : `${canceledLunchMessage(summary.onTimeDayCount)}.`;
  }
  if (summary.onTimeDayCount === 0) {
    if (summary.lateDayCount === 1) return "Oběd zůstane započítaný.";
    return summary.lateDayCount < 5
      ? `${summary.lateDayCount} obědy zůstanou započítané.`
      : `${summary.lateDayCount} obědů zůstane započítaných.`;
  }
  const lateDays = summary.lateDayCount === 1 ? "1 pozdně omluvený den"
    : summary.lateDayCount < 5 ? `${summary.lateDayCount} pozdně omluvené dny` : `${summary.lateDayCount} pozdně omluvených dnů`;
  const charged = summary.lateDayCount === 1 ? "zůstane oběd započítaný" : "zůstanou obědy započítané";
  return `${canceledLunchMessage(summary.onTimeDayCount)}; za ${lateDays} ${charged}.`;
}

function makeupDescription(summary: SubmissionSummary): string {
  const messages = ["O mimořádném příchodu se dozví ředitelka a učitelé."];
  if (summary.schoolDayCount === 0) messages.push("V zadaném období nejsou žádné dny pro náhradu.");
  else if (summary.cancelLunch) messages.push("Oběd nebude přihlášen.");
  else {
    if (summary.onTimeDayCount > 0) {
      messages.push(summary.onTimeDayCount === 1 ? "Oběd bude přihlášen." : `${summary.onTimeDayCount} obědy budou přihlášeny.`);
    }
    if (summary.lateDayCount > 0) messages.push("Oběd není zajištěný pro dny zadané po termínu. Dítě může dorazit i bez zajištěného oběda.");
  }
  return messages.join(" ");
}

export function getSubmissionToast(kind: ExcuseKind, summary: SubmissionSummary): ToastMessage {
  const title = kind === "MAKEUP"
    ? summary.count > 1 ? "Náhrady odeslány" : "Náhrada odeslána"
    : summary.count > 1 ? "Omluvenky odeslány" : "Omluvenka odeslána";
  return {
    title,
    description: kind === "MAKEUP" ? makeupDescription(summary) : excuseDescription(summary),
    tone: summary.lateDayCount === 0 ? "success" : "warning",
  };
}
