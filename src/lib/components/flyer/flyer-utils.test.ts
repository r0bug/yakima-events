import { describe, it, expect } from 'vitest';
import { groupShopsByRegion } from './flyer-utils';
import type { FlyerShop } from '../../types/junk-run';

const mk = (id: number, name: string, region: string): FlyerShop => ({
  id, name, address: null, phone: null, latitude: 46.6, longitude: -120.5,
  operatingHours: null, description: null, region,
});

describe('groupShopsByRegion', () => {
  it('groups by region and orders Yakima before Union Gap', () => {
    const groups = groupShopsByRegion([mk(1, 'A', 'uniongap'), mk(2, 'B', 'yakima'), mk(3, 'C', 'yakima')]);
    expect(groups.map(g => g.region)).toEqual(['yakima', 'uniongap']);
    expect(groups[0].shops.map(s => s.id)).toEqual([2, 3]);
    expect(groups[0].label).toBe('Yakima');
    expect(groups[1].label).toBe('Union Gap');
  });

  it('treats empty region as yakima', () => {
    const groups = groupShopsByRegion([mk(1, 'A', '')]);
    expect(groups[0].region).toBe('yakima');
  });

  it('appends unknown regions alphabetically after known ones', () => {
    const groups = groupShopsByRegion([mk(1, 'A', 'zzz'), mk(2, 'B', 'aaa'), mk(3, 'C', 'yakima')]);
    expect(groups.map(g => g.region)).toEqual(['yakima', 'aaa', 'zzz']);
  });
});
