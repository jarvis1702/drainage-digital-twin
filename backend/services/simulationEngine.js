export function runDrainageSimulation(drains, rainfallIntensity) {
  // rainfallIntensity is in mm/hr
  return drains.map(drain => {
    // 1. Calculate Expected Runoff (m³/hr)
    // Runoff (m³/hr) = Rainfall (mm/hr) * 0.001 (m/mm) * Catchment Area (m²) * Runoff Coefficient
    const rainfallMeters = rainfallIntensity * 0.001;
    const expectedRunoff = parseFloat(
      (rainfallMeters * drain.catchmentArea * drain.runoffCoefficient).toFixed(2)
    );

    // 2. Capacity calculations
    const theoretical = drain.theoreticalCapacity;
    const effective = drain.effectiveCapacity;
    
    // Capacity utilization %
    const capacityUtilization = effective > 0 
      ? parseFloat(((expectedRunoff / effective) * 100).toFixed(1)) 
      : 0;

    // 3. Determine Diagnosis and Recommended Action
    let diagnosis = "Safe";
    let recommendedAction = "No immediate action required.";
    let diagnosisType = "NONE"; // NONE, BLOCKAGE, STRUCTURAL

    if (expectedRunoff > effective) {
      if (expectedRunoff <= theoretical && drain.effectiveCapacityPct < 90) {
        diagnosis = "Suspected blockage / maintenance issue";
        recommendedAction = "Inspect inlet and remove silt/debris from catchment flow path.";
        diagnosisType = "BLOCKAGE";
      } else {
        diagnosis = "Infrastructure capacity problem";
        recommendedAction = "Increase physical capacity (widen drain, add parallel conduit, or install retention basin).";
        diagnosisType = "STRUCTURAL";
      }
    } else if (capacityUtilization > 70 && drain.effectiveCapacityPct < 80) {
      // Impending blockage risk
      diagnosis = "Degraded capacity / Silt buildup warning";
      recommendedAction = "Schedule routine desilting to restore 100% capacity.";
      diagnosisType = "BLOCKAGE";
    }

    // 4. Calculate Risk Score (0 - 100)
    // Base is capacity utilization capped at 80, but can go up to 100
    let riskScore = Math.min(capacityUtilization, 80);
    
    // Elevation adjustments
    if (drain.elevation === "Low") riskScore += 15;
    else if (drain.elevation === "High") riskScore -= 10;
    
    // Historical incident adjustments
    riskScore += (drain.historicalIncidents || 0) * 4;
    
    // Force risk score to 100 if overflow is guaranteed
    if (expectedRunoff > effective) {
      riskScore = Math.max(riskScore, 95);
    }
    
    // Clamp between 0 and 100
    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

    // 5. Categorize status
    let status = "Safe"; // Safe, Stressed, Overflow
    if (expectedRunoff > effective) {
      status = "Overflow"; // Red
    } else if (capacityUtilization >= 70 || riskScore >= 70) {
      status = "Stressed"; // Yellow
    }

    return {
      ...drain,
      expectedRunoff,
      capacityUtilization,
      diagnosis,
      recommendedAction,
      diagnosisType,
      riskScore,
      status
    };
  });
}
