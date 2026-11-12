import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearListMemory,
  isListPath,
  normaliseSearch,
  rememberedListPath,
  restoreListSearch,
  saveListSearch,
  sectionOf,
  trackListLocation,
} from './listMemory';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('list memory', () => {
  it('knows sections and list paths', () => {
    expect(sectionOf('/vehicles/veh_1')).toBe('vehicles');
    expect(sectionOf('/')).toBe('');
    expect(isListPath('/vehicles')).toBe(true);
    expect(isListPath('/vehicles/')).toBe(true);
    expect(isListPath('/vehicles/veh_1')).toBe(false);
    expect(isListPath('/settings')).toBe(false);
    expect(isListPath('/')).toBe(false);
  });

  it('saves only non-empty values and restores them', () => {
    saveListSearch('vehicles', '?status=IN_STOCK,RESERVED&q=&make=Toyota');
    expect(restoreListSearch('vehicles')).toBe('?status=IN_STOCK%2CRESERVED&make=Toyota');
    expect(normaliseSearch('?q=')).toBe('');
    // An empty query forgets the section.
    saveListSearch('vehicles', '');
    expect(restoreListSearch('vehicles')).toBe('');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('ignores sections without a remembered list', () => {
    saveListSearch('settings', '?x=1');
    expect(restoreListSearch('settings')).toBe('');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('builds the remembered link for a bare section list only', () => {
    saveListSearch('leases', '?status=ACTIVE');
    expect(rememberedListPath('/leases')).toBe('/leases?status=ACTIVE');
    expect(rememberedListPath('/leases?status=DRAFT')).toBe('/leases?status=DRAFT');
    expect(rememberedListPath('/leases/lease_1')).toBe('/leases/lease_1');
    expect(rememberedListPath('/drivers')).toBe('/drivers');
    expect(rememberedListPath('/')).toBe('/');
  });

  it('clears one section or every section', () => {
    saveListSearch('leases', '?status=ACTIVE');
    saveListSearch('deals', '?type=SALE');
    clearListMemory('leases');
    expect(restoreListSearch('leases')).toBe('');
    expect(restoreListSearch('deals')).toBe('?type=SALE');
    clearListMemory();
    expect(restoreListSearch('deals')).toBe('');
  });

  it('remembers while inside the section and forgets on leaving it', () => {
    trackListLocation(null, '/vehicles', '?status=IN_STOCK');
    expect(restoreListSearch('vehicles')).toBe('?status=IN_STOCK');
    // Into a vehicle page of the same section: kept (the breadcrumb leads back to the filter).
    trackListLocation('/vehicles', '/vehicles/veh_1', '');
    expect(rememberedListPath('/vehicles')).toBe('/vehicles?status=IN_STOCK');
    // Over to another top-level section: forgotten.
    trackListLocation('/vehicles/veh_1', '/drivers/drv_1', '');
    expect(restoreListSearch('vehicles')).toBe('');
  });

  it('never throws when storage is unavailable', () => {
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      expect(() => saveListSearch('vehicles', '?status=SOLD')).not.toThrow();
      expect(restoreListSearch('vehicles')).toBe('');
      expect(() => clearListMemory()).not.toThrow();
      expect(rememberedListPath('/vehicles')).toBe('/vehicles');
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
