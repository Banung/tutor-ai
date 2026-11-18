import { Badge } from "@/components/ui/badge";
import { reviewStatusLabels, type ReviewStatus } from "@/lib/tutor-ai/feedback-review-schema";

export function reviewStatusLabel(status: string) {
  return reviewStatusLabels[status as ReviewStatus] ?? status;
}
export function ReviewStatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "completed" ? "secondary" : "outline"}>{reviewStatusLabel(status)}</Badge>;
}
export function reviewDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export async function reviewResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "Feedback belum dapat dimuat.");
    throw Object.assign(error, { status: response.status });
  }
  return data;
}
