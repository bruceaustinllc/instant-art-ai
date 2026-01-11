import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { borderTemplates, type BorderTemplateId } from '@/lib/pageBorders';

interface BorderSelectProps {
  value: BorderTemplateId;
  onChange: (value: BorderTemplateId) => void;
  disabled?: boolean;
}

export default function BorderSelect({ value, onChange, disabled }: BorderSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Border</Label>
      <Select value={value} onValueChange={(v) => onChange(v as BorderTemplateId)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select a border" />
        </SelectTrigger>
        <SelectContent>
          {borderTemplates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex flex-col">
                <span className="text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
