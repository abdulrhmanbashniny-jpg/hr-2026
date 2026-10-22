import { Skeleton } from '@/components/ui/skeleton';

/** Shapes that match the real screens, so content lands where the eye already is. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="aspect-[1.586] w-full max-w-[420px] justify-self-center rounded-[22px]" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
