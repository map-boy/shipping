/**
 * Pricing is the one part of this system where a silent mistake bills a real
 * customer the wrong amount, so the tariff's own worked examples are pinned here.
 *
 *   node --experimental-strip-types src/lib/__tests__/truckPricing.test.mjs
 *
 * or from the repo root: npm --prefix functions run test:pricing
 */
import { calculateTruckPrice } from "../truckPricing.ts";
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  cond ? pass++ : fail++;
};
const throws = (name, fn, expect) => {
  try { fn(); ok(name, false, 'expected a rejection, got a price'); }
  catch (e) { ok(name, true, `-> "${e.message}"`); }
};

console.log('--- Your four cases (101 km) ---');
const A = calculateTruckPrice({ pricingMethod: 'tonnes', distanceKm: 101, tonnes: 1 });
const B = calculateTruckPrice({ pricingMethod: 'tonnes', distanceKm: 101, tonnes: 5 });
const C = calculateTruckPrice({ pricingMethod: 'tours', distanceKm: 101, numberOfTours: 1 });
const D = calculateTruckPrice({ pricingMethod: 'tours', distanceKm: 101, numberOfTours: 5 });
ok('A  1 t   = 275,250',   A.price === 250000 + 0.25*101*1000*1, A.formula);
ok('B  5 t   = 376,250',   B.price === 250000 + 0.25*101*1000*5, B.formula);
ok('C  1 tour= 757,500',   C.price === 0.25*101*1*30000,         C.formula);
ok('D  5 tour=3,787,500',  D.price === 0.25*101*5*30000,         D.formula);

console.log('\n--- Methods must not mix ---');
ok('tonnes ignores numberOfTours',
   calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:101, tonnes:5, numberOfTours:99 }).price === B.price);
ok('tours ignores tonnes',
   calculateTruckPrice({ pricingMethod:'tours', distanceKm:101, numberOfTours:5, tonnes:99 }).price === D.price);

console.log('\n--- Validation ---');
throws('missing tonnes',        () => calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:101 }));
throws('missing tours',         () => calculateTruckPrice({ pricingMethod:'tours',  distanceKm:101 }));
throws('zero tonnes',           () => calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:101, tonnes:0 }));
throws('negative tonnes',       () => calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:101, tonnes:-5 }));
throws('negative tours',        () => calculateTruckPrice({ pricingMethod:'tours',  distanceKm:101, numberOfTours:-2 }));
throws('fractional tours',      () => calculateTruckPrice({ pricingMethod:'tours',  distanceKm:101, numberOfTours:2.5 }));
throws('no distance',           () => calculateTruckPrice({ pricingMethod:'tonnes', tonnes:5 }));
throws('zero distance',         () => calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:0, tonnes:5 }));
throws('non-numeric tonnes',    () => calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:101, tonnes:'abc' }));
throws('unknown method',        () => calculateTruckPrice({ pricingMethod:'weight', distanceKm:101, tonnes:5 }));

console.log('\n--- String inputs must not corrupt the maths ---');
const s = calculateTruckPrice({ pricingMethod:'tonnes', distanceKm:'101', tonnes:'5' });
ok('"101" and "5" give 376,250 not concatenation', s.price === B.price, String(s.price));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
