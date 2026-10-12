import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("sf-skeleton", className)}
      {...props} />)
  );
}

export { Skeleton }
