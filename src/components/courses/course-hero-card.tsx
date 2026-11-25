import type { ReactNode } from "react";

interface CourseHeroCardProps {
  title: string;
  description?: string | null;
  coverImage?: string | null;
  actions?: ReactNode;
}

/**
 * Responsive split-card hero for course detail pages: stacks cover above text
 * on small screens and places text beside a faded cover panel on large screens.
 */
export function CourseHeroCard({
  title,
  description,
  coverImage,
  actions,
}: CourseHeroCardProps) {
  return (
    <div className="grid overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.95fr)]">
      <div className="flex min-w-0 flex-col justify-center gap-3 p-6 pt-3 lg:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>
        )}
      </div>

      <div className="relative order-first h-44 bg-muted sm:h-52 lg:order-last lg:h-auto lg:min-h-[260px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={
            coverImage
              ? { backgroundImage: `url("${coverImage}")` }
              : undefined
          }
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent lg:hidden" />
        <div className="hidden lg:block lg:absolute lg:inset-y-0 lg:left-0 lg:w-28 lg:bg-gradient-to-r lg:from-card lg:via-card/45 lg:to-transparent" />
      </div>
    </div>
  );
}
