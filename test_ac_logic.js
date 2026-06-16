const acMap = [
  { size_mm2: 1.5, copper_single_core: null, copper_4c_e: 1.69 },
  { size_mm2: 2.5, copper_single_core: null, copper_4c_e: 2.91 },
  { size_mm2: 4, copper_single_core: null, copper_4c_e: 4.45 },
  { size_mm2: 6, copper_single_core: null, copper_4c_e: 6.04 },
  { size_mm2: 10, copper_single_core: null, copper_4c_e: 11.19 },
  { size_mm2: 16, copper_single_core: null, copper_4c_e: 16.94 },
  { size_mm2: 25, copper_single_core: 5.81, copper_4c_e: 24.99 },
  { size_mm2: 35, copper_single_core: 7.96, copper_4c_e: 35.35 },
  { size_mm2: 50, copper_single_core: 11.07, copper_4c_e: 47.97 },
  { size_mm2: 70, copper_single_core: 15.17, copper_4c_e: 66.49 }
];

const size = '70';
const mapRow = acMap.find(row => row.size_mm2 == size);
console.log('Match for 70:', mapRow);

const size2 = '4';
const mapRow2 = acMap.find(row => row.size_mm2 == size2);
console.log('Match for 4:', mapRow2);

// Simulate the exact code from buildVirtualAcCabling
const scope = {
  ac_inverter_pvdb_type: 'No Match',
  ac_inverter_pvdb_construction: 'Single Core',
  ac_inverter_pvdb_m: 5,
  system_kw: 10
};

const materialType = scope.ac_inverter_pvdb_type || 'Included - Copper';
const construction = scope.ac_inverter_pvdb_construction || 'Single Core';
const lengthM = scope.ac_inverter_pvdb_m || 0;

const material = materialType.toLowerCase().includes('alu') ? 'Aluminium' : 'Copper';
console.log('Material:', material);
console.log('Construction:', construction);

// Calculate size for 10kW, 5m
const submainCurrent = (10 * 1000) / (Math.sqrt(3) * 400); // 14.4A
const currentPlusSafety = submainCurrent * 1.25; // 18A
// From AS3008, 1.5mm2 is 20A. So size is '1.5'
const calcSize = '1.5';
const calcRow = acMap.find(row => row.size_mm2 == calcSize);

console.log('Row for 1.5:', calcRow);

let basePrice = 0;
if (calcRow) {
  const is4C = construction.includes('4C');
  const price = is4C ? calcRow.copper_4c_e : calcRow.copper_single_core;
  if (price !== null && !isNaN(price)) {
    basePrice = price;
  }
}
console.log('Base price for 10kW Single Core:', basePrice);
