import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonScreen label="Loading dashboard">
      <SkeletonPageHeader />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>
      <div className="space-y-5">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </SkeletonScreen>
  );
}
