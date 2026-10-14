import { useTheme } from "@/lib/ThemeContext"
import { Toaster as Sonner } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { isDark } = useTheme()

  return (
    (<Sonner
      theme={isDark ? "dark" : "light"}
      position="top-center"
      duration={3500}
      closeButton
      offset="max(16px, env(safe-area-inset-top))"
      className="toaster group !z-[2147483647]"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-xl motion-reduce:!transition-none motion-reduce:!animate-none",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />)
  );
}

export { Toaster }
