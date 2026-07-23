import {
  SkeletonBlock,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function LessonsTableLoading() {
  return (
    <SkeletonScreen label="Loading lessons">
      <SkeletonPageHeader />
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBlock key={i} className="h-10 w-36" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-light">
        <SkeletonBlock className="h-10 rounded-none" />
        <div className="divide-y divide-[color:var(--border-light)]">
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonBlock key={i} className="h-12 rounded-none" />
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
