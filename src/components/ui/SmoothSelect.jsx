import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SmoothSelect({ value, onChange, options, ariaLabel, className = '' }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className={`min-h-11 rounded-xl border-emerald-500/20 bg-white/70 font-semibold shadow-sm backdrop-blur-xl focus:ring-emerald-500 dark:bg-white/[0.05] ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="sf-menu-motion rounded-2xl border-white/50 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
        {options.map(option => (
          <SelectItem key={option.value} value={option.value} className="min-h-11 rounded-xl px-3 pr-9 font-medium focus:bg-emerald-500/10 focus:text-emerald-700 dark:focus:text-emerald-300">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
