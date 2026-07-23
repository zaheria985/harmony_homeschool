import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

export default function WeekLoading() {
  return (
    <SkeletonScreen label="Loading week planner">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-10 w-40" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 2 }, (_, week) => (
          <div key={week}>
            <SkeletonBlock className="mb-2 h-5 w-32" />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              {Array.from({ length: 7 }, (_, day) => (
                <SkeletonBlock key={day} className="h-[150px] md:h-[140px]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
