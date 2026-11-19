// Арт из src/assets/art: Vite сам находит все картинки при сборке.
// Если файла нет — art() вернёт undefined, и интерфейс покажет заглушку (значок).
// Имена файлов — в ART_PROMPTS.md. Если есть и .png, и .webp с одним именем — берётся .png.

import type { DevCardType, Resource } from '../engine';

const files = import.meta.glob('../assets/art/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const name = path
    .split('/')
    .pop()!
    .replace(/\.(png|webp|jpe?g)$/i, '');
  if (!byName.has(name) || /\.png$/i.test(path)) byName.set(name, url);
}

export function art(name: string): string | undefined {
  return byName.get(name);
}

export const resourceArt = (r: Resource) => art(`res-${r}`);

export const DEV_CARD_ART: Record<DevCardType, string> = {
  knight: 'dev-knight',
  victoryPoint: 'dev-victory',
  roadBuilding: 'dev-roads',
  yearOfPlenty: 'dev-plenty',
  monopoly: 'dev-monopoly',
};
