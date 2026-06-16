export interface CableSpec {
  size: string;
  capacity: number;
  impedance: number; // Ω/km
}

// Data from AS3008 Table 8 Col 9 (Capacity) and Table 34 (Impedance)
export const AS3008_COPPER: CableSpec[] = [
  { size: '1.5', capacity: 20, impedance: 14.9010 },
  { size: '2.5', capacity: 27, impedance: 8.1415 },
  { size: '4', capacity: 36, impedance: 5.0621 },
  { size: '6', capacity: 46, impedance: 3.3828 },
  { size: '10', capacity: 64, impedance: 2.0141 },
  { size: '16', capacity: 85, impedance: 1.2659 },
  { size: '25', capacity: 114, impedance: 0.8077 },
  { size: '35', capacity: 141, impedance: 0.5870 },
  { size: '50', capacity: 178, impedance: 0.4395 },
  { size: '70', capacity: 225, impedance: 0.3128 },
  { size: '95', capacity: 271, impedance: 0.2362 },
  { size: '120', capacity: 322, impedance: 0.1970 },
  { size: '150', capacity: 372, impedance: 0.1702 },
  { size: '185', capacity: 427, impedance: 0.1493 },
  { size: '240', capacity: 514, impedance: 0.1298 },
  { size: '300', capacity: 591, impedance: 0.1190 },
  { size: '400', capacity: 709, impedance: 0.1107 },
  { size: '2x 150', capacity: 632.4, impedance: 0.0851 },
  { size: '2x 185', capacity: 725.9, impedance: 0.0750 },
  { size: '3x 120', capacity: 763.14, impedance: 0.0660 },
  { size: '2x 240', capacity: 873.8, impedance: 0.0650 },
  { size: '3x 150', capacity: 881.64, impedance: 0.0570 },
  { size: '2x 300', capacity: 1004.7, impedance: 0.0590 },
  { size: '3x 185', capacity: 1011.99, impedance: 0.0500 },
  { size: '4x 120', capacity: 966, impedance: 0.0490 },
  { size: '2x 400', capacity: 1063.5, impedance: 0.0550 },
];

export const AS3008_ALUMINIUM: CableSpec[] = [
  { size: '16', capacity: 67, impedance: 2.1035 },
  { size: '25', capacity: 91, impedance: 1.3253 },
  { size: '35', capacity: 111, impedance: 0.9627 },
  { size: '50', capacity: 136, impedance: 0.7142 },
  { size: '70', capacity: 174, impedance: 0.4990 },
  { size: '95', capacity: 216, impedance: 0.3674 },
  { size: '120', capacity: 253, impedance: 0.2962 },
  { size: '150', capacity: 291, impedance: 0.2488 },
  { size: '185', capacity: 339, impedance: 0.2076 },
  { size: '240', capacity: 407, impedance: 0.1703 },
  { size: '300', capacity: 472, impedance: 0.1483 },
  { size: '400', capacity: 557, impedance: 0.1302 },
  { size: '2x 150', capacity: 494.7, impedance: 0.1244 },
  { size: '2x 185', capacity: 576.3, impedance: 0.1040 },
  { size: '3x 120', capacity: 599.6, impedance: 0.0990 },
  { size: '2x 240', capacity: 691.9, impedance: 0.0850 },
  { size: '3x 150', capacity: 689.67, impedance: 0.0830 },
  { size: '2x 300', capacity: 802.4, impedance: 0.0741 },
  { size: '3x 185', capacity: 803.43, impedance: 0.0692 },
  { size: '4x 120', capacity: 759, impedance: 0.0741 },
  { size: '2x 400', capacity: 835.5, impedance: 0.0651 },
];

/**
 * Calculates the required AC cable size according to AS3008 Vdrop and Ampacity formulas.
 * @param acKw Total AC power in kW
 * @param lengthM Length of the cable run in meters
 * @param material 'Copper' or 'Aluminium'
 * @param requiredVdrop Required voltage drop percentage (default 1.5%)
 * @param voltage Nominal phase-to-phase voltage (default 400V)
 * @returns The required cable size string (e.g. '70')
 */
export function calculateAcCableSize(
  acKw: number,
  lengthM: number,
  material: 'Copper' | 'Aluminium' | string,
  requiredVdrop: number = 1.5,
  voltage: number = 400
): string {
  if (acKw <= 0 || lengthM <= 0) return '16'; // Fallback minimum

  const table = material.toLowerCase().includes('alu') ? AS3008_ALUMINIUM : AS3008_COPPER;

  // 1. Calculate Current
  // I = P / (sqrt(3) * V)
  const submainCurrent = (acKw * 1000) / (Math.sqrt(3) * voltage);
  const currentPlusSafety = submainCurrent * 1.25;

  // 2. Find minimum size based on Current Carrying Capacity (CCC)
  let cccIndex = table.findIndex(cable => cable.capacity >= currentPlusSafety);
  if (cccIndex === -1) cccIndex = table.length - 1; // Use max if exceeds

  // 3. Find minimum size based on Voltage Drop (Vdrop)
  let vdropIndex = 0;
  for (let i = 0; i < table.length; i++) {
    // Vdrop(%) = (sqrt(3) * I * (L/1000) * Z) / V * 100
    const vdropPercent = ((Math.sqrt(3) * submainCurrent * (lengthM / 1000) * table[i].impedance) / voltage) * 100;
    if (vdropPercent <= requiredVdrop) {
      vdropIndex = i;
      break;
    }
    vdropIndex = i; // Keep going if it's too high
  }

  // 4. Required cable is the maximum of CCC and Vdrop indexes
  const requiredIndex = Math.max(cccIndex, vdropIndex);
  
  return table[requiredIndex].size;
}
