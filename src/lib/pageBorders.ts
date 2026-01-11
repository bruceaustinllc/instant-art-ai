export type BorderTemplateId = 'none' | 'classic' | 'double' | 'dotted' | 'floral_corners';

export type BorderTemplate = {
  id: BorderTemplateId;
  name: string;
  description: string;
};

export const borderTemplates: BorderTemplate[] = [
  { id: 'none', name: 'None', description: 'No border' },
  { id: 'classic', name: 'Classic Frame', description: 'Single clean frame' },
  { id: 'double', name: 'Double Frame', description: 'Two frames for a premium look' },
  { id: 'dotted', name: 'Dotted', description: 'Playful dotted outline' },
  { id: 'floral_corners', name: 'Floral Corners', description: 'Light decorative corner flourishes' },
];
