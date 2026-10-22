import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main>
      <div className="navy-gradient h-44 sm:h-52" />
      <div className="mx-auto -mt-24 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="surface space-y-4 p-6">
            <div className="flex gap-4">
              <Skeleton className="-mt-14 size-24 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
