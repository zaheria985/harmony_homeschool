import {
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function CurriculaLoading() {
  return (
    <SkeletonScreen label="Loading curricula">
      <SkeletonPageHeader />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
