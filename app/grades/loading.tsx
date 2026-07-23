import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function GradesLoading() {
  return (
    <SkeletonScreen label="Loading grades">
      <SkeletonPageHeader />
      <div className="mb-6 flex flex-wrap gap-2">
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-10 w-40" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
