import { BookOpen, Building2 } from "lucide-react";

export type CourseStudyProgram = {
  name: string;
  faculty: { name: string };
};

export function formatAcademicUnitName(name: string) {
  const trimmedName = name.trim();
  if (/^(fakultas|sekolah)\b/i.test(trimmedName)) return trimmedName;
  return `Fakultas ${trimmedName}`;
}

export function CourseAcademicLabels({
  studyProgram,
}: {
  studyProgram: CourseStudyProgram | null;
}) {
  if (!studyProgram) return null;

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-start gap-1">
        <Building2 className="size-3.5 shrink-0" />
        <span className="whitespace-normal break-words leading-snug">
          {formatAcademicUnitName(studyProgram.faculty.name)}
        </span>
      </span>
      <span className="flex min-w-0 items-start gap-1">
        <BookOpen className="size-3.5 shrink-0" />
        <span className="whitespace-normal break-words leading-snug">
          {studyProgram.name}
        </span>
      </span>
    </div>
  );
}
